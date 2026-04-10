import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';
import { Sensitivity } from '@prisma/client';

const FREE_PLAN_LIMIT = 3;

async function getUserByKey(tossUserKey: string) {
  return prisma.user.findUnique({ where: { tossUserKey } });
}

export async function harnessRoutes(app: FastifyInstance) {
  // 하니스 목록 조회
  app.get('/harnesses', async (req, reply) => {
    const tossUserKey = req.headers['x-toss-user-key'] as string;
    const user = await getUserByKey(tossUserKey);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    return prisma.harness.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });
  });

  // 하니스 생성
  app.post<{
    Body: {
      ticker: string;
      market: string;
      conditions: unknown[];
      logic: string;
      sensitivity: string;
      summary: string;
    };
  }>('/harnesses', async (req, reply) => {
    const tossUserKey = req.headers['x-toss-user-key'] as string;
    const user = await getUserByKey(tossUserKey);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    if (user.plan === 'FREE') {
      const count = await prisma.harness.count({ where: { userId: user.id } });
      if (count >= FREE_PLAN_LIMIT) {
        return reply.status(403).send({ error: 'FREE plan limit reached', limit: FREE_PLAN_LIMIT });
      }
    }

    const harness = await prisma.harness.create({
      data: {
        userId: user.id,
        ticker: req.body.ticker,
        market: req.body.market,
        conditions: req.body.conditions as object[],
        logic: req.body.logic,
        sensitivity: req.body.sensitivity as Sensitivity,
        summary: req.body.summary,
      },
    });

    return reply.status(201).send(harness);
  });

  // 하니스 활성화 토글
  app.patch<{ Params: { id: string }; Body: { active: boolean } }>(
    '/harnesses/:id',
    async (req, reply) => {
      const tossUserKey = req.headers['x-toss-user-key'] as string;
      const user = await getUserByKey(tossUserKey);
      if (!user) return reply.status(401).send({ error: 'Unauthorized' });

      const harness = await prisma.harness.findFirst({
        where: { id: req.params.id, userId: user.id },
      });
      if (!harness) return reply.status(404).send({ error: 'Not found' });

      return prisma.harness.update({
        where: { id: req.params.id },
        data: { active: req.body.active },
      });
    }
  );

  // 하니스 삭제
  app.delete<{ Params: { id: string } }>('/harnesses/:id', async (req, reply) => {
    const tossUserKey = req.headers['x-toss-user-key'] as string;
    const user = await getUserByKey(tossUserKey);
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    const harness = await prisma.harness.findFirst({
      where: { id: req.params.id, userId: user.id },
    });
    if (!harness) return reply.status(404).send({ error: 'Not found' });

    await prisma.harness.delete({ where: { id: req.params.id } });
    return { success: true };
  });
}
