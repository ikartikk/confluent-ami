import type { MachineStatus } from "@/lib/types";

const statusColors: Record<MachineStatus["status"], string> = {
  CRITICAL: "border-critical text-critical",
  HIGH: "border-high text-high",
  MEDIUM: "border-medium text-medium",
  LOW: "border-low text-low"
};

export default function MachineCard({ machine }: { machine: MachineStatus }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{machine.machineId}</p>
          <p className="text-xs text-muted">{machine.lineId}</p>
        </div>
        <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusColors[machine.status]}`}>
          {machine.status}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted">
        <div>Vibration: <span className="text-ink">{machine.vibrationHz.toFixed(1)} Hz</span></div>
        <div>Torque: <span className="text-ink">{machine.torqueNm.toFixed(1)} Nm</span></div>
        <div>Temp: <span className="text-ink">{machine.temperatureC.toFixed(1)} °C</span></div>
        <div>Defects: <span className="text-ink">{(machine.defectRate * 100).toFixed(1)}%</span></div>
      </div>
      <p className="mt-3 text-xs text-muted">Updated {new Date(machine.lastUpdated).toLocaleTimeString()}</p>
    </div>
  );
}
