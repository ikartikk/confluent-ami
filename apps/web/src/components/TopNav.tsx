import Link from "next/link";
import clsx from "clsx";
import ChatPanel from "@/components/ChatPanel";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/alerts", label: "Alerts" },
  { href: "/assets", label: "Assets" }
];

export default function TopNav({
  current,
  connection = "connecting"
}: {
  current: string;
  connection?: "connecting" | "live" | "reconnecting" | "offline";
}) {
  const status = {
    live: { label: "Live", className: "bg-emerald-100 text-emerald-700" },
    connecting: { label: "Connecting", className: "bg-slate-100 text-slate-600" },
    reconnecting: { label: "Reconnecting", className: "bg-amber-100 text-amber-700" },
    offline: { label: "Offline", className: "bg-rose-100 text-rose-700" }
  } as const;

  return (
    <div className="flex items-center justify-between border-b border-panel-border pb-4">
      <div>
        <p className="text-sm text-muted">Autonomous Manufacturing Intelligence</p>
        <h1 className="text-2xl font-semibold tracking-tight">Operations Console</h1>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${status[connection].className}`}
          aria-live="polite"
        >
          {status[connection].label}
        </span>
        <ChatPanel />
        <div className="flex gap-2 rounded-full bg-white px-3 py-2 shadow-sm ring-1 ring-panel-border">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={clsx(
              "rounded-full px-3 py-1 text-sm font-medium transition",
              current === link.href
                ? "bg-ink text-white"
                : "text-muted hover:text-ink"
            )}
          >
            {link.label}
          </Link>
        ))}
        </div>
      </div>
    </div>
  );
}
