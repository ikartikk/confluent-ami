import type { AgentInsight } from "@/lib/types";

const agentThemes: Record<string, { icon: string; gradient: string; accent: string; border: string }> = {
  "Machine Health Agent": {
    icon: "⚙️",
    gradient: "from-orange-500/10 to-orange-500/5",
    accent: "text-orange-600",
    border: "border-orange-200"
  },
  "Quality Agent": {
    icon: "🔬",
    gradient: "from-blue-500/10 to-blue-500/5",
    accent: "text-blue-600",
    border: "border-blue-200"
  },
  "Supply Chain Agent": {
    icon: "📦",
    gradient: "from-teal-500/10 to-teal-500/5",
    accent: "text-teal-600",
    border: "border-teal-200"
  },
  "Supply Agent": {
    icon: "📦",
    gradient: "from-teal-500/10 to-teal-500/5",
    accent: "text-teal-600",
    border: "border-teal-200"
  },
  "Operations Coordinator": {
    icon: "🎯",
    gradient: "from-purple-500/10 to-purple-500/5",
    accent: "text-purple-600",
    border: "border-purple-200"
  }
};

const defaultTheme = {
  icon: "🤖",
  gradient: "from-slate-500/10 to-slate-500/5",
  accent: "text-slate-600",
  border: "border-slate-200"
};

const riskConfig: Record<string, { bg: string; text: string; ring: string; glow: string; barColor: string }> = {
  CRITICAL: {
    bg: "bg-red-50",
    text: "text-red-700",
    ring: "ring-red-200",
    glow: "shadow-red-100",
    barColor: "#dc2626"
  },
  HIGH: {
    bg: "bg-orange-50",
    text: "text-orange-700",
    ring: "ring-orange-200",
    glow: "shadow-orange-100",
    barColor: "#f97316"
  },
  MEDIUM: {
    bg: "bg-yellow-50",
    text: "text-yellow-700",
    ring: "ring-yellow-200",
    glow: "shadow-yellow-100",
    barColor: "#eab308"
  },
  LOW: {
    bg: "bg-green-50",
    text: "text-green-700",
    ring: "ring-green-200",
    glow: "shadow-green-100",
    barColor: "#16a34a"
  }
};

const defaultRisk = riskConfig.MEDIUM;

function RiskGauge({ score, level }: { score: number; level: string }) {
  const config = riskConfig[level] ?? defaultRisk;
  const rotation = (score / 100) * 180 - 90;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative h-12 w-24 overflow-hidden">
        <svg viewBox="0 0 100 50" className="h-full w-full">
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 5 50 A 45 45 0 0 1 95 50"
            fill="none"
            stroke={config.barColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 141.37} 141.37`}
            style={{ transition: "stroke-dasharray 800ms ease" }}
          />
          <line
            x1="50"
            y1="50"
            x2="50"
            y2="12"
            stroke={config.barColor}
            strokeWidth="2"
            strokeLinecap="round"
            transform={`rotate(${rotation} 50 50)`}
            style={{ transition: "transform 800ms ease" }}
          />
          <circle cx="50" cy="50" r="3" fill={config.barColor} />
        </svg>
      </div>
      <span className={`text-lg font-bold ${config.text}`}>{score}</span>
      <span className="text-[10px] uppercase tracking-wider text-muted">Risk Score</span>
    </div>
  );
}

function AgentCard({ insight }: { insight: AgentInsight }) {
  const theme = agentThemes[insight.agent] ?? defaultTheme;
  const risk = riskConfig[insight.riskLevel ?? ""] ?? defaultRisk;
  const isCriticalOrHigh = insight.riskLevel === "CRITICAL" || insight.riskLevel === "HIGH";

  return (
    <div
      className={`rounded-xl border bg-gradient-to-br ${theme.gradient} ${
        isCriticalOrHigh ? `${theme.border} ring-1 ${risk.ring} ${risk.glow} shadow-md` : `border-panel-border shadow-sm`
      } p-4 transition-all duration-300`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl leading-none">{theme.icon}</span>
          <div>
            <p className={`text-sm font-bold ${theme.accent}`}>{insight.agent}</p>
            {insight.timestamp && (
              <p className="text-[10px] text-muted">
                {new Date(insight.timestamp).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
        {insight.riskLevel && (
          <span
            className={`rounded-md px-2.5 py-1 text-xs font-bold ${risk.bg} ${risk.text} ring-1 ${risk.ring}`}
          >
            {insight.riskLevel}
          </span>
        )}
      </div>

      {/* Body: Summary + Risk Gauge */}
      <div className="mt-3 flex items-start gap-4">
        <p className="flex-1 text-sm leading-relaxed text-ink">{insight.summary}</p>
        {typeof insight.riskScore === "number" && (
          <RiskGauge score={insight.riskScore} level={insight.riskLevel ?? "MEDIUM"} />
        )}
      </div>

      {/* Recommended Action */}
      {insight.recommendedAction && (
        <div className={`mt-3 rounded-lg border ${isCriticalOrHigh ? "border-red-200 bg-red-50/50" : "border-slate-200 bg-white"} p-3`}>
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-[11px] font-bold uppercase tracking-wide text-accent">
              Recommended Action
            </p>
          </div>
          <p className="mt-1.5 text-sm font-medium text-ink">{insight.recommendedAction}</p>
        </div>
      )}

      {/* Footer: Escalation + Confidence */}
      {(insight.escalation || typeof insight.confidence === "number") && (
        <div className="mt-3 flex flex-wrap items-center gap-4">
          {insight.escalation && (
            <div className="flex items-center gap-1.5">
              <svg className="h-3.5 w-3.5 text-high" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-xs text-muted">
                Escalate to <span className="font-bold text-high">{insight.escalation}</span>
              </span>
            </div>
          )}
          {typeof insight.confidence === "number" && (
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-16 rounded-full bg-slate-200">
                <div
                  className="h-1.5 rounded-full bg-accent"
                  style={{
                    width: `${insight.confidence * 100}%`,
                    transition: "width 600ms ease"
                  }}
                />
              </div>
              <span className="text-xs font-semibold text-accent">
                {(insight.confidence * 100).toFixed(0)}%
              </span>
              <span className="text-[10px] text-muted">confidence</span>
            </div>
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
    <div className="rounded-2xl border border-panel-border bg-panel p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10">
            <svg className="h-4 w-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold uppercase tracking-wide text-ink">
            AI Agent Recommendations
          </h3>
        </div>
        <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-semibold text-accent">
          {insights.length} active
        </span>
      </div>

      <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {insights.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-muted">
            <svg className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            <p className="text-sm">Waiting for agent insights...</p>
          </div>
        ) : (
          <>
            {criticalHigh.length > 0 && (
              <div className="space-y-3">
                {criticalHigh.map((insight, i) => (
                  <AgentCard
                    key={`${insight.agent}-${insight.timestamp ?? i}`}
                    insight={insight}
                  />
                ))}
              </div>
            )}
            {rest.length > 0 && (
              <div className="space-y-3">
                {criticalHigh.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    <div className="h-px flex-1 bg-slate-200" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                      Other Insights
                    </span>
                    <div className="h-px flex-1 bg-slate-200" />
                  </div>
                )}
                {rest.map((insight, i) => (
                  <AgentCard
                    key={`${insight.agent}-${insight.timestamp ?? i}`}
                    insight={insight}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
