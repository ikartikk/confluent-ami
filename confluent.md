What it is:
The Autonomous Manufacturing Intelligence Platform is a live, always‑on “nervous system” for an automotive plant. It converts raw machine signals and production events into operational intelligence in real time.

Who it’s for:
Automotive manufacturers—plant managers, reliability engineers, quality leads, and supply‑chain teams—who need immediate visibility into what’s happening on the line and why.

How it works (with the required capabilities):

Producers / Connectors act like sensory nerves, pulling data from industrial sources into Kafka topics. (Today a Confluent producer client streams the signals; managed Confluent Connectors are the production-grade ingestion path on the roadmap.)
Stream Governance is the safety rail: Schema Registry registers an explicit contract for every topic, keeping every stream reliable, auditable, and trustworthy as it evolves.
Stream Processing with Flink SQL performs the heavy lifting in real time—cleaning, validating, transforming, and correlating telemetry, quality, inventory, and supply signals into actionable KPIs and anomalies.
Flink AI Model Inference runs inside the stream (`AI_RUN_AGENT`) to generate root‑cause explanations, maintenance recommendations, defect‑risk assessments, and supply‑chain impact predictions into `ai.agent.*` topics.

Ask AMI — conversational intelligence:
A natural-language assistant lets operators ask the factory anything ("which machine is at highest risk?", "why is Line-B's defect rate up?"). It is grounded strictly on live Confluent state — the data materialized from Kafka topics, never the raw simulator — so its answers reflect exactly what is flowing through the stream right now, and it refuses to invent readings it cannot see.

Observability & trust:
A `/health` endpoint surfaces Kafka connection state and per-topic freshness/lag, and a schema-and-latency probe (`tools/probe`) continuously proves that what producers emit matches the governed contracts and measures end-to-end delay — making the pipeline verifiable, not just functional.

What it delivers (benefits):

Earlier warnings before a machine fails or defects spread.
Faster decisions because AI insights arrive as events unfold, not hours later—and operators can interrogate the live state in plain language.
Lower downtime and cost, higher throughput, and stronger manufacturing resilience.
The result:
A production‑grade, event‑driven AI system that turns live factory signals into decisive action—helping manufacturers stay ahead of failures, protect quality, and keep operations running smoothly.


