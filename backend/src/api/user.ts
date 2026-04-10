import { FastifyInstance } from 'fastify';
import { prisma } from '../db/client';

export async function userRoutes(app: FastifyInstance) {
  app.post<{ Body: { tossUserKey: string } }>('/users', async (req, reply) => {
    const { tossUserKey } = req.body;

    if (!tossUserKey || typeof tossUserKey !== 'string') {
      return reply.status(400).send({ error: 'tossUserKey is required' });
    }

    const user = await prisma.user.upsert({
      where: { tossUserKey },
      update: {},
      create: { tossUserKey },
    });

    return user;
  });
}
