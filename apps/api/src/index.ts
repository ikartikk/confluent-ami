import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { Kafka } from "kafkajs";
import { SchemaRegistry } from "@kafkajs/confluent-schema-registry";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Walk up directories from both __dirname and cwd to find a .env file
function findEnv(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const candidate = path.join(dir, ".env");
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null; // reached filesystem root
    dir = parent;
  }
}

const envPath = findEnv(__dirname) || findEnv(process.cwd());

if (envPath) {
  const result = dotenv.config({ path: envPath, override: true });
  if (result.error) {
    console.error("[env] dotenv error:", result.error);
  } else {
    console.log(`[env] loaded from ${envPath}`);
    console.log("[env] keys:", Object.keys(result.parsed || {}));
  }
} else {
  console.error("[env] No .env file found (searched up from __dirname and cwd)");
  console.error("[env] __dirname:", __dirname);
  console.error("[env] cwd:", process.cwd());
}

console.log(
  "[env] CONFLUENT_BOOTSTRAP_SERVERS =",
  process.env.CONFLUENT_BOOTSTRAP_SERVERS ? "SET" : "MISSING"
);

type KpiSnapshot = {
  activeAlerts: number;
  downtimeRisk: number;
  throughput: number;
  defectProbability: number;
  supplyHealth: number;
  utilization: number;
  updatedAt: string;
};

type AnomalyEvent = {
  id: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  machineId: string;
  lineId: string;
  summary: string;
  timestamp: string;
};

type AgentInsight = {
  agent: string;
  summary: string;
  riskLevel?: string;
  riskScore?: number;
  recommendedAction?: string;
  escalation?: string;
  confidence?: number;
  timestamp?: string;
};

type AckEvent = {
  id: string;
  acknowledgedBy: string;
  timestamp: string;
};

type MachineStatus = {
  machineId: string;
  lineId: string;
  vibrationHz: number;
  torqueNm: number;
  temperatureC: number;
  defectRate: number;
  lastUpdated: string;
  status: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
};

type QualityTelemetry = {
  lineId: string;
  timestamp: string;
  batchId: string;
  defectRate: number;
};

type InventoryTelemetry = {
  partId: string;
  timestamp: string;
  stockLevel: number;
  consumptionRate: number;
};

type MaintenanceEvent = {
  machineId: string;
  timestamp: string;
  action: string;
  technician: string;
};

type SupplyEvent = {
  supplierId: string;
  timestamp: string;
  delayHours: number;
  material: string;
};

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.API_PORT || 4000);
const KAFKA_DISABLED =
  process.env.KAFKA_DISABLED === "true" || !process.env.CONFLUENT_BOOTSTRAP_SERVERS;

const SCHEMA_REGISTRY_URL =
  process.env.SCHEMA_REGISTRY_URL || process.env.CONFLUENT_SCHEMA_REGISTRY_URL;
const SCHEMA_REGISTRY_API_KEY =
  process.env.SCHEMA_REGISTRY_API_KEY ||
  process.env.CONFLUENT_SCHEMA_REGISTRY_API_KEY ||
  process.env.CONFLUENT_API_KEY;
const SCHEMA_REGISTRY_API_SECRET =
  process.env.SCHEMA_REGISTRY_API_SECRET ||
  process.env.CONFLUENT_SCHEMA_REGISTRY_API_SECRET ||
  process.env.CONFLUENT_API_SECRET;

const schemaRegistry = SCHEMA_REGISTRY_URL
  ? new SchemaRegistry({
      host: SCHEMA_REGISTRY_URL,
      auth: SCHEMA_REGISTRY_API_KEY && SCHEMA_REGISTRY_API_SECRET
        ? { username: SCHEMA_REGISTRY_API_KEY, password: SCHEMA_REGISTRY_API_SECRET }
        : undefined
    })
  : null;

console.log(
  `[api] kafka disabled=${KAFKA_DISABLED} bootstrap=${process.env.CONFLUENT_BOOTSTRAP_SERVERS ? "set" : "missing"}`
);

let kpis: KpiSnapshot = {
  activeAlerts: 0,
  downtimeRisk: 0,
  throughput: 0,
  defectProbability: 0,
  supplyHealth: 0,
  utilization: 0,
  updatedAt: new Date().toISOString()
};
let anomalies: AnomalyEvent[] = [];
let agents: AgentInsight[] = [];
let machines: MachineStatus[] = [];
let agentDecisions: AgentInsight[] = [];
let agentOutputs: AgentInsight[] = [];
let acks: Record<string, AckEvent> = {};
let qualityTelemetry: QualityTelemetry[] = [];
let inventoryTelemetry: InventoryTelemetry[] = [];
let maintenanceEvents: MaintenanceEvent[] = [];
let supplyEvents: SupplyEvent[] = [];
let producer: ReturnType<Kafka["producer"]> | null = null;

const parsePayload = (raw: unknown): Record<string, any> => {
  if (typeof raw === "string") {
    try {
      return parsePayload(JSON.parse(raw));
    } catch {
      return { summary: raw };
    }
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, any>;
    // Flink AI_RUN_AGENT wraps response as { payload: { string: "..." } }
    if (typeof obj?.payload?.string === "string") {
      return parsePayload(obj.payload.string);
    }
    // Sometimes payload is the raw JSON string directly
    if (typeof obj?.payload === "string") {
      return parsePayload(obj.payload);
    }
    // Or as { string: "..." } when the outer payload is already unwrapped
    if (typeof obj?.string === "string" && Object.keys(obj).length <= 2) {
      return parsePayload(obj.string);
    }
    return obj;
  }
  return {};
};

const parseMessageValue = async (value: Buffer, topic?: string) => {
  const schemaId =
    value.length > 5 && value[0] === 0x00 ? value.readUInt32BE(1) : null;

  if (topic === "kpis.rollup") {
    const raw = value.length > 5 && value[0] === 0x00 ? value.subarray(5) : value;
    try {
      return JSON.parse(raw.toString());
    } catch {
      const text = raw.toString();
      const jsonStart = text.search(/[{\[]/);
      if (jsonStart >= 0) {
        return JSON.parse(text.substring(jsonStart));
      }
      return text;
    }
  }

  if (schemaRegistry && schemaId !== null) {
    try {
      const decoded = await schemaRegistry.decode(value);
      if (process.env.DEBUG_ANOMALIES === "true" && topic === "insights.anomalies") {
        const keys = decoded && typeof decoded === "object"
          ? Object.keys(decoded as Record<string, any>).slice(0, 20)
          : [];
        console.log(`[anomaly-decoded] schemaId=${schemaId} type=${typeof decoded} keys=${keys.join(",")}`);
      }
      return decoded;
    } catch (error) {
      if (process.env.DEBUG_ANOMALIES === "true") {
        console.log(
          `[schema-registry] decode failed schemaId=${schemaId} err=${error instanceof Error ? error.message : String(error)}`
        );
      }
      try {
        const schemaInfo = await schemaRegistry.getSchema(schemaId);
        const schemaType = (schemaInfo as any)?.type || (schemaInfo as any)?.schemaType;
        if (process.env.DEBUG_ANOMALIES === "true") {
          console.log(`[schema-registry] schemaId=${schemaId} type=${schemaType ?? "unknown"}`);
        }
        if (schemaType === "JSON") {
          const jsonText = value.subarray(5).toString();
          try {
            return JSON.parse(jsonText);
          } catch {
            const jsonStart = jsonText.search(/[{\[]/);
            if (jsonStart >= 0) {
              return JSON.parse(jsonText.substring(jsonStart));
            }
          }
        }
      } catch (fallbackError) {
        if (process.env.DEBUG_ANOMALIES === "true") {
          console.log(
            `[schema-registry] fallback failed schemaId=${schemaId} err=${fallbackError instanceof Error ? fallbackError.message : String(fallbackError)}`
          );
        }
      }
    }
  }

  let buf = value;
  // Strip Confluent Schema Registry wire-format header (magic byte 0x00 + 4-byte schema ID)
  if (buf.length > 5 && buf[0] === 0x00) {
    buf = buf.subarray(5);
  }
  const text = buf.toString();
  try {
    return JSON.parse(text);
  } catch {
    // Avro-encoded STRING fields have a variable-length prefix before the JSON.
    // Find the first '{' or '[' and try parsing from there.
    const jsonStart = text.search(/[{\[]/);
    if (jsonStart > 0) {
      try {
        return JSON.parse(text.substring(jsonStart));
      } catch {
        // fall through
      }
    }
    if (process.env.DEBUG_ANOMALIES === "true" && topic === "insights.anomalies") {
      console.log(`[anomaly-decoded] fallback type=${typeof text}`);
    }
    return text;
  }
};

const clients: express.Response[] = [];

let lastPublishAt = 0;
let publishTimer: NodeJS.Timeout | null = null;

const publishState = () => {
  const now = Date.now();
  if (now - lastPublishAt < 500) {
    if (!publishTimer) {
      publishTimer = setTimeout(() => {
        publishTimer = null;
        publishState();
      }, 500 - (now - lastPublishAt));
    }
    return;
  }
  lastPublishAt = now;
  const payload = JSON.stringify({
    kpis,
    anomalies,
    agents,
    machines,
    agentDecisions,
    agentOutputs,
    acks: Object.values(acks),
    qualityTelemetry,
    inventoryTelemetry,
    maintenanceEvents,
    supplyEvents
  });
  clients.forEach((res) => res.write(`data: ${payload}\n\n`));
};

app.get("/api/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();
  clients.push(res);
  if (process.env.DEBUG_ANOMALIES === "true") {
    console.log(`[sse] client connected count=${clients.length}`);
  }
  res.write(
    `data: ${JSON.stringify({
      kpis,
      anomalies,
      agents,
      machines,
      agentDecisions,
      agentOutputs,
      acks: Object.values(acks),
      qualityTelemetry,
      inventoryTelemetry,
      maintenanceEvents,
      supplyEvents
    })}\n\n`
  );
  req.on("close", () => {
    const index = clients.indexOf(res);
    if (index >= 0) clients.splice(index, 1);
    if (process.env.DEBUG_ANOMALIES === "true") {
      console.log(`[sse] client disconnected count=${clients.length}`);
    }
  });
});

app.get("/api/kpis", (_req, res) => {
  res.json({
    kpis,
    anomalies,
    agents,
    machines,
    agentDecisions,
    acks: Object.values(acks),
    qualityTelemetry,
    inventoryTelemetry,
    maintenanceEvents,
    supplyEvents
  });
});

app.get("/api/agent-debug", (_req, res) => {
  res.json({
    kafkaDisabled: KAFKA_DISABLED,
    agentCount: agents.length,
    agentDecisionCount: agentDecisions.length,
    agents,
    agentDecisions,
    sseClients: clients.length,
    timestamp: new Date().toISOString()
  });
});

app.post("/api/ack", async (req, res) => {
  const id = req.body?.id as string;
  const acknowledgedBy = (req.body?.acknowledgedBy as string) || "operator";
  if (!id) return res.status(400).json({ error: "id required" });
  const ack: AckEvent = {
    id,
    acknowledgedBy,
    timestamp: new Date().toISOString()
  };
  if (producer) {
    await producer.send({
      topic: "alerts.acks",
      messages: [{ value: JSON.stringify(ack) }]
    });
  }
  acks = { ...acks, [id]: ack };
  publishState();
  res.json({ ok: true });
});

if (KAFKA_DISABLED) {
  setInterval(() => {
    kpis = {
      activeAlerts: Math.floor(Math.random() * 5),
      downtimeRisk: Math.random() * 100,
      throughput: 400 + Math.random() * 50,
      defectProbability: Math.random() * 5,
      supplyHealth: 80 + Math.random() * 20,
      utilization: 70 + Math.random() * 20,
      updatedAt: new Date().toISOString()
    };
    anomalies = [
      {
        id: randomUUID(),
        severity: "HIGH",
        machineId: "RB-22",
        lineId: "Line-B",
        summary: "Torque instability detected at weld station",
        timestamp: new Date().toISOString()
      }
    ];
    agents = [
      { agent: "Machine Health Agent", summary: "Spindle degradation probability: 81%" },
      { agent: "Quality Agent", summary: "Defect propagation risk rising for Batch #442" },
      { agent: "Supply Agent", summary: "Bearing inventory below projected demand" }
    ];
    agentOutputs = agents;
    machines = [
      {
        machineId: "RB-22",
        lineId: "Line-B",
        vibrationHz: 18.4,
        torqueNm: 31.9,
        temperatureC: 72.5,
        defectRate: 0.03,
        lastUpdated: new Date().toISOString(),
        status: "HIGH"
      }
    ];
    qualityTelemetry = [
      {
        lineId: "Line-B",
        timestamp: new Date().toISOString(),
        batchId: "B-442",
        defectRate: 0.031
      }
    ];
    inventoryTelemetry = [
      {
        partId: "PT-42",
        timestamp: new Date().toISOString(),
        stockLevel: 180,
        consumptionRate: 2.4
      }
    ];
    maintenanceEvents = [
      {
        machineId: "RB-22",
        timestamp: new Date().toISOString(),
        action: "inspect",
        technician: "Alex Kim"
      }
    ];
    supplyEvents = [
      {
        supplierId: "SUP-5",
        timestamp: new Date().toISOString(),
        delayHours: 1.2,
        material: "bearings"
      }
    ];
    publishState();
  }, 5000);
} else {
  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || "ami-api",
    brokers: (process.env.CONFLUENT_BOOTSTRAP_SERVERS || "").split(",").filter(Boolean),
    ssl: true,
    sasl: {
      mechanism: "plain",
      username: process.env.CONFLUENT_API_KEY || "",
      password: process.env.CONFLUENT_API_SECRET || ""
    }
  });

  const consumer = kafka.consumer({
    groupId: process.env.KAFKA_GROUP_ID || "ami-api-group"
  });
  producer = kafka.producer();

  const fromBeginning = process.env.KAFKA_FROM_BEGINNING === "true";

  const run = async () => {
    await consumer.connect();
    await producer.connect();
    await consumer.subscribe({ topic: "insights.anomalies", fromBeginning });
    await consumer.subscribe({ topic: "kpis.rollup", fromBeginning });
    await consumer.subscribe({ topic: "telemetry.robot", fromBeginning });
    await consumer.subscribe({ topic: "telemetry.quality", fromBeginning });
    await consumer.subscribe({ topic: "telemetry.inventory", fromBeginning });
    await consumer.subscribe({ topic: "events.maintenance", fromBeginning });
    await consumer.subscribe({ topic: "events.supply", fromBeginning });
    await consumer.subscribe({ topic: "ai.agent.decisions", fromBeginning });
    await consumer.subscribe({ topic: "ai.agent.machine_health", fromBeginning });
    await consumer.subscribe({ topic: "ai.agent.quality", fromBeginning });
    await consumer.subscribe({ topic: "ai.agent.supply", fromBeginning });
    await consumer.subscribe({ topic: "alerts.acks", fromBeginning });

    const agentTopicCounts: Record<string, number> = {};
    let anomalyCount = 0;
    setInterval(() => {
      const agentTopics = ["ai.agent.decisions", "ai.agent.machine_health", "ai.agent.quality", "ai.agent.supply"];
      const summary = agentTopics.map(t => `${t}=${agentTopicCounts[t] ?? 0}`).join("  ");
      console.log(`[agent-heartbeat] messages received: ${summary}`);
    }, 10000);

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          if (!message.value) return;

          if (topic.startsWith("ai.agent.")) {
            agentTopicCounts[topic] = (agentTopicCounts[topic] ?? 0) + 1;
            const msgTimestamp = message.timestamp ? new Date(Number(message.timestamp)).toISOString() : "no-ts";
            const age = message.timestamp ? `${((Date.now() - Number(message.timestamp)) / 1000).toFixed(1)}s ago` : "unknown age";
            console.log(`[agent-rx] ${topic} | offset=${message.offset} | produced=${msgTimestamp} | ${age} | size=${message.value.length}b`);
            if (agentTopicCounts[topic] <= 3) {
              const rawStr = message.value.toString().substring(0, 500);
              console.log(`[agent-raw] ${topic} first bytes: [${message.value[0]}, ${message.value[1]}, ${message.value[2]}, ${message.value[3]}, ${message.value[4]}]`);
              console.log(`[agent-raw] ${topic} text: ${rawStr}`);
            }
          }

          if (topic === "insights.anomalies") {
            anomalyCount += 1;
            if (process.env.DEBUG_ANOMALIES === "true") {
              const msgTimestamp = message.timestamp
                ? new Date(Number(message.timestamp)).toISOString()
                : "no-ts";
              console.log(`[anomaly-rx] count=${anomalyCount} offset=${message.offset} produced=${msgTimestamp} size=${message.value.length}b`);
              if (anomalyCount <= 3) {
                const rawStr = message.value.toString().substring(0, 500);
                console.log(`[anomaly-raw] first bytes: [${message.value[0]}, ${message.value[1]}, ${message.value[2]}, ${message.value[3]}, ${message.value[4]}]`);
                console.log(`[anomaly-raw] text: ${rawStr}`);
              }
            }
          }

          const parsed = await parseMessageValue(message.value, topic);
          if (!parsed || typeof parsed !== "object") {
            if (topic.startsWith("ai.agent.")) {
              console.log(`[agent-parse-fail] ${topic} parseMessageValue returned type=${typeof parsed} value=${JSON.stringify(parsed).substring(0, 300)}`);
              // Try to parse the raw buffer as a string payload directly
              const rawText = message.value.toString();
              console.log(`[agent-parse-fail] ${topic} raw text: ${rawText.substring(0, 400)}`);
            }
            if (topic === "insights.anomalies" && process.env.DEBUG_ANOMALIES === "true") {
              const schemaId =
                message.value.length > 5 && message.value[0] === 0x00
                  ? message.value.readUInt32BE(1)
                  : null;
              const rawText = message.value.toString();
              console.log(`[anomaly-parse-fail] schemaId=${schemaId ?? "n/a"}`);
              console.log(`[anomaly-parse-fail] type=${typeof parsed} value=${JSON.stringify(parsed).substring(0, 300)}`);
              console.log(`[anomaly-parse-fail] raw text: ${rawText.substring(0, 400)}`);
            }
            return;
          }
          const payload = parsed as Record<string, any>;
          if (topic === "insights.anomalies" && process.env.DEBUG_ANOMALIES === "true") {
            if (!("id" in payload) && !("summary" in payload)) {
              console.log(`[anomaly-payload] keys=${Object.keys(payload).slice(0, 20).join(",")}`);
            }
          }

          if (topic === "kpis.rollup") {
            // Flink sends partial KPI updates from 5 sources; non-owned fields arrive as 0.
            // Only accept a field if its value is non-zero (or for activeAlerts, non-null).
            const keepNonZero = (next: number | null | undefined, prev: number) =>
              typeof next === "number" && next !== 0 ? next : prev;
            kpis = {
              activeAlerts: payload.active_alerts ?? kpis.activeAlerts,
              downtimeRisk: keepNonZero(payload.downtime_risk, kpis.downtimeRisk),
              throughput: keepNonZero(payload.throughput, kpis.throughput),
              defectProbability: keepNonZero(payload.defect_probability, kpis.defectProbability),
              supplyHealth: keepNonZero(payload.supply_health, kpis.supplyHealth),
              utilization: keepNonZero(payload.utilization, kpis.utilization),
              updatedAt: typeof payload.updated_at === "number"
                ? new Date(payload.updated_at).toISOString()
                : payload.updated_at ?? new Date().toISOString()
            };
          }
          if (topic === "insights.anomalies") {
            const tsRaw = payload.ts;
            const timestamp = typeof tsRaw === "number"
              ? new Date(tsRaw).toISOString()
              : typeof tsRaw === "string"
                ? tsRaw
                : new Date().toISOString();
            anomalies = [
              {
                id: payload.id ?? randomUUID(),
                severity: payload.severity ?? "MEDIUM",
                machineId: payload.machine_id ?? "RB-00",
                lineId: payload.line_id ?? "Line-A",
                summary: payload.summary ?? "Anomaly detected",
                timestamp
              },
              ...anomalies
            ].slice(0, 50);
            if (process.env.DEBUG_ANOMALIES === "true") {
              console.log(`[anomaly-state] anomalies=${anomalies.length} clients=${clients.length}`);
            }
            // agent_insights from anomalies are static Flink-generated labels — don't overwrite
            // the real AI agent outputs stored in `agents`
          }
          if (topic === "telemetry.robot") {
            const machine: MachineStatus = {
              machineId: payload.machine_id,
              lineId: payload.line_id,
              vibrationHz: payload.vibration_hz,
              torqueNm: payload.torque_nm,
              temperatureC: payload.temperature_c,
              defectRate: payload.defect_rate,
              lastUpdated: payload.ts ?? new Date().toISOString(),
              status: payload.status ?? "LOW"
            };
            machines = [machine, ...machines.filter((m) => m.machineId !== machine.machineId)].slice(0, 12);
          }
          if (topic === "telemetry.quality") {
            const entry: QualityTelemetry = {
              lineId: payload.line_id,
              timestamp: payload.ts ?? new Date().toISOString(),
              batchId: payload.batch_id,
              defectRate: payload.defect_rate
            };
            qualityTelemetry = [entry, ...qualityTelemetry].slice(0, 30);
          }
          if (topic === "telemetry.inventory") {
            const entry: InventoryTelemetry = {
              partId: payload.part_id,
              timestamp: payload.ts ?? new Date().toISOString(),
              stockLevel: payload.stock_level,
              consumptionRate: payload.consumption_rate
            };
            inventoryTelemetry = [entry, ...inventoryTelemetry].slice(0, 30);
          }
          if (topic === "events.maintenance") {
            const entry: MaintenanceEvent = {
              machineId: payload.machine_id,
              timestamp: payload.ts ?? new Date().toISOString(),
              action: payload.action,
              technician: payload.technician
            };
            maintenanceEvents = [entry, ...maintenanceEvents].slice(0, 30);
          }
          if (topic === "events.supply") {
            const entry: SupplyEvent = {
              supplierId: payload.supplier_id,
              timestamp: payload.ts ?? new Date().toISOString(),
              delayHours: payload.delay_hours,
              material: payload.material
            };
            supplyEvents = [entry, ...supplyEvents].slice(0, 30);
          }
          if (topic === "ai.agent.decisions") {
            console.log(`[agent] ${topic} raw payload keys:`, Object.keys(payload));
            console.log(`[agent] ${topic} payload.payload type:`, typeof payload.payload, payload.payload ? Object.keys(payload.payload) : "n/a");
            const inner = parsePayload(payload);
            console.log(`[agent] ${topic} parsed inner:`, JSON.stringify(inner).substring(0, 300));
            const entry: AgentInsight = {
              agent: inner.agent ?? "Operations Coordinator",
              summary: inner.summary ?? "Decision update",
              riskLevel: inner.risk_level ?? inner.riskLevel,
              riskScore: inner.risk_score ?? inner.riskScore,
              recommendedAction: inner.recommended_action ?? inner.recommendedAction,
              escalation: inner.escalation,
              confidence: inner.confidence,
              timestamp: new Date().toISOString()
            };
            agentDecisions = [entry, ...agentDecisions].slice(0, 20);
          }
          if (topic === "ai.agent.machine_health" || topic === "ai.agent.quality" || topic === "ai.agent.supply") {
            console.log(`[agent] ${topic} raw payload keys:`, Object.keys(payload));
            console.log(`[agent] ${topic} payload.payload type:`, typeof payload.payload, payload.payload ? Object.keys(payload.payload) : "n/a");
            const inner = parsePayload(payload);
            console.log(`[agent] ${topic} parsed inner:`, JSON.stringify(inner).substring(0, 300));
            const entry: AgentInsight = {
              agent: inner.agent ?? topic.replace("ai.agent.", ""),
              summary: inner.summary ?? "Agent update",
              riskLevel: inner.risk_level ?? inner.riskLevel,
              riskScore: inner.risk_score ?? inner.riskScore,
              recommendedAction: inner.recommended_action ?? inner.recommendedAction,
              escalation: inner.escalation,
              confidence: inner.confidence,
              timestamp: new Date().toISOString()
            };
            agentOutputs = [entry, ...agentOutputs].slice(0, 20);
            agents = agentOutputs;
          }
          if (topic === "alerts.acks") {
            const ack = (typeof parsed === "string" ? parsePayload(parsed) : payload) as AckEvent;
            if (ack?.id) {
              acks = { ...acks, [ack.id]: ack };
            }
          }
          publishState();
        } catch (err) {
          console.error(`[kafka] error processing ${topic} offset=${message.offset}:`, err);
        }
      }
    });

  };

  run().catch((err) => {
    console.error("Kafka consumer error", err);
  });
}

setInterval(() => {
  if (clients.length > 0) {
    clients.forEach((res) => res.write(": heartbeat\n\n"));
  }
}, 15000);

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
