import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UserProfile } from '@lingua/shared';
import PageLayout from '../components/layout/PageLayout';
import { CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ArrowRight, ChevronLeft } from 'lucide-react';
import { useUser } from '../context/UserContext';
import { apiClient, describeApiError } from '../lib/api';

export default function ScreenVerify() {
  const { clerkUserId } = useUser();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('+8210');
  const [otp, setOtp] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const api = apiClient(clerkUserId);

  const sendCode = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.post<{ maskedPhone: string; debugCode: string }>(
        '/users/phone/start',
        { phone }
      );
      setMessage(`Sent to ${result.maskedPhone} (dev code: ${result.debugCode})`);
      setShowOtp(true);
    } catch (err) {
      setError(describeApiError(err, 'phone_start'));
    } finally {
      setLoading(false);
    }
  };

  const confirmCode = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post<UserProfile>('/users/phone/confirm', { phone, code: otp });
      navigate('/session');
    } catch (err) {
      setError(describeApiError(err, 'phone_confirm'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout>
      <CardHeader className="px-8 pt-8 pb-2">
        <CardTitle className="text-xl tracking-tighter">Phone Verification</CardTitle>
        <p className="text-sm text-muted-foreground mt-1">Verify your phone number to continue</p>
      </CardHeader>
      <CardContent className="px-8 pb-8 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            className="h-11"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="+8210XXXXXXXX"
            disabled={showOtp}
          />
        </div>

        {!showOtp && (
          <Button onClick={() => void sendCode()} disabled={loading} className="w-full gap-2">
            {loading ? 'Sending...' : <><span>Send Verification Code</span><ArrowRight className="w-4 h-4" /></>}
          </Button>
        )}

        {message && (
          <div className="rounded-md bg-secondary border border-border px-4 py-3 text-sm text-secondary-foreground">
            {message}
          </div>
        )}

        {showOtp && (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="otp">Verification Code</Label>
              <Input
                id="otp"
                className="h-11 tracking-widest text-center text-lg"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="000000"
                maxLength={6}
                autoFocus
              />
            </div>
            <Button onClick={() => void confirmCode()} disabled={loading} className="w-full gap-2">
              {loading ? 'Verifying...' : <><span>Confirm</span><ArrowRight className="w-4 h-4" /></>}
            </Button>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button variant="ghost" className="w-full gap-1 text-muted-foreground" onClick={() => navigate('/')}>
          <ChevronLeft className="w-4 h-4" />
          Back to Login
        </Button>
      </CardContent>
    </PageLayout>
  );
}
