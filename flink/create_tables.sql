CREATE TABLE `telemetry.robot` (
  machine_id STRING,
  line_id STRING,
  ts TIMESTAMP_LTZ(3),
  vibration_hz DOUBLE,
  torque_nm DOUBLE,
  temperature_c DOUBLE,
  defect_rate DOUBLE,
  status STRING,
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'telemetry.robot',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE `telemetry.quality` (
  line_id STRING,
  ts TIMESTAMP_LTZ(3),
  batch_id STRING,
  defect_rate DOUBLE,
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'telemetry.quality',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE `telemetry.inventory` (
  part_id STRING,
  ts TIMESTAMP_LTZ(3),
  stock_level INT,
  consumption_rate DOUBLE,
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'telemetry.inventory',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE `events.maintenance` (
  machine_id STRING,
  ts TIMESTAMP_LTZ(3),
  action STRING,
  technician STRING,
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'events.maintenance',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE `events.supply` (
  supplier_id STRING,
  ts TIMESTAMP_LTZ(3),
  delay_hours DOUBLE,
  material STRING,
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'events.supply',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE `insights.anomalies` (
  `key` BYTES,
  id STRING,
  machine_id STRING,
  line_id STRING,
  ts TIMESTAMP_LTZ(3),
  severity STRING,
  summary STRING,
  agent_insights ARRAY<ROW<agent STRING, summary STRING>>,
  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND
) WITH (
  'connector' = 'kafka',
  'topic' = 'insights.anomalies',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json',
  'scan.startup.mode' = 'latest-offset'
);

CREATE TABLE `kpis.rollup` (
  `key` BYTES,
  active_alerts BIGINT,
  downtime_risk DOUBLE,
  throughput DOUBLE,
  defect_probability DOUBLE,
  supply_health DOUBLE,
  utilization DOUBLE,
  updated_at TIMESTAMP_LTZ(3)
) WITH (
  'connector' = 'kafka',
  'topic' = 'kpis.rollup',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

CREATE TABLE `ai.agent.machine_health` (
  `key` BYTES,
  payload STRING
) WITH (
  'connector' = 'kafka',
  'topic' = 'ai.agent.machine_health',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

CREATE TABLE `ai.agent.quality` (
  `key` BYTES,
  payload STRING
) WITH (
  'connector' = 'kafka',
  'topic' = 'ai.agent.quality',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

CREATE TABLE `ai.agent.supply` (
  `key` BYTES,
  payload STRING
) WITH (
  'connector' = 'kafka',
  'topic' = 'ai.agent.supply',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

CREATE TABLE `ai.agent.decisions` (
  `key` BYTES,
  payload STRING
) WITH (
  'connector' = 'kafka',
  'topic' = 'ai.agent.decisions',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

-- Sink: acks written by Flink's autonomous resolution agent
CREATE TABLE `alerts.acks` (
  `key` BYTES,
  id STRING,
  acknowledged_by STRING,
  timestamp_ms BIGINT
) WITH (
  'connector' = 'kafka',
  'topic' = 'alerts.acks',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

-- Sink: audit log of every autonomous action taken by Flink agents
CREATE TABLE `actions.taken` (
  `key` BYTES,
  anomaly_id STRING,
  machine_id STRING,
  severity STRING,
  action STRING,
  reason STRING,
  resolved_by STRING,
  ts TIMESTAMP_LTZ(3)
) WITH (
  'connector' = 'kafka',
  'topic' = 'actions.taken',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

-- Sink: anomalies escalated to human review by the autonomous agent
CREATE TABLE `alerts.escalated` (
  `key` BYTES,
  anomaly_id STRING,
  machine_id STRING,
  severity STRING,
  summary STRING,
  reason STRING,
  ts TIMESTAMP_LTZ(3)
) WITH (
  'connector' = 'kafka',
  'topic' = 'alerts.escalated',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);
