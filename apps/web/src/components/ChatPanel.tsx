"use client";

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:4000";

const SUGGESTIONS = [
  "Which machine is at highest risk right now?",
  "Why is throughput where it is?",
  "Any open critical alerts?",
  "Summarize current supply health"
];

export default function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, pending]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || pending) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setInput("");
    setPending(true);
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: nextMessages.slice(-8).map((m) => ({ role: m.role, content: m.content }))
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: data?.error || "The assistant is unavailable right now.",
            error: true
          }
        ]);
      } else {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: data?.answer || "(no answer)" }
        ]);
      }
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Could not reach the assistant.", error: true }
      ]);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-ink/90"
      >
        Ask AMI
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* slide-over */}
          <div className="absolute right-0 inset-y-0 flex w-full max-w-md flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-panel-border px-5 py-4">
              <div>
                <p className="text-xs text-muted">Grounded in live Confluent data</p>
                <h2 className="text-lg font-semibold tracking-tight">Ask AMI</h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full px-2 py-1 text-muted transition hover:bg-slate-100 hover:text-ink"
                aria-label="Close chat"
              >
                ✕
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Ask about machines, anomalies, KPIs, supply, or root causes. Answers come
                    only from the live factory state streaming through Confluent.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => send(s)}
                        className="rounded-full border border-panel-border bg-panel px-3 py-1 text-xs text-ink transition hover:bg-slate-100"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div
                  key={i}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={[
                      "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm",
                      m.role === "user"
                        ? "bg-ink text-white"
                        : m.error
                        ? "border border-rose-200 bg-rose-50 text-rose-700"
                        : "border border-panel-border bg-panel text-ink"
                    ].join(" ")}
                  >
                    {m.content}
                  </div>
                </div>
              ))}

              {pending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl border border-panel-border bg-panel px-4 py-2 text-sm text-muted">
                    AMI is thinking…
                  </div>
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-panel-border px-5 py-4"
            >
              <div className="flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about the factory…"
                  className="flex-1 rounded-full border border-panel-border bg-panel px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  type="submit"
                  disabled={pending || !input.trim()}
                  className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
