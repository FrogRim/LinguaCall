import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'lingua-call', // 앱인토스 콘솔 등록 후 실제 appName으로 교체
  brand: {
    displayName: 'LinguaCall',
    primaryColor: '#3182F6',
    icon: '/favicon.ico',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: {
      dev: 'vite',
      build: 'vite build',
    },
  },
  permissions: [],
});
