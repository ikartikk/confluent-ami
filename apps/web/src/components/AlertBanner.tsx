"use client";

import { useEffect, useMemo, useState } from "react";
import { useStream } from "@/lib/StreamProvider";
import type { AnomalyEvent } from "@/lib/types";

const AUTO_DISMISS_MS = 5000;

export default function AlertBanner() {
  const { inPageAlerts } = useStream();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // Only show the most recent alert — one at a time
  const visible = inPageAlerts.filter((a) => !dismissed.has(a.id)).slice(0, 1);
  const visibleKey = useMemo(() => visible.map((a) => a.id).join(","), [visible]);

  const dismiss = (id: string) =>
    setDismissed((prev) => new Set([...prev, id]));

  // Auto-dismiss each alert after 5 seconds
  useEffect(() => {
    if (visible.length === 0) return;
    const timers = visible.map((a) =>
      setTimeout(() => dismiss(a.id), AUTO_DISMISS_MS)
    );
    return () => timers.forEach(clearTimeout);
  }, [visibleKey]);

  if (visible.length === 0) return null;

  const borderColor = (severity: string) =>
    severity === "CRITICAL" ? "border-l-critical" : "border-l-high";

  const labelColor = (severity: string) =>
    severity === "CRITICAL" ? "text-critical" : "text-high";

  const icon = (severity: string) =>
    severity === "CRITICAL" ? "🚨" : "⚠️";

  return (
    <div className="fixed left-1/2 top-4 z-50 w-full max-w-md -translate-x-1/2 px-4">
      {visible.map((alert: AnomalyEvent) => (
        <div
          key={alert.id}
          className={`flex items-start justify-between gap-3 rounded-xl border border-panel-border bg-panel border-l-4 ${borderColor(alert.severity)} px-4 py-3 shadow-lg`}
        >
          <div className="flex items-start gap-2.5 text-sm">
            <span className="mt-0.5 text-base leading-none">{icon(alert.severity)}</span>
            <div>
              <span className={`font-semibold ${labelColor(alert.severity)}`}>
                {alert.severity}
              </span>
              <span className="mx-1.5 text-muted">·</span>
              <span className="font-medium text-ink">{alert.machineId}</span>
              <span className="mx-1.5 text-muted">·</span>
              <span className="text-muted">{alert.lineId}</span>
              <p className="mt-0.5 text-xs text-muted">{alert.summary}</p>
            </div>
          </div>
          <button
            onClick={() => dismiss(alert.id)}
            className="mt-0.5 shrink-0 text-lg leading-none text-muted hover:text-ink"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
