import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send, Calendar, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import {
  useCampaignDetail,
  useDeleteCampaign,
  useScheduleCampaign,
  useSendCampaign,
} from '@/hooks/useCampaigns';
import { apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/StatusBadge';
import { StatsDisplay } from '@/components/StatsDisplay';

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCampaignDetail(id);
  const send = useSendCampaign(id!);
  const schedule = useScheduleCampaign(id!);
  const del = useDeleteCampaign();
  const [scheduledFor, setScheduledFor] = useState('');

  const onSend = async () => {
    try {
      await send.mutateAsync();
      toast.success('Sending started.');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const onSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const iso = new Date(scheduledFor).toISOString();
      await schedule.mutateAsync({ scheduledAt: iso });
      toast.success('Campaign scheduled.');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const onDelete = async () => {
    if (!confirm('Delete this draft?')) return;
    try {
      await del.mutateAsync(id!);
      toast.success('Campaign deleted.');
      navigate('/campaigns');
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }
  if (isError || !data) {
    return <div className="max-w-4xl mx-auto px-4 py-8"><p className="text-destructive">Campaign not found.</p></div>;
  }

  const isDraft = data.status === 'draft';
  const minDateTime = new Date(Date.now() + 60_000).toISOString().slice(0, 16);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/campaigns"><ArrowLeft className="mr-2 h-4 w-4" />Back to campaigns</Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-semibold">{data.name}</h1>
            <StatusBadge status={data.status} />
          </div>
          <p className="text-muted-foreground">{data.subject}</p>
          {data.scheduledAt && (
            <p className="text-sm text-muted-foreground">
              Scheduled for {format(new Date(data.scheduledAt), 'PPpp')}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(isDraft || data.status === 'scheduled') && (
            <Button onClick={onSend} disabled={send.isPending}>
              <Send className="mr-2 h-4 w-4" />{send.isPending ? 'Sending…' : 'Send now'}
            </Button>
          )}
          {isDraft && (
            <Button variant="destructive" onClick={onDelete} disabled={del.isPending}>
              <Trash2 className="mr-2 h-4 w-4" />Delete
            </Button>
          )}
        </div>
      </header>

      <Card>
        <CardHeader><CardTitle>Stats</CardTitle></CardHeader>
        <CardContent><StatsDisplay stats={data.stats} /></CardContent>
      </Card>

      {isDraft && (
        <Card>
          <CardHeader><CardTitle>Schedule</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onSchedule} className="flex items-end gap-2 flex-wrap">
              <div className="space-y-1 flex-1 min-w-[220px]">
                <Label htmlFor="schedule">Send at</Label>
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                  min={minDateTime}
                  required
                />
              </div>
              <Button type="submit" disabled={schedule.isPending}>
                <Calendar className="mr-2 h-4 w-4" />{schedule.isPending ? 'Scheduling…' : 'Schedule'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Body</CardTitle></CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap font-sans text-sm">{data.body}</pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recipients ({data.recipients.length})</CardTitle></CardHeader>
        <CardContent>
          <div className="divide-y">
            {data.recipients.map((r) => (
              <div key={r.recipientId} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate">{r.email}</span>
                <div className="flex gap-2 shrink-0">
                  <Badge variant="outline">{r.status}</Badge>
                  {r.openedAt && <Badge variant="secondary">opened</Badge>}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
