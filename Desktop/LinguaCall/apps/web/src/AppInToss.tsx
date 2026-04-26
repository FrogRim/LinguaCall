import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AppsInTossAuthProvider, useAppsInTossAuth } from './lib/appsInTossAuth';
import { UserContext, type UserContextValue } from './context/UserContext';
import { getCachedUiLanguage, setCachedUiLanguage } from './i18n/index';
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

  return React.createElement(
    AppInTossUserProvider,
    null,
    React.createElement(
      Routes,
      null,
      React.createElement(Route, { path: '/', element: React.createElement(Navigate, { to: '/session', replace: true }) }),
      React.createElement(Route, { path: '/session', element: React.createElement(ScreenSession) }),
      React.createElement(Route, { path: '/billing', element: React.createElement(ScreenBilling) }),
      React.createElement(Route, { path: '/report/:reportId', element: React.createElement(ScreenReport) }),
      React.createElement(Route, { path: '/privacy', element: React.createElement(ScreenPrivacy) }),
      React.createElement(Route, { path: '/terms', element: React.createElement(ScreenTerms) }),
      React.createElement(Route, { path: '*', element: React.createElement(Navigate, { to: '/session', replace: true }) })
    )
  );
}

export default function AppInToss() {
  return React.createElement(
    AppsInTossAuthProvider,
    null,
    React.createElement(AppInTossRoutes)
  );
}
