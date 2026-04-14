import { useEffect, useState, type ReactNode } from 'react';
import { Button, Text } from './components/tdsCompat';
import { bootstrapAuth } from './bootstrapAuth';

type AuthBootstrapStatus = 'loading' | 'ready' | 'error';

interface AuthBootstrapGateProps {
  children: ReactNode;
}

export function AuthBootstrapGate({ children }: AuthBootstrapGateProps) {
  const [status, setStatus] = useState<AuthBootstrapStatus>('loading');
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    bootstrapAuth()
      .then(() => {
        if (!cancelled) {
          setStatus('ready');
          setIsRetrying(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setIsRetrying(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [retryCount]);

  if (status === 'ready') {
    return <>{children}</>;
  }

  if (status === 'error' && !isRetrying) {
    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          gap: 12,
          textAlign: 'center',
          background: '#FFFFFF',
        }}
      >
        <Text typography="title2">앱 인증에 실패했어요</Text>
        <Text typography="body2" color="secondary">
          잠시 후 다시 시도해주세요.
        </Text>
        <Button
          onClick={() => {
            setIsRetrying(true);
            setRetryCount((count) => count + 1);
          }}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
        gap: 8,
        textAlign: 'center',
        background: '#FFFFFF',
      }}
    >
      <Text typography="title2">앱 인증을 준비하고 있어요...</Text>
      <Text typography="body2" color="secondary">
        Toss 사용자 정보를 확인하는 중입니다.
      </Text>
    </div>
  );
}
