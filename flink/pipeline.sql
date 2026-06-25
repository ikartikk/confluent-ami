EXECUTE STATEMENT SET
BEGIN

INSERT INTO `insights.anomalies` (
  key, agent_insights, id, line_id, machine_id, severity, summary, ts
)
SELECT
  CAST(NULL AS BYTES) AS key,
  ARRAY[
    ROW('Machine Health Agent', CONCAT('Vibration drift ', CAST(vibration_hz AS STRING), ' Hz')),
    ROW('Quality Agent', CONCAT('Defect rate ', CAST(defect_rate * 100 AS STRING), '%')),
    ROW('Supply Agent', 'Monitor spare-part buffer levels')
  ] AS agent_insights,
  CONCAT(machine_id, '-', CAST(ts AS STRING)) AS id,
  line_id,
  machine_id,
  CASE
    WHEN vibration_hz > 16.0 OR defect_rate > 0.035 THEN 'CRITICAL'
    WHEN vibration_hz > 14.0 OR defect_rate > 0.025 THEN 'HIGH'
    WHEN vibration_hz > 12.5 OR defect_rate > 0.018 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS severity,
  CONCAT('Robot ', machine_id, ' anomaly: vibration ', CAST(vibration_hz AS STRING),
         ' Hz, defect rate ', CAST(defect_rate AS STRING)) AS summary,
  ts
FROM `telemetry.robot`
WHERE vibration_hz > 12.5 OR defect_rate > 0.018;

INSERT INTO `insights.anomalies` (
  key, agent_insights, id, line_id, machine_id, severity, summary, ts
)
SELECT
  CAST(NULL AS BYTES) AS key,
  ARRAY[
    ROW('Quality Agent', CONCAT('Defect rate ', CAST(defect_rate * 100 AS STRING), '%'))
  ] AS agent_insights,
  CONCAT('quality-', line_id, '-', CAST(ts AS STRING)) AS id,
  line_id,
  CONCAT('LINE-', line_id) AS machine_id,
  CASE
    WHEN defect_rate > 0.035 THEN 'CRITICAL'
    WHEN defect_rate > 0.025 THEN 'HIGH'
    WHEN defect_rate > 0.018 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS severity,
  CONCAT('Quality alert: defect rate ', CAST(defect_rate AS STRING),
         ' for batch ', batch_id) AS summary,
  ts
FROM `telemetry.quality`
WHERE defect_rate > 0.018;

INSERT INTO `insights.anomalies` (
  key, agent_insights, id, line_id, machine_id, severity, summary, ts
)
SELECT
  CAST(NULL AS BYTES) AS key,
  ARRAY[
    ROW('Maintenance Agent', CONCAT('Action ', action, ' by ', technician))
  ] AS agent_insights,
  CONCAT('maintenance-', machine_id, '-', CAST(ts AS STRING)) AS id,
  'UNKNOWN' AS line_id,
  machine_id,
  CASE
    WHEN action = 'replace-bearing' THEN 'HIGH'
    WHEN action = 'lubricate' THEN 'MEDIUM'
    ELSE 'LOW'
  END AS severity,
  CONCAT('Maintenance event: ', action, ' by ', technician) AS summary,
  ts
FROM `events.maintenance`;

INSERT INTO `insights.anomalies` (
  key, agent_insights, id, line_id, machine_id, severity, summary, ts
)
SELECT
  CAST(NULL AS BYTES) AS key,
  ARRAY[
    ROW('Supply Agent', CONCAT('Delay ', CAST(delay_hours AS STRING), 'h for ', material))
  ] AS agent_insights,
  CONCAT('supply-', supplier_id, '-', CAST(ts AS STRING)) AS id,
  'UNKNOWN' AS line_id,
  supplier_id AS machine_id,
  CASE
    WHEN delay_hours > 4 THEN 'HIGH'
    WHEN delay_hours > 2 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS severity,
  CONCAT('Supply delay ', CAST(delay_hours AS STRING), 'h for ', material) AS summary,
  ts
FROM `events.supply`
WHERE delay_hours > 1;

INSERT INTO `insights.anomalies` (
  key, agent_insights, id, line_id, machine_id, severity, summary, ts
)
SELECT
  CAST(NULL AS BYTES) AS key,
  ARRAY[
    ROW('Inventory Agent', CONCAT('Stock ', CAST(stock_level AS STRING), ' for ', part_id))
  ] AS agent_insights,
  CONCAT('inventory-', part_id, '-', CAST(ts AS STRING)) AS id,
  'UNKNOWN' AS line_id,
  part_id AS machine_id,
  CASE
    WHEN stock_level < 60 THEN 'HIGH'
    WHEN stock_level < 100 THEN 'MEDIUM'
    ELSE 'LOW'
  END AS severity,
  CONCAT('Inventory alert: stock ', CAST(stock_level AS STRING),
         ' for ', part_id) AS summary,
  ts
FROM `telemetry.inventory`
WHERE stock_level < 120;

END;


EXECUTE STATEMENT SET
BEGIN

INSERT INTO `kpis.rollup` (
  key, active_alerts, defect_probability, downtime_risk,
  supply_health, throughput, updated_at, utilization
)
SELECT
  CAST(NULL AS BYTES) AS key,
  CAST(CASE WHEN vibration_hz > 20 OR defect_rate > 0.04 THEN 1 ELSE 0 END AS BIGINT) AS active_alerts,
  CAST(defect_rate * 100 AS DOUBLE) AS defect_probability,
  CAST(CASE WHEN vibration_hz > 20 THEN 75 ELSE 25 END AS DOUBLE) AS downtime_risk,
  CAST(90 - (defect_rate * 100) AS DOUBLE) AS supply_health,
  CAST(420 + (vibration_hz * 2) AS DOUBLE) AS throughput,
  ts AS updated_at,
  CAST(80 - (defect_rate * 100) AS DOUBLE) AS utilization
FROM `telemetry.robot`;

INSERT INTO `kpis.rollup` (
  key, active_alerts, defect_probability, downtime_risk,
  supply_health, throughput, updated_at, utilization
)
SELECT
  CAST(NULL AS BYTES) AS key,
  CAST(0 AS BIGINT) AS active_alerts,
  CAST(defect_rate * 100 AS DOUBLE) AS defect_probability,
  CAST(0.0 AS DOUBLE) AS downtime_risk,
  CAST(0.0 AS DOUBLE) AS supply_health,
  CAST(0.0 AS DOUBLE) AS throughput,
  ts AS updated_at,
  CAST(0.0 AS DOUBLE) AS utilization
FROM `telemetry.quality`;

INSERT INTO `kpis.rollup` (
  key, active_alerts, defect_probability, downtime_risk,
  supply_health, throughput, updated_at, utilization
)
SELECT
  CAST(NULL AS BYTES) AS key,
  CAST(0 AS BIGINT) AS active_alerts,
  CAST(0.0 AS DOUBLE) AS defect_probability,
  CAST(CASE
    WHEN action = 'replace-bearing' THEN 90
    WHEN action = 'lubricate' THEN 60
    ELSE 40
  END AS DOUBLE) AS downtime_risk,
  CAST(0.0 AS DOUBLE) AS supply_health,
  CAST(0.0 AS DOUBLE) AS throughput,
  ts AS updated_at,
  CAST(0.0 AS DOUBLE) AS utilization
FROM `events.maintenance`;

INSERT INTO `kpis.rollup` (
  key, active_alerts, defect_probability, downtime_risk,
  supply_health, throughput, updated_at, utilization
)
SELECT
  CAST(NULL AS BYTES) AS key,
  CAST(0 AS BIGINT) AS active_alerts,
  CAST(0.0 AS DOUBLE) AS defect_probability,
  CAST(0.0 AS DOUBLE) AS downtime_risk,
  CAST(CASE
    WHEN delay_hours > 6 THEN 40
    WHEN delay_hours > 3 THEN 70
    ELSE 90
  END AS DOUBLE) AS supply_health,
  CAST(0.0 AS DOUBLE) AS throughput,
  ts AS updated_at,
  CAST(0.0 AS DOUBLE) AS utilization
FROM `events.supply`;

INSERT INTO `kpis.rollup` (
  key, active_alerts, defect_probability, downtime_risk,
  supply_health, throughput, updated_at, utilization
)
SELECT
  CAST(NULL AS BYTES) AS key,
  CAST(0 AS BIGINT) AS active_alerts,
  CAST(0.0 AS DOUBLE) AS defect_probability,
  CAST(0.0 AS DOUBLE) AS downtime_risk,
  CAST(CASE
    WHEN stock_level < 60 THEN 40
    WHEN stock_level < 120 THEN 70
    ELSE 95
  END AS DOUBLE) AS supply_health,
  CAST(0.0 AS DOUBLE) AS throughput,
  ts AS updated_at,
  CAST(0.0 AS DOUBLE) AS utilization
FROM `telemetry.inventory`;

END;


INSERT INTO `ai.agent.machine_health`
SELECT
  CAST(NULL AS BYTES) AS key,
  agent_output.response AS payload
FROM `insights.anomalies` /*+ OPTIONS('scan.startup.mode'='latest-offset') */,
LATERAL TABLE(
  AI_RUN_AGENT(
    'machine_health_agent',
    CONCAT('Anomaly: ', summary),
    id,
    'agent_system_table',
    MAP['debug','false']
  )
) AS agent_output(status, response);


INSERT INTO `ai.agent.quality`
SELECT
  CAST(NULL AS BYTES) AS key,
  agent_output.response AS payload
FROM `insights.anomalies` /*+ OPTIONS('scan.startup.mode'='latest-offset') */,
LATERAL TABLE(
  AI_RUN_AGENT(
    'quality_agent',
    CONCAT('Anomaly: ', summary),
    id,
    'agent_system_table',
    MAP['debug','false']
  )
) AS agent_output(status, response);

INSERT INTO `ai.agent.supply`
SELECT
  CAST(NULL AS BYTES) AS key,
  agent_output.response AS payload
FROM `insights.anomalies` /*+ OPTIONS('scan.startup.mode'='latest-offset') */,
LATERAL TABLE(
  AI_RUN_AGENT(
    'supply_agent',
    CONCAT('Anomaly: ', summary),
    id,
    'agent_system_table',
    MAP['debug','false']
  )
) AS agent_output(status, response);

INSERT INTO `ai.agent.decisions`
SELECT
  CAST(NULL AS BYTES) AS key,
  agent_output.response AS payload
FROM `insights.anomalies` /*+ OPTIONS('scan.startup.mode'='latest-offset') */,
LATERAL TABLE(
  AI_RUN_AGENT(
    'operations_agent',
    CONCAT('Anomaly: ', summary),
    id,
    'agent_system_table',
    MAP['debug','false']
  )
) AS agent_output(status, response);


-- Agent 5: Autonomous Resolution Agent
-- LOW/MEDIUM anomalies only. AI decides YES (auto-resolve) or NO (escalate to human).
-- On YES: writes to alerts.acks + actions.taken (full audit trail, no human needed).
-- On NO:  writes to alerts.escalated (human approval required).
-- Agent 5 writes to actions.taken (audit log) AND conditionally to alerts.acks.
-- Two separate INSERTs: one always writes the audit record,
-- the second only writes the ack when AI says DECISION: YES.

INSERT INTO `actions.taken`
SELECT
  CAST(NULL AS BYTES)                                               AS key,
  id                                                                AS anomaly_id,
  machine_id,
  severity,
  CASE
    WHEN agent_output.response LIKE '%DECISION: YES%' THEN 'auto-resolved'
    ELSE 'escalated-to-human'
  END                                                               AS action,
  agent_output.response                                             AS reason,
  'ami-flink'                                                       AS resolved_by,
  CAST(ts AS STRING)                                                AS ts
FROM `insights.anomalies` /*+ OPTIONS('scan.startup.mode'='latest-offset') */,
LATERAL TABLE(
  AI_RUN_AGENT(
    'auto_resolve_agent',
    CONCAT(
      'Anomaly on machine ', machine_id, ' (', line_id, '). ',
      'Severity: ', severity, '. Details: ', summary, '. ',
      'Should this be auto-resolved or escalated to a human? ',
      'Reply with exactly: DECISION: YES or DECISION: NO. Then one sentence reason.'
    ),
    id,
    'agent_system_table',
    MAP['debug', 'false']
  )
) AS agent_output(status, response)
WHERE severity IN ('LOW', 'MEDIUM');

-- When AI approves, write the ack directly into alerts.acks.
-- The API reads this topic and surfaces "✦ Resolved by AMI" on the dashboard.
INSERT INTO `alerts.acks`
SELECT
  CAST(NULL AS BYTES)         AS key,
  id                          AS id,
  'ami-flink'                 AS acknowledgedBy,
  CAST(ts AS STRING)          AS `timestamp`
FROM `insights.anomalies` /*+ OPTIONS('scan.startup.mode'='latest-offset') */,
LATERAL TABLE(
  AI_RUN_AGENT(
    'auto_resolve_agent',
    CONCAT(
      'Anomaly on machine ', machine_id, ' (', line_id, '). ',
      'Severity: ', severity, '. Details: ', summary, '. ',
      'Should this be auto-resolved or escalated to a human? ',
      'Reply with exactly: DECISION: YES or DECISION: NO. Then one sentence reason.'
    ),
    id,
    'agent_system_table',
    MAP['debug', 'false']
  )
) AS agent_output(status, response)
WHERE severity IN ('LOW', 'MEDIUM')
  AND agent_output.response LIKE '%DECISION: YES%';
