import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'quant-notify',
  brand: {
    displayName: 'Quant-notify',
    primaryColor: '#3182F6',
    icon: '/favicon.svg',
  },
  web: {
    host: 'localhost',
    port: 5173,
    commands: { dev: 'vite', build: 'vite build' },
  },
  permissions: [],
});
