 "use client";

import TopNav from "@/components/TopNav";
import MachineCard from "@/components/MachineCard";
import GenericListCard from "@/components/GenericListCard";
import { useStream } from "@/lib/useStream";

export default function AssetsPage() {
  const stream = useStream();
  const machines = [...(stream.smoothedMachines.length ? stream.smoothedMachines : stream.machines)].sort((a, b) =>
    a.machineId.localeCompare(b.machineId)
  );
  return (
    <div className="space-y-6">
      <TopNav current="/assets" connection={stream.connection} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {machines.length === 0 ? (
          <p className="text-sm text-muted">No machine telemetry yet.</p>
        ) : (
          machines.map((machine) => (
            <MachineCard key={machine.machineId} machine={machine} />
          ))
        )}
      </div>
      <section className="grid gap-4 lg:grid-cols-2">
        <GenericListCard
          title="Quality Telemetry"
          items={stream.qualityTelemetry.slice(0, 8)}
          emptyLabel="No quality telemetry yet."
          renderItem={(item) => (
            <div>
              <div className="font-semibold">{item.lineId} · {item.batchId}</div>
              <div className="text-xs text-muted">
                Defect rate {(item.defectRate * 100).toFixed(2)}% · {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        />
        <GenericListCard
          title="Inventory Telemetry"
          items={stream.inventoryTelemetry.slice(0, 8)}
          emptyLabel="No inventory telemetry yet."
          renderItem={(item) => (
            <div>
              <div className="font-semibold">{item.partId}</div>
              <div className="text-xs text-muted">
                Stock {item.stockLevel} · Consumption {item.consumptionRate.toFixed(2)} · {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        />
        <GenericListCard
          title="Maintenance Events"
          items={stream.maintenanceEvents.slice(0, 8)}
          emptyLabel="No maintenance events yet."
          renderItem={(item) => (
            <div>
              <div className="font-semibold">{item.machineId} · {item.action}</div>
              <div className="text-xs text-muted">
                {item.technician} · {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        />
        <GenericListCard
          title="Supply Events"
          items={stream.supplyEvents.slice(0, 8)}
          emptyLabel="No supply events yet."
          renderItem={(item) => (
            <div>
              <div className="font-semibold">{item.supplierId} · {item.material}</div>
              <div className="text-xs text-muted">
                Delay {item.delayHours.toFixed(1)}h · {new Date(item.timestamp).toLocaleTimeString()}
              </div>
            </div>
          )}
        />
      </section>
    </div>
  );
}
