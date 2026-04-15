import 'dotenv/config';
import Fastify, { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { userRoutes } from './api/user';
import { harnessRoutes } from './api/harness';
import { alertRoutes } from './api/alert';

export function resolveBackgroundServicesMode(env: NodeJS.ProcessEnv): 'start' | 'skip' {
  if (env.KIS_WS_URL && env.KIS_APPROVAL_KEY) {
    return 'start';
  }

  if (env.NODE_ENV === 'production') {
    throw new Error('KIS_WS_URL and KIS_APPROVAL_KEY must be set in production');
  }

  return 'skip';
}

export function buildServer() {
  const app = Fastify({ logger: true });
  const isProduction = process.env.NODE_ENV === 'production';

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('content-security-policy', "default-src 'none'");

    if (isProduction) {
      reply.header('strict-transport-security', 'max-age=31536000; includeSubDomains');
    }

    return payload;
  });

  const allowedOrigins = [
    /^https:\/\/[^.]+\.apps\.tossmini\.com$/,
    /^https:\/\/[^.]+\.private-apps\.tossmini\.com$/,
    ...(isProduction
      ? []
      : [
          /^http:\/\/localhost(?::\d+)?$/,
          /^http:\/\/127\.0\.0\.1(?::\d+)?$/,
          /^http:\/\/\[::1\](?::\d+)?$/,
        ]),
  ];

  app.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  // 전체 API: 15분에 200요청
  app.register(rateLimit, {
    max: 200,
    timeWindow: '15 minutes',
  });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.register(userRoutes);
  app.register(harnessRoutes);
  app.register(alertRoutes);

  app.setErrorHandler((error: FastifyError, _req, reply) => {
    const statusCode = error.statusCode ?? 500;
    if (statusCode >= 500) {
      app.log.error(error);
      return reply.status(500).send({ error: 'Internal server error' });
    }
    return reply.status(statusCode).send({ error: error.message });
  });

  return app;
}

async function start() {
  const app = buildServer();
  try {
    await app.listen({
      port: Number(process.env.PORT ?? 3000),
      host: process.env.HOST ?? '0.0.0.0',
    });

    if (resolveBackgroundServicesMode(process.env) === 'start') {
      const { startKISWorker } = await import('./worker/kisClient');
      const { startBatchScheduler } = await import('./scheduler/batchRunner');
      startKISWorker();
      startBatchScheduler();
    } else {
      app.log.warn('Skipping KIS worker and batch scheduler because KIS env is not set');
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}
