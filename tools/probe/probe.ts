/**
 * AMI live probe.
 *
 * Connects to Confluent Cloud as its own throwaway consumer group, captures live
 * messages on the simulator's source topics, and reports:
 *   1. Schema conformance  — each payload validated against schemas/<topic>.json
 *   2. Produce→consume lag  — message.timestamp vs. receive time (min/avg/p95/max)
 *   3. Field-map cross-check — keys the simulator emits vs. keys the API consumes
 *
 * Usage:
 *   npm run probe                       # 30s window, source topics, 3000ms threshold
 *   npm run probe -- --seconds=60
 *   npm run probe -- --threshold=2000
 *   npm run probe -- --all              # also include Flink/AI output topics
 *
 * Exits non-zero if any schema mismatch occurs or any topic exceeds the lag threshold.
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Kafka, logLevel } from "kafkajs";
import AjvModule, { type ValidateFunction } from "ajv";
import addFormatsModule from "ajv-formats";

// Ajv & ajv-formats are CommonJS; under NodeNext ESM the callable lives on .default.
const Ajv = (AjvModule as any).default ?? AjvModule;
const addFormats = (addFormatsModule as any).default ?? addFormatsModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- .env discovery (mirrors apps/api/src/index.ts findEnv) -----------------
function findEnv(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
const envPath = findEnv(__dirname) || findEnv(process.cwd());
if (envPath) {
  dotenv.config({ path: envPath, override: true });
  console.log(`[probe] loaded env from ${envPath}`);
} else {
  console.error("[probe] no .env found — relying on process env");
}

// --- args -------------------------------------------------------------------
const argOf = (name: string, fallback: number): number => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const v = Number(hit.split("=")[1]);
  return Number.isFinite(v) ? v : fallback;
};
const SECONDS = argOf("seconds", 30);
const THRESHOLD_MS = argOf("threshold", 3000);
const INCLUDE_ALL = process.argv.includes("--all");

// Topics the simulator produces directly (plain JSON, no Schema Registry header).
const SOURCE_TOPICS = [
  "telemetry.robot",
  "telemetry.quality",
  "telemetry.inventory",
  "events.maintenance",
  "events.supply"
];
// Downstream topics produced by Flink / AI agents (Schema Registry wire format).
const OUTPUT_TOPICS = [
  "insights.anomalies",
  "kpis.rollup",
  "ai.agent.decisions",
  "ai.agent.machine_health",
  "ai.agent.quality",
  "ai.agent.supply",
  "alerts.acks"
];
const TOPICS = INCLUDE_ALL ? [...SOURCE_TOPICS, ...OUTPUT_TOPICS] : SOURCE_TOPICS;

// Keys the API reads off each source topic's payload (mirrors index.ts handlers).
// Used to flag fields the simulator emits but the API drops, and vice versa.
const API_CONSUMED_KEYS: Record<string, string[]> = {
  "telemetry.robot": [
    "machine_id",
    "line_id",
    "vibration_hz",
    "torque_nm",
    "temperature_c",
    "defect_rate",
    "ts",
    "status"
  ],
  "telemetry.quality": ["line_id", "ts", "batch_id", "defect_rate"],
  "telemetry.inventory": ["part_id", "ts", "stock_level", "consumption_rate"],
  "events.maintenance": ["machine_id", "ts", "action", "technician"],
  "events.supply": ["supplier_id", "ts", "delay_hours", "material"]
};

// --- load + compile schemas -------------------------------------------------
const schemasDir = path.resolve(__dirname, "..", "..", "schemas");
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validators: Record<string, ValidateFunction> = {};
for (const topic of TOPICS) {
  const file = path.join(schemasDir, `${topic}.json`);
  if (!fs.existsSync(file)) {
    console.warn(`[probe] no schema file for ${topic} (${file}) — skipping validation`);
    continue;
  }
  try {
    const schema = JSON.parse(fs.readFileSync(file, "utf-8"));
    validators[topic] = ajv.compile(schema);
  } catch (err) {
    console.warn(`[probe] failed to compile schema for ${topic}:`, err);
  }
}

// --- per-topic accumulators -------------------------------------------------
type TopicAgg = {
  messages: number;
  valid: number;
  invalid: number;
  sampleErrors: string[];
  lags: number[];
  payloadKeys: Set<string>;
};
const agg: Record<string, TopicAgg> = {};
const getAgg = (t: string): TopicAgg =>
  (agg[t] ??= {
    messages: 0,
    valid: 0,
    invalid: 0,
    sampleErrors: [],
    lags: [],
    payloadKeys: new Set()
  });

// Strip Confluent Schema Registry wire-format header (magic 0x00 + 4-byte id),
// then locate the JSON body. Mirrors parseMessageValue in apps/api/src/index.ts.
function parseValue(value: Buffer): Record<string, any> | null {
  let buf = value;
  if (buf.length > 5 && buf[0] === 0x00) buf = buf.subarray(5);
  const text = buf.toString();
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : null;
  } catch {
    const start = text.search(/[{\[]/);
    if (start >= 0) {
      try {
        const v = JSON.parse(text.substring(start));
        return v && typeof v === "object" ? v : null;
      } catch {
        /* unparseable */
      }
    }
    return null;
  }
}

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

async function main() {
  const brokers = (process.env.CONFLUENT_BOOTSTRAP_SERVERS || "")
    .split(",")
    .filter(Boolean);
  if (brokers.length === 0) {
    console.error("[probe] CONFLUENT_BOOTSTRAP_SERVERS missing — cannot connect");
    process.exit(2);
  }

  const kafka = new Kafka({
    clientId: "ami-probe",
    brokers,
    ssl: true,
    sasl: {
      mechanism: "plain",
      username: process.env.CONFLUENT_API_KEY || "",
      password: process.env.CONFLUENT_API_SECRET || ""
    },
    logLevel: logLevel.NOTHING
  });

  // Unique group id so we never touch the API's committed offsets.
  const groupId = `ami-probe-${process.pid}-${Buffer.from(
    process.hrtime.bigint().toString()
  )
    .toString("base64")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)}`;
  const consumer = kafka.consumer({ groupId });

  await consumer.connect();
  for (const topic of TOPICS) {
    await consumer.subscribe({ topic, fromBeginning: false });
  }

  console.log(
    `[probe] group=${groupId} window=${SECONDS}s threshold=${THRESHOLD_MS}ms topics=${TOPICS.length}`
  );
  console.log("[probe] capturing live messages — make sure the simulator is running…\n");

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;
      const a = getAgg(topic);
      a.messages += 1;

      // latency
      if (message.timestamp) {
        a.lags.push(Date.now() - Number(message.timestamp));
      }

      const payload = parseValue(message.value);
      const validate = validators[topic];

      if (!payload) {
        a.invalid += 1;
        if (a.sampleErrors.length < 3) a.sampleErrors.push("unparseable payload");
        return;
      }
      for (const k of Object.keys(payload)) a.payloadKeys.add(k);

      if (validate) {
        if (validate(payload)) {
          a.valid += 1;
        } else {
          a.invalid += 1;
          if (a.sampleErrors.length < 3) {
            const errs = (validate.errors || [])
              .slice(0, 2)
              .map((e) => `${e.instancePath || "/"} ${e.message}`)
              .join("; ");
            a.sampleErrors.push(errs || "schema mismatch");
          }
        }
      }
    }
  });

  await new Promise((r) => setTimeout(r, SECONDS * 1000));
  await consumer.disconnect();

  report();
}

function pad(s: string | number, w: number): string {
  return String(s).padEnd(w);
}

function report() {
  let hadSchemaFailure = false;
  let hadLatencyBreach = false;

  console.log("\n=== Schema conformance ===");
  console.log(
    pad("topic", 24) + pad("msgs", 7) + pad("valid", 7) + pad("invalid", 9) + "sample errors"
  );
  for (const topic of TOPICS) {
    const a = agg[topic];
    if (!a) {
      console.log(pad(topic, 24) + pad(0, 7) + pad(0, 7) + pad(0, 9) + "(no messages)");
      continue;
    }
    if (a.invalid > 0) hadSchemaFailure = true;
    console.log(
      pad(topic, 24) +
        pad(a.messages, 7) +
        pad(a.valid, 7) +
        pad(a.invalid, 9) +
        (a.sampleErrors[0] ?? "")
    );
  }

  console.log("\n=== Produce→consume latency (ms) ===");
  console.log(
    pad("topic", 24) + pad("n", 7) + pad("min", 8) + pad("avg", 8) + pad("p95", 8) + pad("max", 8) + "flag"
  );
  for (const topic of TOPICS) {
    const a = agg[topic];
    if (!a || a.lags.length === 0) {
      console.log(pad(topic, 24) + pad(0, 7) + "(no timestamped messages)");
      continue;
    }
    const sorted = [...a.lags].sort((x, y) => x - y);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = Math.round(sorted.reduce((s, v) => s + v, 0) / sorted.length);
    const p95 = pct(sorted, 95);
    const breach = p95 > THRESHOLD_MS;
    if (breach) hadLatencyBreach = true;
    console.log(
      pad(topic, 24) +
        pad(a.lags.length, 7) +
        pad(min, 8) +
        pad(avg, 8) +
        pad(p95, 8) +
        pad(max, 8) +
        (breach ? `OVER ${THRESHOLD_MS}ms` : "ok")
    );
  }

  console.log("\n=== Field-map cross-check (source topics) ===");
  for (const topic of SOURCE_TOPICS) {
    if (!TOPICS.includes(topic)) continue;
    const consumed = API_CONSUMED_KEYS[topic];
    if (!consumed) continue;
    const a = agg[topic];
    if (!a || a.payloadKeys.size === 0) {
      console.log(`  ${topic}: (no messages captured — cannot compare fields)`);
      continue;
    }
    const present = a.payloadKeys;
    const droppedByApi = [...present].filter((k) => !consumed.includes(k));
    const missingFromSim = consumed.filter((k) => !present.has(k));
    console.log(
      `  ${topic}: api-reads-but-sim-missing=[${missingFromSim.join(", ") || "none"}]  ` +
        `sim-sends-but-api-ignores=[${droppedByApi.join(", ") || "none"}]`
    );
  }

  const totalMessages = Object.values(agg).reduce((s, a) => s + a.messages, 0);

  console.log("\n=== Verdict ===");
  if (totalMessages === 0) {
    console.log(
      "INCONCLUSIVE — captured 0 messages. Is the simulator running (npm run dev:sim)? " +
        "The probe only reads NEW messages produced during its window."
    );
    process.exit(3);
  }
  if (!hadSchemaFailure && !hadLatencyBreach) {
    console.log(
      `PASS — ${totalMessages} messages; all conform and p95 lag within ${THRESHOLD_MS}ms.`
    );
    process.exit(0);
  }
  if (hadSchemaFailure) console.log("FAIL — at least one topic had schema mismatches.");
  if (hadLatencyBreach)
    console.log(`FAIL — at least one topic p95 lag exceeded ${THRESHOLD_MS}ms.`);
  process.exit(1);
}

main().catch((err) => {
  console.error("[probe] fatal:", err);
  process.exit(2);
});
