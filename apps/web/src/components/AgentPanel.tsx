import type { AgentInsight } from "@/lib/types";

const agentThemes: Record<string, { icon: string; accent: string; border: string; bg: string }> = {
  "Machine Health Agent": { icon: "⚙️", accent: "text-orange-600", border: "border-orange-200", bg: "bg-orange-50/60" },
  "Quality Agent": { icon: "🔬", accent: "text-blue-600", border: "border-blue-200", bg: "bg-blue-50/60" },
  "Supply Chain Agent": { icon: "📦", accent: "text-teal-600", border: "border-teal-200", bg: "bg-teal-50/60" },
  "Supply Agent": { icon: "📦", accent: "text-teal-600", border: "border-teal-200", bg: "bg-teal-50/60" },
  "Operations Coordinator": { icon: "🎯", accent: "text-purple-600", border: "border-purple-200", bg: "bg-purple-50/60" }
};

const defaultTheme = { icon: "🤖", accent: "text-slate-600", border: "border-slate-200", bg: "bg-slate-50/60" };

const riskBadge: Record<string, string> = {
  CRITICAL: "bg-red-100 text-red-700 ring-red-200",
  HIGH: "bg-orange-100 text-orange-700 ring-orange-200",
  MEDIUM: "bg-yellow-100 text-yellow-700 ring-yellow-200",
  LOW: "bg-green-100 text-green-700 ring-green-200"
};

const riskBarColor: Record<string, string> = {
  CRITICAL: "#dc2626",
  HIGH: "#f97316",
  MEDIUM: "#eab308",
  LOW: "#16a34a"
};

function RiskBar({ score, level }: { score: number; level: string }) {
  const color = riskBarColor[level] ?? "#eab308";
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="h-2 flex-1 rounded-full bg-slate-100">
        <div
          className="h-2 rounded-full"
          style={{
            width: `${Math.min(100, score)}%`,
            backgroundColor: color,
            transition: "width 600ms ease"
          }}
        />
      </div>
      <span className="text-xs font-bold tabular-nums" style={{ color }}>{score}</span>
    </div>
  );
}

function AgentCard({ insight }: { insight: AgentInsight }) {
  const theme = agentThemes[insight.agent] ?? defaultTheme;
  const isCriticalOrHigh = insight.riskLevel === "CRITICAL" || insight.riskLevel === "HIGH";

  return (
    <div
      className={`rounded-lg border p-3 transition-all duration-200 ${
        isCriticalOrHigh
          ? `${theme.border} ${theme.bg} ring-1 ring-red-100 shadow`
          : `border-panel-border bg-white shadow-sm`
      }`}
    >
      {/* Row 1: Agent name + badge + risk score */}
      <div className="flex items-center gap-2">
        <span className="text-sm leading-none">{theme.icon}</span>
        <span className={`text-xs font-bold ${theme.accent} flex-1 truncate`}>{insight.agent}</span>
        {typeof insight.riskScore === "number" && (
          <RiskBar score={insight.riskScore} level={insight.riskLevel ?? "MEDIUM"} />
        )}
        {insight.riskLevel && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ring-1 ${riskBadge[insight.riskLevel] ?? "bg-slate-100 text-slate-600 ring-slate-200"}`}>
            {insight.riskLevel}
          </span>
        )}
      </div>

      {/* Row 2: Summary */}
      <p className="mt-1.5 text-xs leading-snug text-ink">{insight.summary}</p>

      {/* Row 3: Recommended Action (compact) */}
      {insight.recommendedAction && (
        <div className="mt-2 flex gap-1.5 rounded bg-slate-50 px-2 py-1.5">
          <svg className="mt-0.5 h-3 w-3 shrink-0 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-[11px] leading-snug text-muted">
            <span className="font-semibold text-ink">{insight.recommendedAction}</span>
          </p>
        </div>
      )}

      {/* Row 4: Footer metadata */}
      {(insight.escalation || typeof insight.confidence === "number" || insight.timestamp) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-3 text-[10px] text-muted">
          {insight.escalation && (
            <span>Escalate → <span className="font-bold text-high">{insight.escalation}</span></span>
          )}
          {typeof insight.confidence === "number" && (
            <span>Confidence: <span className="font-bold text-accent">{(insight.confidence * 100).toFixed(0)}%</span></span>
          )}
          {insight.timestamp && (
            <span className="ml-auto">{new Date(insight.timestamp).toLocaleTimeString()}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentPanel({ insights }: { insights: AgentInsight[] }) {
  const criticalHigh = insights.filter(
    (i) => i.riskLevel === "CRITICAL" || i.riskLevel === "HIGH"
  );
  const rest = insights.filter(
    (i) => i.riskLevel !== "CRITICAL" && i.riskLevel !== "HIGH"
  );

  return (
    <div className="rounded-2xl border border-panel-border bg-panel p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10">
            <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-xs font-bold uppercase tracking-wide text-ink">
            AI Agent Recommendations
          </h3>
        </div>
        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
          {insights.length} active
        </span>
      </div>

      <div className="mt-3 max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-6 text-muted">
            <svg className="h-6 w-6 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-xs">Waiting for agent insights...</p>
          </div>
        ) : (
          <>
            {criticalHigh.map((insight, i) => (
              <AgentCard key={`crit-${insight.agent}-${insight.timestamp ?? i}`} insight={insight} />
            ))}
            {criticalHigh.length > 0 && rest.length > 0 && (
              <div className="flex items-center gap-2 py-0.5">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-[9px] font-semibold uppercase tracking-wider text-muted">Other</span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>
            )}
            {rest.map((insight, i) => (
              <AgentCard key={`rest-${insight.agent}-${insight.timestamp ?? i}`} insight={insight} />
            ))}
          </>
        )}
      </div>
    </div>
  );
}
