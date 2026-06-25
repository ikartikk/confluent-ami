**Autonomous Manufacturing Intelligence (AMI)** is a live "nervous system" for an automotive plant — it turns raw machine signals into operational intelligence and action in real time. Built for plant managers, reliability engineers, quality, and supply-chain teams.

## How it works

- **Ingest** — A Confluent producer streams telemetry, quality, inventory, and supply signals into Kafka topics.
- **Govern** — Schema Registry enforces a contract for every topic, keeping streams reliable and auditable.
- **Process** — Flink SQL cleans, correlates, and transforms the signals into live KPIs and anomalies.
- **Reason (AI in the stream)** — Flink SQL runs `AI_RUN_AGENT` directly on the anomaly stream. The AI lives *inside* Confluent, not in a bolted-on service; the dashboard and chatbot are read-only consumers of reasoning that already happened in the stream.

## Multi-agent pattern, inside Confluent

One anomaly fans out to four specialized agents — each an independent `AI_RUN_AGENT` statement in Flink SQL writing to its own governed topic:

- `machine_health_agent` → `ai.agent.machine_health`
- `quality_agent` → `ai.agent.quality`
- `supply_agent` → `ai.agent.supply`
- `operations_agent` → `ai.agent.decisions` (coordinator)

Genuine multi-agent orchestration in the streaming layer: **Kafka topics are the message bus, Flink is the runtime, Schema Registry is the contract.** Agents are decoupled, composable (add an agent = add a statement), and observable (every output is a durable topic).

## Closing the loop

When an operator acts on an alert, the acknowledgment is written back to Confluent as an `alerts.acks` event. Signal → AI reasoning → decision → human action → new governed event — the loop closes inside the stream, with a full audit trail and a foundation for tiered autonomy (routine actions auto-fire, high-stakes ones escalate).

## Also

- **Ask AMI** — a chatbot grounded strictly on live Confluent state; it answers from what's flowing now and refuses to invent readings.
- **Observability** — a `/health` endpoint and schema/latency probe prove the pipeline matches its contracts and measure end-to-end delay.

## Result

A production-grade, event-driven AI system that turns live factory signals into decisive action — staying ahead of failures, protecting quality, and keeping operations running.
