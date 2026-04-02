import {
  CompleteWebVoiceCallPayload,
  SessionAccuracyPolicy,
  StartCallResponse,
  WebVoiceRuntimeEventPayload
} from "@lingua/shared";
import { store, AppError } from "../storage/inMemoryStore";
import { createOpenAIRealtimeSession } from "./openaiRealtime";
import { buildSessionAccuracyPolicy } from "./sessionAccuracy";

const buildStartResponse = async (
  sessionId: string,
  clerkUserId: string,
  callId: string,
  language: string,
  exam: string,
  topic: string,
  level: string,
  durationMinutes: number,
  status: StartCallResponse["status"],
  accuracyPolicy?: SessionAccuracyPolicy
): Promise<StartCallResponse> => {
  const recentErrorPatterns = await store.getRecentGrammarErrors(clerkUserId, language, 1).catch((err: unknown) => {
    console.error("[webVoice] getRecentGrammarErrors failed — falling back to empty error patterns", {
      sessionId,
      language,
      error: err instanceof Error ? err.message : String(err)
    });
    return [];
  });

  const realtime = await createOpenAIRealtimeSession({
    sessionId,
    callId,
    clerkUserId,
    language,
    exam,
    topic,
    level,
    durationMinutes,
    accuracyPolicy,
    recentErrorPatterns
  });

  return {
    sessionId,
    callId,
    status,
    runtime: "openai_realtime",
    connectionMode: "webrtc",
    clientSecret: realtime.clientSecret,
    model: realtime.model,
    expiresAt: realtime.expiresAt,
    language,
    exam,
    level,
    topic,
    durationMinutes
  };
};

export const startWebVoiceSession = async (
  sessionId: string,
  clerkUserId: string,
  idempotencyKey: string
): Promise<StartCallResponse> => {
  const bootstrap = await store.startWebVoiceCall(sessionId, clerkUserId, idempotencyKey);
  try {
    const accuracyPolicy = buildSessionAccuracyPolicy(bootstrap.session);
    return await buildStartResponse(
      bootstrap.session.id,
      clerkUserId,
      bootstrap.callId,
      bootstrap.session.language,
      bootstrap.session.exam,
      bootstrap.session.topic,
      bootstrap.session.level,
      bootstrap.session.durationMinutes,
      bootstrap.session.status,
      accuracyPolicy
    );
  } catch (error) {
    await store.failWebVoiceBootstrap(sessionId, clerkUserId, "platform_fault").catch(() => undefined);
    throw new AppError("validation_error", error instanceof Error ? error.message : "failed_to_create_realtime_session");
  }
};

export const joinWebVoiceSession = async (
  sessionId: string,
  clerkUserId: string,
  idempotencyKey: string
): Promise<StartCallResponse> => {
  const bootstrap = await store.joinWebVoiceCall(sessionId, clerkUserId, idempotencyKey);
  try {
    const accuracyPolicy = buildSessionAccuracyPolicy(bootstrap.session);
    return await buildStartResponse(
      bootstrap.session.id,
      clerkUserId,
      bootstrap.callId,
      bootstrap.session.language,
      bootstrap.session.exam,
      bootstrap.session.topic,
      bootstrap.session.level,
      bootstrap.session.durationMinutes,
      bootstrap.session.status,
      accuracyPolicy
    );
  } catch (error) {
    await store.failWebVoiceBootstrap(sessionId, clerkUserId, "platform_fault").catch(() => undefined);
    throw new AppError("validation_error", error instanceof Error ? error.message : "failed_to_create_realtime_session");
  }
};

export const recordWebVoiceRuntimeEvent = (
  sessionId: string,
  clerkUserId: string,
  payload: WebVoiceRuntimeEventPayload
) => {
  return store.handleWebVoiceRuntimeEvent(sessionId, clerkUserId, payload);
};

export const completeWebVoiceSession = (
  sessionId: string,
  clerkUserId: string,
  payload: CompleteWebVoiceCallPayload
) => {
  return store.completeWebVoiceCall(sessionId, clerkUserId, payload);
};
