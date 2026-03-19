import { store } from "./storage/inMemoryStore";
import { InboundAudioFrame, sendAssistantMockAudio } from "./mediaStream";

type MessageRole = "user" | "assistant" | "system";

type MediaRuntimeOptions = {
  silenceMs?: number;
  maxResponseChars?: number;
  promptVersion?: string;
};

type RuntimeState = {
  sessionId: string;
  startedAtMs: number;
  lastFrameAtMs: number;
  utteranceParts: string[];
  turnTimer?: ReturnType<typeof setTimeout>;
  processingTurn: boolean;
  sequenceNo: number;
};

class MediaRuntime {
  private readonly silenceMs: number;
  private readonly maxResponseChars: number;
  private readonly promptVersion: string;
  private readonly stateBySession = new Map<string, RuntimeState>();

  constructor(options: MediaRuntimeOptions = {}) {
    this.silenceMs = options.silenceMs ?? 3000;
    this.maxResponseChars = options.maxResponseChars ?? 160;
    this.promptVersion = options.promptVersion ?? process.env.MEDIA_PROMPT_VERSION ?? "mock-en-v1";
  }

  async handleInboundAudio(frame: InboundAudioFrame): Promise<void> {
    const state = this.getOrCreateState(frame.sessionId);
    state.lastFrameAtMs = Date.now();

    this.appendPseudoTranscript(state, frame);
    this.setTurnTimer(frame.sessionId);
  }

  private getOrCreateState(sessionId: string): RuntimeState {
    const existing = this.stateBySession.get(sessionId);
    if (existing) {
      return existing;
    }
    const now = Date.now();
    const state: RuntimeState = {
      sessionId,
      startedAtMs: now,
      lastFrameAtMs: now,
      utteranceParts: [],
      processingTurn: false,
      sequenceNo: 0
    };
    this.stateBySession.set(sessionId, state);
    return state;
  }

  private appendPseudoTranscript(state: RuntimeState, frame: InboundAudioFrame): void {
    if (frame.byteLength <= 0) {
      return;
    }
    if (frame.track && frame.track.toLowerCase() === "outbound") {
      return;
    }
    const chunkIndex = state.sequenceNo + 1;
    const source = frame.sequenceNumber ?? String(chunkIndex);
    const utterance = `spoken phrase chunk_${state.sequenceNo + 1} (${source})`;
    state.utteranceParts.push(utterance);
    state.sequenceNo += 1;
  }

  private setTurnTimer(sessionId: string): void {
    const state = this.stateBySession.get(sessionId);
    if (!state) {
      return;
    }
    if (state.turnTimer) {
      clearTimeout(state.turnTimer);
    }
    state.turnTimer = setTimeout(() => {
      void this.flushTurn(sessionId).catch(() => undefined);
    }, this.silenceMs);
  }

  private async flushTurn(sessionId: string): Promise<void> {
    const state = this.stateBySession.get(sessionId);
    if (!state || state.processingTurn) {
      return;
    }

    const now = Date.now();
    if (now - state.lastFrameAtMs < this.silenceMs) {
      return;
    }

    if (state.utteranceParts.length === 0) {
      state.processingTurn = false;
      return;
    }

    state.processingTurn = true;
    const userText = state.utteranceParts.join(" ");
    state.utteranceParts = [];

    const userTimestamp = now - state.startedAtMs;
    const assistantText = this.buildAssistantReply(userText, this.promptVersion);
    const assistantTimestamp = now - state.startedAtMs;

    try {
      await store.appendMessage(sessionId, "user", userText, userTimestamp, true);
      await store.appendMessage(sessionId, "assistant", assistantText, assistantTimestamp, true);
    } catch {
      // keep call flowing in-memory even when transcript persistence fails
    } finally {
      sendAssistantMockAudio(sessionId, assistantText);
      state.processingTurn = false;
    }
  }

  private buildAssistantReply(userText: string, promptVersion: string): string {
    const normalized = userText.toLowerCase();
    if (normalized.includes("hello") || normalized.includes("hi")) {
      return `Great start! In this ${promptVersion} session, try adding one more detail to your answer.`;
    }
    if (normalized.includes("question") || normalized.includes("what")) {
      return "Nice question. Can you rephrase it using past tense?";
    }
    if (normalized.includes("thanks") || normalized.includes("thank")) {
      return "You are welcome! Keep speaking with more detail.";
    }
    const generic = `Good effort. You said: "${userText}". Add one extra sentence with correct tense and better fluency.`;
    return generic.length <= this.maxResponseChars
      ? generic
      : `${generic.slice(0, this.maxResponseChars - 3)}...`;
  }

  clearSession(sessionId: string): void {
    const state = this.stateBySession.get(sessionId);
    if (!state) {
      return;
    }
    if (state.turnTimer) {
      clearTimeout(state.turnTimer);
    }
    this.stateBySession.delete(sessionId);
  }
}

const mediaRuntime = new MediaRuntime();

export { mediaRuntime };
