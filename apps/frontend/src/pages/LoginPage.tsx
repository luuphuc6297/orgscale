import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useLogin, useRegister } from '@/hooks/useAuth';
import { apiErrorMessage } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Demo User');
  const navigate = useNavigate();
  const login = useLogin();
  const register = useRegister();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === 'register') {
        await register.mutateAsync({ email, password, name });
        toast.success('Account created — please sign in.');
        setMode('login');
      } else {
        await login.mutateAsync({ email, password });
        navigate('/campaigns');
      }
    } catch (err) {
      toast.error(apiErrorMessage(err));
    }
  };

  const isLoading = login.isPending || register.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Mini Campaign Manager</CardTitle>
          <CardDescription>
            {mode === 'login' ? 'Sign in to manage your campaigns' : 'Create a new account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <button
              type="button"
              className="text-sm text-muted-foreground hover:underline w-full text-center"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? "Don't have an account? Register" : 'Already have an account? Sign in'}
            </button>
            {import.meta.env.DEV && (
              <p className="text-xs text-muted-foreground text-center mt-2">
                Demo creds: demo@example.com / password123
              </p>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
