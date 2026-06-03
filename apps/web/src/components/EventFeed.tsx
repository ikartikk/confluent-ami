import type { AnomalyEvent } from "@/lib/types";

const severityColors: Record<AnomalyEvent["severity"], string> = {
  CRITICAL: "text-critical",
  HIGH: "text-high",
  MEDIUM: "text-medium",
  LOW: "text-low"
};

export default function EventFeed({ events }: { events: AnomalyEvent[] }) {
  return (
    <div className="rounded-2xl border border-panel-border bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">Real-time Event Stream</h3>
        <span className="text-xs text-muted">{events.length} events</span>
      </div>
      <div className="mt-4 max-h-64 space-y-3 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm text-muted">Waiting for events...</p>
        ) : (
          events.slice(0, 20).map((event) => (
            <div key={event.id} className="text-sm">
              <span className={`font-semibold ${severityColors[event.severity]}`}>
                [{event.severity}]
              </span>{" "}
              {event.summary}{" "}
              <span className="text-xs text-muted">({event.machineId})</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
