import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LogOut } from 'lucide-react';
import { useCampaignsList } from '@/hooks/useCampaigns';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/StatusBadge';

const PAGE_SIZE = 10;

export default function CampaignsListPage() {
  const [page, setPage] = useState(1);
  const navigate = useNavigate();
  const logout = useAuthStore((s) => s.logout);
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError } = useCampaignsList({ page, limit: PAGE_SIZE });

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          {user && <p className="text-sm text-muted-foreground">Signed in as {user.email}</p>}
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link to="/campaigns/new"><Plus className="mr-2 h-4 w-4" />New campaign</Link>
          </Button>
          <Button variant="outline" onClick={onLogout}><LogOut className="mr-2 h-4 w-4" />Sign out</Button>
        </div>
      </header>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      )}

      {isError && <p className="text-sm text-destructive">Failed to load campaigns.</p>}

      {data && data.data.length === 0 && (
        <Card className="p-8 text-center text-muted-foreground">
          No campaigns yet. Create your first one.
        </Card>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          {data.data.map((c) => (
            <Link key={c.id} to={`/campaigns/${c.id}`}>
              <Card className="p-4 hover:bg-accent/40 transition-colors">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-sm text-muted-foreground truncate">{c.subject}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {data && data.total > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <Button variant="outline" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {data.page} of {Math.ceil(data.total / data.limit)}
          </span>
          <Button variant="outline" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
