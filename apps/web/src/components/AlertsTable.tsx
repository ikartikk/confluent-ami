"use client";

import type { AckEvent, AnomalyEvent } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

const SEVERITY_COLOR: Record<string, string> = {
  CRITICAL: "text-critical",
  HIGH: "text-high",
  MEDIUM: "text-medium",
  LOW: "text-low"
};

async function postAck(id: string, acknowledgedBy: string) {
  await fetch(`${API_BASE}/api/ack`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, acknowledgedBy })
  });
}

export default function AlertsTable({
  events,
  acks
}: {
  events: AnomalyEvent[];
  acks: AckEvent[];
}) {
  const ackById = new Map(acks.map((ack) => [ack.id, ack]));

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
              <th className="pb-2 min-w-[160px]">Action</th>
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
                const canAutoResolve = !ack && (event.severity === "LOW" || event.severity === "MEDIUM");
                const needsHuman = !ack && (event.severity === "CRITICAL" || event.severity === "HIGH");
                const isAutoResolved = ack?.acknowledgedBy === "ami-agent" || ack?.acknowledgedBy === "ami-flink";

                return (
                  <tr key={event.id} className="border-t border-panel-border">
                    <td className={`py-2 font-semibold ${SEVERITY_COLOR[event.severity] ?? ""}`}>
                      {event.severity}
                    </td>
                    <td className="py-2">{event.machineId}</td>
                    <td className="py-2">{event.lineId}</td>
                    <td className="py-2">{event.summary}</td>
                    <td className="py-2">{new Date(event.timestamp).toLocaleTimeString()}</td>
                    <td className="py-2">
                      {isAutoResolved ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-low/10 px-2 py-0.5 text-xs font-semibold text-low">
                          ✦ Resolved by AMI
                        </span>
                      ) : ack ? (
                        <span className="text-xs text-muted">
                          Acked by {ack.acknowledgedBy} {new Date(ack.timestamp).toLocaleTimeString()}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {canAutoResolve && (
                            <button
                              onClick={() => postAck(event.id, "ami-agent")}
                              className="rounded-full bg-low px-3 py-1 text-xs font-semibold text-white hover:opacity-90"
                            >
                              ✦ Auto-resolve
                            </button>
                          )}
                          {(canAutoResolve || needsHuman) && (
                            <button
                              onClick={() => postAck(event.id, "operator")}
                              className="rounded-full border border-panel-border bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-slate-50"
                            >
                              Acknowledge
                            </button>
                          )}
                        </div>
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
