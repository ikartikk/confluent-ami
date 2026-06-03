 "use client";

import TopNav from "@/components/TopNav";
import AlertsTable from "@/components/AlertsTable";
import { useStream } from "@/lib/StreamProvider";

export default function AlertsPage() {
  const stream = useStream();
  return (
    <div className="space-y-6">
      <TopNav current="/alerts" connection={stream.connection} />
      <AlertsTable events={stream.anomalies} acks={stream.acks} />
    </div>
  );
}
