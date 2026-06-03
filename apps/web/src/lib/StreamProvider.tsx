"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type {
  AckEvent,
  AnomalyEvent,
  AgentInsight,
  KpiSnapshot,
  MachineStatus,
  QualityTelemetry,
  InventoryTelemetry,
  MaintenanceEvent,
  SupplyEvent
} from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

type HistoryPoint = { ts: string; value: number };

type StreamState = {
  kpis: KpiSnapshot;
  anomalies: AnomalyEvent[];
  agents: AgentInsight[];
  machines: MachineStatus[];
  smoothedMachines: MachineStatus[];
  agentDecisions: AgentInsight[];
  acks: AckEvent[];
  qualityTelemetry: QualityTelemetry[];
  inventoryTelemetry: InventoryTelemetry[];
  maintenanceEvents: MaintenanceEvent[];
  supplyEvents: SupplyEvent[];
  connection: "connecting" | "live" | "reconnecting" | "offline";
  lastEventAt: string | null;
  kpiHistory: KpiSnapshot[];
  smoothedKpis: KpiSnapshot;
  qualityHistory: HistoryPoint[];
  inventoryHistory: HistoryPoint[];
  supplyHistory: HistoryPoint[];
};

const EMPTY_KPI: KpiSnapshot = {
  activeAlerts: 0,
  downtimeRisk: 0,
  throughput: 0,
  defectProbability: 0,
  supplyHealth: 0,
  utilization: 0,
  updatedAt: new Date().toISOString()
};

const fallbackState: StreamState = {
  kpis: { ...EMPTY_KPI },
  anomalies: [],
  agents: [],
  machines: [],
  smoothedMachines: [],
  agentDecisions: [],
  acks: [],
  qualityTelemetry: [],
  inventoryTelemetry: [],
  maintenanceEvents: [],
  supplyEvents: [],
  connection: "connecting",
  lastEventAt: null,
  kpiHistory: [],
  smoothedKpis: { ...EMPTY_KPI },
  qualityHistory: [],
  inventoryHistory: [],
  supplyHistory: []
};

const HISTORY_SIZE = 40;

const StreamContext = createContext<StreamState>(fallbackState);

export function StreamProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StreamState>(fallbackState);
  const eventsRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastEventAtRef = useRef<number>(0);
  const pendingPayloadRef = useRef<Record<string, any> | null>(null);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyTickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let active = true;

    const smoothValue = (prev: number, next: number, alpha = 0.25) =>
      Number.isFinite(prev) && Number.isFinite(next) ? prev + alpha * (next - prev) : next;

    const smoothKpis = (prev: KpiSnapshot, next: KpiSnapshot): KpiSnapshot => ({
      activeAlerts: Math.round(smoothValue(prev.activeAlerts, next.activeAlerts, 0.35)),
      downtimeRisk: smoothValue(prev.downtimeRisk, next.downtimeRisk),
      throughput: smoothValue(prev.throughput, next.throughput),
      defectProbability: smoothValue(prev.defectProbability, next.defectProbability),
      supplyHealth: smoothValue(prev.supplyHealth, next.supplyHealth),
      utilization: smoothValue(prev.utilization, next.utilization),
      updatedAt: next.updatedAt || new Date().toISOString()
    });

    const appendHistory = (prev: HistoryPoint[], value: number): HistoryPoint[] => {
      if (!Number.isFinite(value)) return prev;
      return [...prev, { ts: new Date().toISOString(), value }].slice(-HISTORY_SIZE);
    };

    historyTickRef.current = setInterval(() => {
      setState((prev) => {
        const k = prev.kpis;
        const hasData = k.throughput > 0 || k.downtimeRisk > 0 || k.utilization > 0;
        if (!hasData) return prev;

        const qualityAvg =
          prev.qualityTelemetry.length > 0
            ? prev.qualityTelemetry
                .slice(0, 10)
                .reduce((sum, item) => sum + item.defectRate, 0) /
              Math.min(prev.qualityTelemetry.length, 10)
            : undefined;

        const inventoryAvg =
          prev.inventoryTelemetry.length > 0
            ? prev.inventoryTelemetry
                .slice(0, 10)
                .reduce((sum, item) => sum + item.stockLevel, 0) /
              Math.min(prev.inventoryTelemetry.length, 10)
            : undefined;

        const supplyAvg =
          prev.supplyEvents.length > 0
            ? prev.supplyEvents
                .slice(0, 10)
                .reduce((sum, item) => sum + item.delayHours, 0) /
              Math.min(prev.supplyEvents.length, 10)
            : undefined;

        return {
          ...prev,
          kpiHistory: [...prev.kpiHistory, { ...k }].slice(-HISTORY_SIZE),
          qualityHistory:
            typeof qualityAvg === "number"
              ? appendHistory(prev.qualityHistory, qualityAvg * 100)
              : prev.qualityHistory,
          inventoryHistory:
            typeof inventoryAvg === "number"
              ? appendHistory(prev.inventoryHistory, inventoryAvg)
              : prev.inventoryHistory,
          supplyHistory:
            typeof supplyAvg === "number"
              ? appendHistory(prev.supplyHistory, supplyAvg)
              : prev.supplyHistory
        };
      });
    }, 5000);

    const fetchSnapshot = () => {
      fetch(`${API_BASE}/api/kpis`)
        .then((res) => res.json())
        .then((data) => {
          if (active && data?.kpis) {
            setState((prev) => ({
              ...prev,
              kpis: data.kpis,
              smoothedKpis: smoothKpis(prev.smoothedKpis, data.kpis),
              anomalies: data.anomalies ?? prev.anomalies,
              agents: data.agents ?? prev.agents,
              agentDecisions: data.agentDecisions ?? prev.agentDecisions,
              machines: data.machines ?? prev.machines,
              acks: data.acks ?? prev.acks,
              qualityTelemetry: data.qualityTelemetry ?? prev.qualityTelemetry,
              inventoryTelemetry: data.inventoryTelemetry ?? prev.inventoryTelemetry,
              maintenanceEvents: data.maintenanceEvents ?? prev.maintenanceEvents,
              supplyEvents: data.supplyEvents ?? prev.supplyEvents
            }));
          }
        })
        .catch(() => undefined);
    };

    fetchSnapshot();

    let retries = 0;

    const flushPayload = () => {
      if (!pendingPayloadRef.current) return;
      const payload = pendingPayloadRef.current;
      pendingPayloadRef.current = null;
      const nextKpis: KpiSnapshot | null = payload.kpis ?? null;
      const nextMachines: MachineStatus[] = payload.machines ?? [];

      setState((prev) => {
        const prevMachineMap = new Map(
          prev.smoothedMachines.map((m) => [m.machineId, m])
        );
        const smoothedMachines = nextMachines.map((machine) => {
          const prevMachine = prevMachineMap.get(machine.machineId);
          if (!prevMachine) return machine;
          return {
            ...machine,
            vibrationHz: smoothValue(prevMachine.vibrationHz, machine.vibrationHz),
            torqueNm: smoothValue(prevMachine.torqueNm, machine.torqueNm),
            temperatureC: smoothValue(prevMachine.temperatureC, machine.temperatureC),
            defectRate: smoothValue(prevMachine.defectRate, machine.defectRate)
          };
        });

        return {
          ...prev,
          kpis: payload.kpis ?? prev.kpis,
          anomalies: payload.anomalies ?? prev.anomalies,
          agents: payload.agents ?? prev.agents,
          machines: payload.machines ?? prev.machines,
          smoothedMachines: smoothedMachines.length
            ? smoothedMachines
            : prev.smoothedMachines,
          agentDecisions: payload.agentDecisions ?? prev.agentDecisions,
          acks: payload.acks ?? prev.acks,
          qualityTelemetry: payload.qualityTelemetry ?? prev.qualityTelemetry,
          inventoryTelemetry: payload.inventoryTelemetry ?? prev.inventoryTelemetry,
          maintenanceEvents: payload.maintenanceEvents ?? prev.maintenanceEvents,
          supplyEvents: payload.supplyEvents ?? prev.supplyEvents,
          connection: "live" as const,
          lastEventAt: new Date().toISOString(),
          smoothedKpis: nextKpis
            ? smoothKpis(prev.smoothedKpis, nextKpis)
            : prev.smoothedKpis
        };
      });
    };

    const connect = () => {
      if (!active) return;
      if (eventsRef.current) {
        eventsRef.current.close();
      }
      const events = new EventSource(`${API_BASE}/api/stream`);
      eventsRef.current = events;
      setState((prev) => ({
        ...prev,
        connection: retries > 0 ? "reconnecting" : "connecting"
      }));

      events.onopen = () => {
        retries = 0;
        lastEventAtRef.current = Date.now();
        setState((prev) => ({
          ...prev,
          connection: "live",
          lastEventAt: new Date().toISOString()
        }));
      };

      events.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          lastEventAtRef.current = Date.now();
          pendingPayloadRef.current = payload;
          if (!flushTimerRef.current) {
            flushTimerRef.current = setTimeout(() => {
              flushTimerRef.current = null;
              flushPayload();
            }, 250);
          }
        } catch {
          // ignore malformed payloads
        }
      };

      events.onerror = () => {
        events.close();
        if (!active) return;
        retries += 1;
        const delay = Math.min(15000, 1000 * 2 ** Math.min(retries, 4));
        setState((prev) => ({
          ...prev,
          connection: retries >= 5 ? "offline" : "reconnecting"
        }));
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => {
          fetchSnapshot();
          connect();
        }, delay);
      };
    };

    connect();

    heartbeatTimer.current = setInterval(() => {
      const elapsed = Date.now() - lastEventAtRef.current;
      if (lastEventAtRef.current && elapsed > 40000) {
        if (eventsRef.current) {
          eventsRef.current.close();
        }
        connect();
      }
    }, 15000);

    return () => {
      active = false;
      if (eventsRef.current) eventsRef.current.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (heartbeatTimer.current) clearInterval(heartbeatTimer.current);
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
      if (historyTickRef.current) clearInterval(historyTickRef.current);
    };
  }, []);

  return (
    <StreamContext.Provider value={state}>
      {children}
    </StreamContext.Provider>
  );
}

export function useStream() {
  return useContext(StreamContext);
}
