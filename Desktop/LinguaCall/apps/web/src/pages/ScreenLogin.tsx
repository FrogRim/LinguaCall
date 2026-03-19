import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@lingua/shared';
import PageLayout from '../components/layout/PageLayout';
import { CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowRight } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { apiClient, describeApiError } from '../lib/api';

export default function ScreenLogin() {
  const { clerkUserId, clearIdentity } = useUser();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const api = apiClient(clerkUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post<UserProfile>('/users/me', { name, email });
      navigate('/verify');
    } catch (err) {
      setError(describeApiError(err, 'user_bootstrap'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      <CardHeader className="px-8 pt-8 pb-2">
        <CardTitle className="text-xl tracking-tighter">Create your profile</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Enter your name and email to get started</p>
      </CardHeader>
      <CardContent className="px-8 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              className="h-11"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              className="h-11"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full gap-2" disabled={loading}>
            {loading ? 'Saving...' : <><span>Continue</span><ArrowRight className="w-4 h-4" /></>}
          </Button>
        </form>
        <div className="mt-6 pt-4 border-t flex items-center justify-between">
          <p className="text-xs text-muted-foreground">ID: {clerkUserId}</p>
          <button
            type="button"
            onClick={clearIdentity}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear identity
          </button>
        </div>
      </CardContent>
    </PageLayout>
  );
}
