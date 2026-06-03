 "use client";

import TopNav from "@/components/TopNav";
import KpiCard from "@/components/KpiCard";
import EventFeed from "@/components/EventFeed";
import AgentPanel from "@/components/AgentPanel";
import ChartCard from "@/components/ChartCard";
import { useStream } from "@/lib/useStream";
import type { KpiSnapshot } from "@/lib/types";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const stream = useStream();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const kpis = stream.smoothedKpis;

  const toChartPoints = (items: { ts: string; value: number }[]) =>
    items.map((item) => ({
      name: new Date(item.ts).toLocaleTimeString(),
      value: Math.round(item.value * 100) / 100
    }));

  const kpiToChart = (extract: (k: KpiSnapshot) => number) =>
    stream.kpiHistory.map((k) => ({
      name: new Date(k.updatedAt).toLocaleTimeString(),
      value: Math.round(extract(k) * 100) / 100
    }));

  const throughputTrend = kpiToChart((k) => k.throughput);
  const defectTrend = toChartPoints(stream.qualityHistory);
  const inventoryTrend = toChartPoints(stream.inventoryHistory);
  const supplyTrend = toChartPoints(stream.supplyHistory);

  const kpiTrend = (value: (item: KpiSnapshot) => number) => kpiToChart(value);

  return (
    <div className="space-y-6">
      <TopNav current="/" connection={stream.connection} />

      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard
          label="Active Critical Alerts"
          value={`${kpis.activeAlerts}`}
          helper={mounted ? `Updated ${new Date(kpis.updatedAt).toLocaleTimeString()}` : "Updated --"}
          trend={kpiTrend((item) => item.activeAlerts)}
          trendColor="#ef4444"
        />
        <KpiCard
          label="Predicted Downtime Risk"
          value={`${kpis.downtimeRisk.toFixed(1)}%`}
          trend={kpiTrend((item) => item.downtimeRisk)}
          trendColor="#f97316"
        />
        <KpiCard
          label="Production Throughput"
          value={`${kpis.throughput.toFixed(0)} units/hr`}
          trend={kpiTrend((item) => item.throughput)}
          trendColor="#0ea5e9"
        />
        <KpiCard
          label="Defect Probability"
          value={`${kpis.defectProbability.toFixed(1)}%`}
          trend={kpiTrend((item) => item.defectProbability)}
          trendColor="#f59e0b"
        />
        <KpiCard
          label="Supply Chain Health"
          value={`${kpis.supplyHealth.toFixed(0)}%`}
          trend={kpiTrend((item) => item.supplyHealth)}
          trendColor="#14b8a6"
        />
        <KpiCard
          label="Machine Utilization"
          value={`${kpis.utilization.toFixed(0)}%`}
          trend={kpiTrend((item) => item.utilization)}
          trendColor="#6366f1"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <AgentPanel insights={[...stream.agentDecisions, ...stream.agents]
            .sort((a, b) => {
              const riskOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
              const aRisk = riskOrder[a.riskLevel ?? "LOW"] ?? 4;
              const bRisk = riskOrder[b.riskLevel ?? "LOW"] ?? 4;
              if (aRisk !== bRisk) return aRisk - bRisk;
              return new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime();
            })
            .slice(0, 20)} />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <EventFeed events={stream.anomalies} />
          <ChartCard
            title="Throughput Trend"
            data={throughputTrend.length ? throughputTrend : [{ name: "Now", value: kpis.throughput }]}
            color="#0ea5e9"
          />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="Defect Rate (%)"
          data={defectTrend.length ? defectTrend : [{ name: "Now", value: kpis.defectProbability }]}
          color="#f97316"
        />
        <ChartCard
          title="Inventory Stock"
          data={inventoryTrend.length ? inventoryTrend : [{ name: "Now", value: 0 }]}
          color="#6366f1"
        />
        <ChartCard
          title="Supply Delay (hrs)"
          data={supplyTrend.length ? supplyTrend : [{ name: "Now", value: 0 }]}
          color="#14b8a6"
        />
      </section>
    </div>
  );
}
