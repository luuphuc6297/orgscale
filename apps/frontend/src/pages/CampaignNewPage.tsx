import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useCreateCampaign } from '@/hooks/useCampaigns';
import { apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RecipientEmailsInput } from '@/components/RecipientEmailsInput';

export default function CampaignNewPage() {
  const navigate = useNavigate();
  const create = useCreateCampaign();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientEmails, setRecipientEmails] = useState<string[]>([]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (recipientEmails.length === 0) {
      toast.error('Add at least one recipient email.');
      return;
    }
    try {
      const c = await create.mutateAsync({ name, subject, body, recipientEmails });
      toast.success('Campaign created.');
      navigate(`/campaigns/${c.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/campaigns"><ArrowLeft className="mr-2 h-4 w-4" />Back to campaigns</Link>
        </Button>
      </div>
      <Card>
        <CardHeader><CardTitle>New campaign</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} placeholder="Q4 Newsletter" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={200} placeholder="Big news inside…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Body</Label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
                rows={6}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="Hello {{name}}, …"
              />
            </div>
            <div className="space-y-2">
              <Label>Recipients</Label>
              <RecipientEmailsInput value={recipientEmails} onChange={setRecipientEmails} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/campaigns')}>Cancel</Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending ? 'Creating…' : 'Create draft'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
