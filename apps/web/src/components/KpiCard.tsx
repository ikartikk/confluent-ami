import { useId } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

type TrendPoint = { name: string; value: number };

type Props = {
  label: string;
  value: string;
  helper?: string;
  trend?: TrendPoint[];
  trendColor?: string;
};

export default function KpiCard({ label, value, helper, trend, trendColor = "#0ea5e9" }: Props) {
  const gradientId = useId();

  return (
    <div className="rounded-2xl border border-panel-border bg-panel p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-2 text-2xl font-semibold">{value}</p>
        </div>
        {trend && trend.length > 1 ? (
          <div className="h-10 w-24 sparkline-smooth">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={trendColor} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={trendColor} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={trendColor}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  dot={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : null}
      </div>
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
    </div>
  );
}
