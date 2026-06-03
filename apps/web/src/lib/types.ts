export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export type KpiSnapshot = {
  activeAlerts: number;
  downtimeRisk: number;
  throughput: number;
  defectProbability: number;
  supplyHealth: number;
  utilization: number;
  updatedAt: string;
};

export type AnomalyEvent = {
  id: string;
  severity: Severity;
  machineId: string;
  lineId: string;
  summary: string;
  timestamp: string;
};

export type AgentInsight = {
  agent: string;
  summary: string;
  riskLevel?: string;
  riskScore?: number;
  recommendedAction?: string;
  escalation?: string;
  confidence?: number;
  timestamp?: string;
};

export type MachineStatus = {
  machineId: string;
  lineId: string;
  vibrationHz: number;
  torqueNm: number;
  temperatureC: number;
  defectRate: number;
  lastUpdated: string;
  status: Severity;
};

export type AckEvent = {
  id: string;
  acknowledgedBy: string;
  timestamp: string;
};

export type QualityTelemetry = {
  lineId: string;
  timestamp: string;
  batchId: string;
  defectRate: number;
};

export type InventoryTelemetry = {
  partId: string;
  timestamp: string;
  stockLevel: number;
  consumptionRate: number;
};

export type MaintenanceEvent = {
  machineId: string;
  timestamp: string;
  action: string;
  technician: string;
};

export type SupplyEvent = {
  supplierId: string;
  timestamp: string;
  delayHours: number;
  material: string;
};
