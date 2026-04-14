import Fastify from 'fastify';

const loggerHost = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  },
  disableRequestLogging: true,
});

export function getLogger(bindings: Record<string, unknown>) {
  return loggerHost.log.child(bindings);
}
