// backend/src/pusher/pushClient.ts
import { prisma } from '../db/client';
import { readFileSync } from 'fs';
import https from 'https';

const PUSH_API_URL = 'https://apps-in-toss-api.toss.im/api-partner/v1/apps-in-toss/messenger/send-message';

// mTLS 인증서 설정 — 인증서가 없으면 undefined (개발환경)
const agent = new https.Agent({
  cert: process.env.MTLS_CERT ? readFileSync(process.env.MTLS_CERT) : undefined,
  key:  process.env.MTLS_KEY  ? readFileSync(process.env.MTLS_KEY)  : undefined,
  rejectUnauthorized: true,
});

export interface SendPushParams {
  userKey: string;
  harness: { id: string; userId: string; summary: string };
  price: number;
  deeplink: string;
}

export async function sendPush({ userKey, harness, price, deeplink }: SendPushParams): Promise<void> {
  const MAX_RETRIES = 3;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(PUSH_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-toss-user-key': userKey,
        },
        body: JSON.stringify({
          templateSetCode: 'harness_triggered_v1',
          context: {
            summary: harness.summary,
            price: price.toLocaleString('ko-KR'),
            deeplink,
          },
        }),
        // @ts-expect-error Node.js fetch agent
        agent,
      });

      if (!res.ok) throw new Error(`Push API error: ${res.status}`);

      // Alert 이력 저장
      await prisma.alert.create({
        data: {
          harnessId: harness.id,
          userId: harness.userId,
          triggeredBy: 'HARNESS',
          priceAt: price,
          deeplink,
        },
      });

      return;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        console.error(`[Pusher] Failed after ${MAX_RETRIES} attempts:`, err);
      } else {
        await new Promise((r) => setTimeout(r, 1000 * attempt)); // 지수 백오프
      }
    }
  }
}
