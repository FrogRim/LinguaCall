import { afterEach, describe, expect, it, vi } from "vitest";
import { createOpenAIRealtimeSession } from "../services/openaiRealtime";

const ENV_KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_REALTIME_CLIENT_SECRET_URL",
  "OPENAI_REALTIME_SESSION_URL",
  "OPENAI_REALTIME_MODEL",
  "OPENAI_REALTIME_VOICE",
  "OPENAI_REALTIME_TRANSCRIPTION_MODEL"
] as const;

const originalEnv = new Map(ENV_KEYS.map((key) => [key, process.env[key]]));

const restoreEnv = () => {
  for (const key of ENV_KEYS) {
    const originalValue = originalEnv.get(key);
    if (originalValue === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalValue;
    }
  }
};

const baseInput = {
  sessionId: "sess-1",
  callId: "call-1",
  clerkUserId: "supabase:user-1",
  language: "en",
  exam: "opic",
  topic: "travel",
  level: "IM2",
  durationMinutes: 3
};

describe("createOpenAIRealtimeSession", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    restoreEnv();
  });

  it("creates a GA Realtime client secret and parses the returned ephemeral key", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.OPENAI_REALTIME_SESSION_URL = "https://api.openai.com/v1/realtime/sessions";
    process.env.OPENAI_REALTIME_MODEL = "gpt-realtime-mini";
    process.env.OPENAI_REALTIME_VOICE = "marin";
    process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        value: "ek-test",
        expires_at: 1_893_456_000,
        session: {
          model: "gpt-realtime-mini"
        }
      })
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await createOpenAIRealtimeSession(baseInput);

    expect(result).toEqual({
      clientSecret: "ek-test",
      expiresAt: "2030-01-01T00:00:00.000Z",
      model: "gpt-realtime-mini"
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/realtime/client_secrets");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["OpenAI-Safety-Identifier"]).toMatch(/^[a-f0-9]{64}$/);

    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const session = body.session as Record<string, unknown>;
    const audio = session.audio as Record<string, unknown>;
    const inputAudio = audio.input as Record<string, unknown>;
    const outputAudio = audio.output as Record<string, unknown>;
    const transcription = inputAudio.transcription as Record<string, unknown>;
    const turnDetection = inputAudio.turn_detection as Record<string, unknown>;

    expect(body.expires_after).toEqual({ anchor: "created_at", seconds: 600 });
    expect(session.type).toBe("realtime");
    expect(session.model).toBe("gpt-realtime-mini");
    expect(session.output_modalities).toEqual(["audio"]);
    expect(outputAudio.voice).toBe("marin");
    expect(transcription.model).toBe("gpt-4o-mini-transcribe");
    expect(turnDetection.type).toBe("server_vad");
    expect(turnDetection.create_response).toBe(false);
  });
});
