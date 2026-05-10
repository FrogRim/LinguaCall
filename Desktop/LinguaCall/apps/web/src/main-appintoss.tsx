import './i18n';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import AppInToss from './AppInToss';
import './styles.css';

const ErrorFallback = () => (
  <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
    <p>문제가 발생했습니다. 아래 버튼으로 다시 시도해 주세요.</p>
    <button type="button" onClick={() => window.location.reload()}>
      새로고침
    </button>
  </div>
);

type ErrorFallbackBoundaryProps = {
  fallback: React.ReactNode;
  children: React.ReactNode;
};

class ErrorFallbackBoundary extends React.Component<
  ErrorFallbackBoundaryProps,
  { hasError: boolean }
> {
  constructor(props: ErrorFallbackBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(_error: unknown) {
    return;
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('app')!).render(
  <React.StrictMode>
    <ErrorFallbackBoundary fallback={<ErrorFallback />}>
      <HashRouter>
        <AppInToss />
      </HashRouter>
    </ErrorFallbackBoundary>
  </React.StrictMode>
);
