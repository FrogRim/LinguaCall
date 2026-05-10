import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppsInTossAuthProvider, useAppsInTossAuth } from './lib/appsInTossAuth';
import { UserContext, type UserContextValue } from './context/UserContext';
import { getCachedUiLanguage, setCachedUiLanguage } from './i18n/index';
import { ColorSchemeArea } from '@toss/tds-mobile';
import { AppInTossNavBar } from './components/layout/AppInTossNavBar';
import ScreenSession from './pages/ScreenSession';
import ScreenBilling from './pages/ScreenBilling';
import ScreenReport from './pages/ScreenReport';
import ScreenPrivacy from './pages/ScreenPrivacy';
import ScreenTerms from './pages/ScreenTerms';

function AppInTossUserProvider({ children }: { children: React.ReactNode }) {
  const { token, ready, getToken, refreshSession } = useAppsInTossAuth();
  const { i18n } = useTranslation();

  const noop = async () => { /* not available in AppInToss */ };

  const value: UserContextValue = {
    getToken,
    isAuthenticated: token !== null,
    sessionChecked: ready,
    refreshSession,
    uiLanguage: getCachedUiLanguage(),
    setUiLanguage: async (lang) => {
      setCachedUiLanguage(lang);
      await i18n.changeLanguage(lang);
    },
    clearIdentity: noop,
    startPhoneOtp: noop,
    verifyPhoneOtp: noop,
  };

  return React.createElement(UserContext.Provider, { value }, children);
}

function AppInTossRoutes() {
  const { ready, error } = useAppsInTossAuth();

  if (!ready) {
    return React.createElement(
      'div',
      { className: 'min-h-screen flex items-center justify-center bg-background' },
      React.createElement('p', { className: 'text-sm text-muted-foreground' }, '로딩 중...')
    );
  }

  if (error) {
    return React.createElement(
      'div',
      { className: 'min-h-screen flex items-center justify-center bg-background p-4' },
      React.createElement(
        'div',
        { className: 'text-center space-y-2' },
        React.createElement('p', { className: 'font-semibold text-foreground' }, '앱인토스 로그인에 실패했습니다'),
        React.createElement('p', { className: 'text-sm text-muted-foreground' }, error)
      )
    );
  }

  return (
    <AppInTossUserProvider>
      <ColorSchemeArea theme="light">
        <div className="flex min-h-screen flex-col">
          <AppInTossNavBar />
          <div className="flex-1">
            <Routes>
            <Route path="/" element={<Navigate to="/session" replace />} />
            <Route path="/session" element={<ScreenSession />} />
            <Route path="/billing" element={<ScreenBilling />} />
            <Route path="/report/:reportId" element={<ScreenReport />} />
            <Route path="/privacy" element={<ScreenPrivacy />} />
            <Route path="/terms" element={<ScreenTerms />} />
            <Route path="*" element={<Navigate to="/session" replace />} />
          </Routes>
        </div>
      </div>
      </ColorSchemeArea>
    </AppInTossUserProvider>
  );
}

export default function AppInToss() {
  return React.createElement(
    AppsInTossAuthProvider,
    null,
    React.createElement(AppInTossRoutes)
  );
}
