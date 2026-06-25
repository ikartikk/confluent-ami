**Autonomous Manufacturing Intelligence (AMI)** is a live "nervous system" for an automotive plant — it turns raw machine signals into operational intelligence and autonomous action in real time. Built for plant managers, reliability engineers, quality, and supply-chain teams.

## How it works

- **Ingest** — A Confluent producer streams telemetry, quality, inventory, and supply signals into Kafka topics governed by Schema Registry contracts.
- **Govern** — Schema Registry enforces a contract for every topic with BACKWARD compatibility, keeping every stream reliable and auditable as it evolves.
- **Process** — Flink SQL cleans, correlates, and transforms signals into live KPIs and anomalies continuously.
- **Reason (AI native to the stream)** — Flink SQL invokes `AI_RUN_AGENT` directly on the anomaly stream. The AI lives *inside* Confluent — not in a bolted-on service. The dashboard and chatbot are read-only consumers of reasoning that already happened in the stream.

## Multi-agent pattern, inside Confluent

One anomaly fans out to **5 specialized agents** — each an independent `AI_RUN_AGENT` statement in Flink SQL writing to its own governed topic:

- `machine_health_agent` → `ai.agent.machine_health` — failure-mode and maintenance reasoning
- `quality_agent` → `ai.agent.quality` — defect-risk and batch-impact assessment
- `supply_agent` → `ai.agent.supply` — spare-part and supply-chain impact
- `operations_agent` → `ai.agent.decisions` — coordinator that synthesizes specialist signals
- `auto_resolve_agent` → `alerts.acks` + `actions.taken` — **autonomous resolution agent**

**Kafka topics are the message bus, Flink is the runtime, Schema Registry is the contract.** Agents are decoupled (each is an independent statement), composable (add an agent = add a statement), and observable (every output is a durable, governed topic).

## Tiered autonomous action loop

The 5th agent closes the loop without human intervention for routine cases:

1. LOW/MEDIUM anomaly arrives in `insights.anomalies`
2. `auto_resolve_agent` calls AI — replies `DECISION: YES` or `DECISION: NO`
3. **YES** → Flink writes directly to `alerts.acks` (`acknowledgedBy: "ami-flink"`) + audit record to `actions.taken`
4. **NO** → anomaly escalates to human approval on the dashboard

CRITICAL/HIGH anomalies always skip autonomous resolution and go straight to the human approval path — the system is designed for *responsible* autonomy, not blind automation.

Every decision — YES or NO — is a durable Kafka event with a full audit trail. The loop closes inside the streaming layer.

## Ask AMI — conversational intelligence

A chatbot grounded strictly on live Confluent state. It answers from what is flowing through Kafka right now and refuses to invent readings it cannot see in the stream.

## Observability & trust

- `/health` endpoint — Kafka connection state, per-topic message count, freshness, and produce→consume lag
- `tools/probe` — validates every live message against its schema contract and measures end-to-end latency

## Result

A production-grade, event-driven AI system where a machine signal becomes a governed Kafka event, Flink agents reason over it, and the system either acts autonomously or escalates intelligently — all within the streaming layer, with a full audit trail.
