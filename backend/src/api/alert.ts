// backend/src/api/alert.ts
import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';

export async function alertRoutes(app: FastifyInstance) {
  // 알림 이력 조회
  app.get('/alerts', async (req, reply) => {
    const rawKey = req.headers['x-toss-user-key'];
    const tossUserKey = Array.isArray(rawKey) ? rawKey[0] : rawKey;
    if (!tossUserKey) return reply.status(401).send({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({ where: { tossUserKey } });
    if (!user) return reply.status(401).send({ error: 'Unauthorized' });

    return prisma.alert.findMany({
      where: { userId: user.id },
      orderBy: { sentAt: 'desc' },
      take: 50,
      include: { harness: { select: { summary: true, ticker: true } } },
    });
  });

  // 딥링크 클릭 추적
  app.post<{ Params: { id: string } }>('/alerts/:id/click', async (req, reply) => {
    const alertRecord = await prisma.alert.findUnique({ where: { id: req.params.id } });
    if (!alertRecord) return reply.status(404).send({ error: 'Not found' });

    await prisma.alert.update({
      where: { id: req.params.id },
      data: { clicked: true },
    });
    return { success: true };
  });
}
