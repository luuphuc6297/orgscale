import type { CampaignStatus } from '@mcm/shared-types';
import { cn } from '@/lib/utils';

const STYLES: Record<CampaignStatus, string> = {
  draft: 'bg-slate-200 text-slate-800',
  scheduled: 'bg-blue-100 text-blue-800',
  sending: 'bg-amber-100 text-amber-800 animate-pulse',
  sent: 'bg-green-100 text-green-800',
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize', STYLES[status])}>
      {status}
    </span>
  );
}
