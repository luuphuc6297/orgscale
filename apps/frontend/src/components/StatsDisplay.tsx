import type { CampaignStats } from '@mcm/shared-types';
import { Progress } from './ui/progress';

export function StatsDisplay({ stats }: { stats: CampaignStats }) {
  const sendPct = Math.round(stats.send_rate * 100);
  const openPct = Math.round(stats.open_rate * 100);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat label="Total" value={stats.total} />
      <Stat label="Sent" value={stats.sent} />
      <Stat label="Failed" value={stats.failed} />
      <Stat label="Opened" value={stats.opened} />
      <div className="col-span-2">
        <div className="flex justify-between text-sm mb-1"><span>Send rate</span><span>{sendPct}%</span></div>
        <Progress value={sendPct} />
      </div>
      <div className="col-span-2">
        <div className="flex justify-between text-sm mb-1"><span>Open rate</span><span>{openPct}%</span></div>
        <Progress value={openPct} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
