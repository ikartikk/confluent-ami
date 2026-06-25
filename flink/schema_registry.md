# Schema Registry — Topic & Table Reference

All topics are registered in Confluent Schema Registry with **BACKWARD** compatibility.
JSON schemas live in `schemas/`. Flink table definitions live in `create_tables.sql`.

---

## Source Topics (simulator → Kafka)

### `telemetry.robot`
- **Direction:** Source (simulator produces)
- **Schema file:** `schemas/telemetry.robot.json`
- **Flink table:** `create_tables.sql` line 1
- **Watermark:** `ts - INTERVAL '5' SECOND`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `machine_id` | STRING | string | e.g. RB-22, WB-05 |
| `line_id` | STRING | string | e.g. Line-A, Line-B |
| `ts` | TIMESTAMP_LTZ(3) | string (date-time) | Event time |
| `vibration_hz` | DOUBLE | number | 6.0–30.0 Hz |
| `torque_nm` | DOUBLE | number | 18.0–55.0 Nm |
| `temperature_c` | DOUBLE | number | 40.0–110.0 °C |
| `defect_rate` | DOUBLE | number | 0.0–0.12 |
| `status` | STRING | string enum | CRITICAL / HIGH / MEDIUM / LOW |

---

### `telemetry.quality`
- **Direction:** Source (simulator produces)
- **Schema file:** `schemas/telemetry.quality.json`
- **Flink table:** `create_tables.sql` line 22
- **Watermark:** `ts - INTERVAL '5' SECOND`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `line_id` | STRING | string | e.g. Line-A |
| `ts` | TIMESTAMP_LTZ(3) | string (date-time) | |
| `batch_id` | STRING | string | e.g. B-442 |
| `defect_rate` | DOUBLE | number | 0.0–0.10 |

---

### `telemetry.inventory`
- **Direction:** Source (simulator produces)
- **Schema file:** `schemas/telemetry.inventory.json`
- **Flink table:** `create_tables.sql` line 39
- **Watermark:** `ts - INTERVAL '5' SECOND`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `part_id` | STRING | string | e.g. PT-bearing-A |
| `ts` | TIMESTAMP_LTZ(3) | string (date-time) | |
| `stock_level` | INT | integer | Units in stock |
| `consumption_rate` | DOUBLE | number | Units/minute |

---

### `events.maintenance`
- **Direction:** Source (simulator produces)
- **Schema file:** `schemas/events.maintenance.json`
- **Flink table:** `create_tables.sql` line 56
- **Watermark:** `ts - INTERVAL '5' SECOND`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `machine_id` | STRING | string | |
| `ts` | TIMESTAMP_LTZ(3) | string (date-time) | |
| `action` | STRING | string | replace-bearing / lubricate / inspect |
| `technician` | STRING | string | Faker-generated name |

---

### `events.supply`
- **Direction:** Source (simulator produces)
- **Schema file:** `schemas/events.supply.json`
- **Flink table:** `create_tables.sql` line 73
- **Watermark:** `ts - INTERVAL '5' SECOND`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `supplier_id` | STRING | string | SUP-1 to SUP-5 |
| `ts` | TIMESTAMP_LTZ(3) | string (date-time) | |
| `delay_hours` | DOUBLE | number | 0.1–12.0 hours |
| `material` | STRING | string | bearings / seals / nozzles / sensors / filters |

---

## Flink Sink Topics (Flink → Kafka)

### `insights.anomalies`
- **Direction:** Flink sink (written by anomaly detection statements)
- **Schema file:** `schemas/insights.anomalies.json`
- **Flink table:** `create_tables.sql` line 90
- **Watermark:** `ts - INTERVAL '5' SECOND`
- **Consumers:** API, all 4 specialist agents, `auto_resolve_agent`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `key` | BYTES | — | Null key |
| `id` | STRING | string | `machine_id-ts` composite |
| `machine_id` | STRING | string | |
| `line_id` | STRING | string | |
| `ts` | TIMESTAMP_LTZ(3) | string (date-time) | |
| `severity` | STRING | string enum | CRITICAL / HIGH / MEDIUM / LOW |
| `summary` | STRING | string | Human-readable description |
| `agent_insights` | ARRAY<ROW> | array | Pre-populated agent hints |

---

### `kpis.rollup`
- **Direction:** Flink sink (written by KPI rollup statements)
- **Schema file:** `schemas/kpis.rollup.json`
- **Flink table:** `create_tables.sql` line 111
- **Consumers:** API → dashboard KPI cards

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `key` | BYTES | — | Null key |
| `active_alerts` | BIGINT | integer | |
| `downtime_risk` | DOUBLE | number | 0–100 |
| `throughput` | DOUBLE | number | Units/hour |
| `defect_probability` | DOUBLE | number | 0–100 |
| `supply_health` | DOUBLE | number | 0–100 |
| `utilization` | DOUBLE | number | 0–100 |
| `updated_at` | TIMESTAMP_LTZ(3) | string (date-time) | |

---

## AI Agent Output Topics (Flink AI_RUN_AGENT → Kafka)

All four specialist agent topics share the same schema structure.

### `ai.agent.machine_health` · `ai.agent.quality` · `ai.agent.supply` · `ai.agent.decisions`
- **Direction:** Flink sink (`AI_RUN_AGENT` writes)
- **Schema files:** `schemas/ai.agent.*.json`
- **Flink tables:** `create_tables.sql` lines 130–180
- **Consumers:** API → dashboard Agent Panel

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `key` | BYTES | — | Null key |
| `payload` | STRING | string | JSON string containing agent response |

---

## Action Loop Topics (closed-loop autonomous resolution)

### `alerts.acks`
- **Direction:** Sink — written by both API (human acks) and Flink `auto_resolve_agent`
- **Schema file:** `schemas/alerts.acks.json`
- **Flink table:** `create_tables.sql` line 184
- **Connector:** `confluent` / `json-registry`
- **Sunk to:** MongoDB Atlas `ami.alerts.acks`
- **Consumers:** API → dashboard Action column

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `id` | STRING | string | Anomaly ID being acknowledged |
| `acknowledgedBy` | STRING | string | `operator` / `ami-agent` / `ami-flink` |
| `timestamp` | STRING | string (date-time) | ISO 8601 |

---

### `actions.taken`
- **Direction:** Flink sink (`auto_resolve_agent` writes every LOW/MEDIUM decision)
- **Schema file:** `schemas/actions.taken.json`
- **Flink table:** `create_tables.sql` line 194
- **Connector:** `confluent` / `json-registry`
- **Sunk to:** MongoDB Atlas `ami.actions.taken`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `anomaly_id` | STRING | string | Source anomaly ID |
| `machine_id` | STRING | string | |
| `severity` | STRING | string | LOW or MEDIUM |
| `action` | STRING | string | `auto-resolved` / `escalated-to-human` |
| `reason` | STRING | string | Full AI agent response text |
| `resolved_by` | STRING | string | `ami-flink` |
| `ts` | STRING | string (date-time) | |

---

### `alerts.escalated`
- **Direction:** Flink sink (`auto_resolve_agent` writes when DECISION: NO)
- **Schema file:** `schemas/alerts.escalated.json`
- **Flink table:** `create_tables.sql` line 208
- **Connector:** `confluent` / `json-registry`

| Field | Flink Type | JSON Type | Notes |
|---|---|---|---|
| `anomaly_id` | STRING | string | |
| `machine_id` | STRING | string | |
| `severity` | STRING | string | |
| `summary` | STRING | string | Original anomaly summary |
| `reason` | STRING | string | Why AI escalated to human |
| `ts` | STRING | string (date-time) | |

---

## Summary Table

| Topic | Direction | Schema Registry | Flink Table | MongoDB Sink |
|---|---|---|---|---|
| `telemetry.robot` | Source | ✅ | ✅ | ❌ |
| `telemetry.quality` | Source | ✅ | ✅ | ❌ |
| `telemetry.inventory` | Source | ✅ | ✅ | ❌ |
| `events.maintenance` | Source | ✅ | ✅ | ❌ |
| `events.supply` | Source | ✅ | ✅ | ❌ |
| `insights.anomalies` | Flink sink | ✅ | ✅ | ✅ |
| `kpis.rollup` | Flink sink | ✅ | ✅ | ❌ |
| `ai.agent.machine_health` | Flink sink | ✅ | ✅ | ❌ |
| `ai.agent.quality` | Flink sink | ✅ | ✅ | ❌ |
| `ai.agent.supply` | Flink sink | ✅ | ✅ | ❌ |
| `ai.agent.decisions` | Flink sink | ✅ | ✅ | ❌ |
| `alerts.acks` | Dual (API + Flink) | ✅ | ✅ | ✅ |
| `actions.taken` | Flink sink | ✅ | ✅ | ✅ |
| `alerts.escalated` | Flink sink | ✅ | ✅ | ❌ |
