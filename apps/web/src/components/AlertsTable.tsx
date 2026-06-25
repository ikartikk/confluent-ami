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
          <colgroup>
            <col className="w-24" />   {/* Severity */}
            <col className="w-20" />   {/* Machine */}
            <col className="w-20" />   {/* Line */}
            <col />                    {/* Summary — takes remaining space */}
            <col className="w-20" />   {/* Time */}
            <col className="w-44" />   {/* Action — fixed, no wrapping */}
          </colgroup>
          <thead className="border-b border-panel-border text-xs font-medium text-muted">
            <tr>
              <th className="pb-2 pr-3">Severity</th>
              <th className="pb-2 pr-3">Machine</th>
              <th className="pb-2 pr-3">Line</th>
              <th className="pb-2 pr-3">Summary</th>
              <th className="pb-2 pr-3">Time</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody className="text-xs">
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-6 text-center text-muted">
                  No alerts yet.
                </td>
              </tr>
            ) : (
              events.map((event) => {
                const ack = ackById.get(event.id);
                const canAutoResolve = !ack && (event.severity === "LOW" || event.severity === "MEDIUM");
                const needsHuman = !ack && (event.severity === "CRITICAL" || event.severity === "HIGH");
                const isFlinkResolved = ack?.acknowledgedBy === "ami-flink";
                const isAutoResolved = ack?.acknowledgedBy === "ami-agent" || isFlinkResolved;

                return (
                  <tr key={event.id} className="border-t border-panel-border align-middle">
                    <td className={`py-2.5 pr-3 font-semibold ${SEVERITY_COLOR[event.severity] ?? ""}`}>
                      {event.severity}
                    </td>
                    <td className="py-2.5 pr-3 font-mono">{event.machineId}</td>
                    <td className="py-2.5 pr-3 text-muted">{event.lineId}</td>
                    <td className="py-2.5 pr-3 leading-relaxed">{event.summary}</td>
                    <td className="py-2.5 pr-3 tabular-nums text-muted">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2.5">
                      {isFlinkResolved ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-low/10 px-2.5 py-1 text-xs font-semibold text-low">
                          ✦ Flink Agent
                        </span>
                      ) : isAutoResolved ? (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-low/10 px-2.5 py-1 text-xs font-semibold text-low">
                          ✦ AMI resolved
                        </span>
                      ) : ack ? (
                        <span className="whitespace-nowrap text-xs text-muted">
                          ✓ {ack.acknowledgedBy} · {new Date(ack.timestamp).toLocaleTimeString()}
                        </span>
                      ) : canAutoResolve ? (
                        <button
                          onClick={() => postAck(event.id, "ami-agent")}
                          className="whitespace-nowrap rounded-full bg-low px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                        >
                          ✦ Auto-resolve
                        </button>
                      ) : needsHuman ? (
                        <button
                          onClick={() => postAck(event.id, "operator")}
                          className="whitespace-nowrap rounded-full border border-panel-border bg-white px-2.5 py-1 text-xs font-semibold text-ink hover:bg-slate-50"
                        >
                          Acknowledge
                        </button>
                      ) : null}
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
