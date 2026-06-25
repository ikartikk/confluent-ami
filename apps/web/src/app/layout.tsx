import "./globals.css";
import type { ReactNode } from "react";
import { StreamProvider } from "@/lib/StreamProvider";
import AlertBanner from "@/components/AlertBanner";

export const metadata = {
  title: "Autonomous Manufacturing Intelligence",
  description: "Real-time operational intelligence dashboard"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-100 text-ink">
        <StreamProvider>
          <AlertBanner />
          <div className="mx-auto max-w-7xl px-6 py-6">{children}</div>
        </StreamProvider>
      </body>
    </html>
  );
}
