CREATE TABLE telemetry_robot (
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

CREATE TABLE telemetry_quality (
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

CREATE TABLE telemetry_inventory (
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

CREATE TABLE events_maintenance (
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

CREATE TABLE events_supply (
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

CREATE TABLE insights_anomalies (
  id STRING,
  machine_id STRING,
  line_id STRING,
  ts TIMESTAMP_LTZ(3),
  severity STRING,
  summary STRING,
  agent_insights ARRAY<ROW<agent STRING, summary STRING>>
) WITH (
  'connector' = 'kafka',
  'topic' = 'insights.anomalies',
  'properties.bootstrap.servers' = '${BOOTSTRAP_SERVERS}',
  'properties.security.protocol' = 'SASL_SSL',
  'properties.sasl.mechanism' = 'PLAIN',
  'properties.sasl.jaas.config' = 'org.apache.kafka.common.security.plain.PlainLoginModule required username="${KAFKA_API_KEY}" password="${KAFKA_API_SECRET}";',
  'format' = 'json'
);

CREATE TABLE kpis_rollup (
  active_alerts INT,
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
