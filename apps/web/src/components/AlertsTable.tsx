 "use client";

import type { AckEvent, AnomalyEvent } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

export default function AlertsTable({
  events,
  acks
}: {
  events: AnomalyEvent[];
  acks: AckEvent[];
}) {
  const ackById = new Map(acks.map((ack) => [ack.id, ack]));

  const handleAck = async (id: string) => {
    await fetch(`${API_BASE}/api/ack`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, acknowledgedBy: "operator" })
    });
  };

  return (
    <div className="rounded-2xl border border-panel-border bg-panel p-4 shadow-sm">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Active Alerts</h3>
      <div className="mt-4 max-h-[70vh] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="pb-2">Severity</th>
              <th className="pb-2">Machine</th>
              <th className="pb-2">Line</th>
              <th className="pb-2">Summary</th>
              <th className="pb-2">Time</th>
              <th className="pb-2">Ack</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-muted">
                  No alerts yet.
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const ack = ackById.get(event.id);
                return (
                  <tr key={event.id} className="border-t border-panel-border">
                    <td className="py-2 font-semibold">{event.severity}</td>
                    <td className="py-2">{event.machineId}</td>
                    <td className="py-2">{event.lineId}</td>
                    <td className="py-2">{event.summary}</td>
                    <td className="py-2">{new Date(event.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2">
                      {ack ? (
                        <span className="text-xs text-muted">
                          Acked {new Date(ack.timestamp).toLocaleTimeString()}
                        </span>
                      ) : (
                        <button
                          onClick={() => handleAck(event.id)}
                          className="rounded-full border border-panel-border bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-slate-50"
                        >
                          Acknowledge
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
