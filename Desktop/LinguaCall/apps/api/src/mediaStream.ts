import http from "node:http";
import { RawData, WebSocket, WebSocketServer } from "ws";
import { store } from "./storage/inMemoryStore";
import { encodeTextToTwilioFrames } from "./mediaTranscoder";

type RawPayload = Record<string, unknown>;

type TwilioMediaStartEvent = {
  event: "start";
  start?: {
    streamSid?: string;
    callSid?: string;
    customParameters?: RawPayload;
  };
};

type TwilioMediaMessageEvent = {
  event: "media";
  media?: {
    track?: string;
    payload?: string;
    sequenceNumber?: string;
  };
};

type TwilioMediaStopEvent = {
  event: "stop";
};

type TwilioMediaOutboundEvent = {
  event: "media";
  media: {
    payload: string;
    track: "outbound";
  };
};

type TwilioMediaClearEvent = {
  event: "clear";
};

type TwilioMediaOutboundMessage = TwilioMediaOutboundEvent | TwilioMediaClearEvent;

type TwilioMediaEvent =
  | TwilioMediaStartEvent
  | TwilioMediaMessageEvent
  | TwilioMediaStopEvent
  | ({ event: string; [key: string]: unknown });

type InboundAudioFrame = {
  sessionId: string;
  streamSid?: string;
  track?: string;
  payload: string;
  sequenceNumber?: string;
  byteLength: number;
};

type InboundAudioHandler = (frame: InboundAudioFrame) => Promise<void>;

type AttachOptions = {
  onInboundAudio?: InboundAudioHandler;
  onStreamClose?: (sessionId: string, reason: "stop" | "close", details?: RawPayload) => void;
  onStreamFault?: (sessionId: string, reason: string, details: RawPayload) => Promise<void> | void;
};

type MediaStreamState = {
  sessionId?: string;
  streamSid?: string;
  stopReceived: boolean;
  bound: boolean;
  active: boolean;
};

type ResolvedSession = {
  sessionId: string;
  streamSid?: string;
};

const activeSessionSockets = new Map<string, WebSocket>();

const sendOutboundFrame = (sessionId: string, frame: TwilioMediaOutboundMessage): void => {
  const socket = activeSessionSockets.get(sessionId);
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  try {
    socket.send(JSON.stringify(frame));
  } catch {
    // best effort for mock runtime path; runtime continues without blocking
  }
};

const clearOutboundBuffer = (sessionId: string): void => {
  sendOutboundFrame(sessionId, { event: "clear" });
};

const nowIso = () => new Date().toISOString();

const asString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asObject = (value: unknown): RawPayload | undefined => {
  return value && typeof value === "object" ? value as RawPayload : undefined;
};

const toText = (data: RawData): string => {
  if (Buffer.isBuffer(data)) {
    return data.toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString("utf8");
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  return String(data);
};

const writeMediaError = (socket: WebSocket, reason: string) => {
  socket.close(1011, reason);
};

const parseMediaPayload = (raw: unknown): TwilioMediaEvent | undefined => {
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const event = asString((raw as RawPayload).event);
  if (!event) {
    return undefined;
  }
  return { ...(raw as RawPayload), event };
};

const safeBase64Payload = (value: string): number | undefined => {
  if (!/^[A-Za-z0-9+/=]+$/.test(value) || value.length % 4 !== 0) {
    return undefined;
  }
  return Buffer.from(value, "base64").length;
};

const getSessionSocketState = (sessionId: string): boolean => {
  const socket = activeSessionSockets.get(sessionId);
  return !!socket && socket.readyState === WebSocket.OPEN;
};

const resolveStreamSession = async (payload: TwilioMediaStartEvent): Promise<ResolvedSession | undefined> => {
  const start = asObject(payload.start);
  const custom = asObject(start?.customParameters);
  const sessionId = asString(custom?.session_id);
  const callId = asString(custom?.call_id) ?? asString(custom?.callId);
  const providerCallSid = asString(start?.callSid) ?? asString(custom?.provider_call_sid) ?? asString(custom?.providerCallSid);
  const lookup = {
    callId: sessionId ?? callId,
    providerCallSid
  };

  if (!lookup.callId && !lookup.providerCallSid) {
    return undefined;
  }

  const session = await store.getSessionByTwilioLookup(lookup);
  if (!session) {
    return undefined;
  }

  await store.bindMediaStreamSession({
    sessionId: session.id,
    providerCallSid,
    callId
  });

  return {
    sessionId: session.id,
    streamSid: asString(start?.streamSid)
  };
};

const sendAssistantMockAudio = (sessionId: string, text: string): void => {
  if (!getSessionSocketState(sessionId)) {
    return;
  }

  clearOutboundBuffer(sessionId);
  const frames = encodeTextToTwilioFrames(text);
  for (const frame of frames) {
    sendOutboundFrame(sessionId, frame);
  }
};

const attachMediaStreamServer = (server: http.Server, options: AttachOptions = {}): WebSocketServer => {
  const { onInboundAudio = async () => undefined } = options;
  const wss = new WebSocketServer({ server, path: "/media-stream" });

  wss.on("connection", (socket) => {
    const state: MediaStreamState = {
      stopReceived: false,
      bound: false,
      active: false
    };

    (socket as { sessionId?: string }).sessionId = undefined;

    const emitStreamFault = (sessionId: string | undefined, reason: string, details: RawPayload = {}) => {
      if (!sessionId) {
        return;
      }
      void store.markMediaStreamError(sessionId, reason, { ...details, at: nowIso(), source: "media_stream" })
        .catch(() => undefined);
      const faultHandler = (options.onStreamFault ?? (() => undefined));
      void Promise.resolve(faultHandler(sessionId, reason, { ...details, source: "media_stream" }))
        .catch(() => undefined);
    };

    socket.on("message", (data: RawData) => {
      const stateRef = state;
      void (async () => {
        try {
          let parsed: TwilioMediaEvent | undefined;
          try {
            parsed = parseMediaPayload(JSON.parse(toText(data)));
          } catch {
            writeMediaError(socket, "invalid_media_json");
            emitStreamFault(stateRef.sessionId, "invalid_media_json", { event: "parse_error" });
            return;
          }

          if (!parsed) {
            writeMediaError(socket, "invalid_media_event");
            emitStreamFault(stateRef.sessionId, "invalid_media_event", { event: "missing_event" });
            return;
          }

          if (parsed.event === "start") {
            const resolved = await resolveStreamSession(parsed);
            if (!resolved) {
              writeMediaError(socket, "session_not_found");
              emitStreamFault(stateRef.sessionId, "session_not_found", { event: "start_lookup_failed" });
              return;
            }
            const id = resolved.sessionId;
            (socket as { sessionId?: string }).sessionId = id;
            stateRef.sessionId = id;
            stateRef.streamSid = resolved.streamSid;
            stateRef.bound = true;
            stateRef.stopReceived = false;
            activeSessionSockets.set(id, socket);
            return;
          }

          if (parsed.event === "media") {
            if (!stateRef.bound || !stateRef.sessionId) {
              writeMediaError(socket, "unbound_media_event");
              emitStreamFault(stateRef.sessionId, "unbound_media_event", { event: "media_without_start" });
              return;
            }

            const message = parsed as TwilioMediaMessageEvent;
            const payload = asString(message.media?.payload);
            if (!payload) {
              writeMediaError(socket, "media_payload_missing");
              emitStreamFault(stateRef.sessionId, "media_payload_missing", { event: "media_payload_missing" });
              return;
            }

            const byteLength = safeBase64Payload(payload);
            if (byteLength === undefined) {
              writeMediaError(socket, "media_payload_invalid");
              emitStreamFault(stateRef.sessionId, "media_payload_invalid", {
                event: "media_payload_invalid",
                payloadLength: payload.length
              });
              return;
            }

            if (!stateRef.active) {
              await store.markMediaStreamActive(stateRef.sessionId);
              stateRef.active = true;
            }

            await onInboundAudio({
              sessionId: stateRef.sessionId,
              streamSid: stateRef.streamSid,
              track: asString(message.media?.track),
              payload,
              byteLength,
              sequenceNumber: asString(message.media?.sequenceNumber)
            });
            return;
          }

        if (parsed.event === "stop") {
            stateRef.stopReceived = true;
            const currentSessionId = stateRef.sessionId;
            if (currentSessionId) {
              const cleanup = (options.onStreamClose ?? (() => undefined));
              activeSessionSockets.delete(currentSessionId);
              cleanup(currentSessionId, "stop");
            }
            return;
          }
        } catch {
          writeMediaError(socket, "media_runtime_error");
          emitStreamFault(stateRef.sessionId, "media_runtime_error", { event: "internal_error" });
        }
      })();
    });

    socket.on("close", (code) => {
      const currentSessionId = state.sessionId;
      const cleanup = (options.onStreamClose ?? (() => undefined));
      const closeCode = Number(code);
      const normalCloseCode = closeCode === 1000 || closeCode === 1001;
      if (currentSessionId) {
        activeSessionSockets.delete(currentSessionId);
        if (!state.stopReceived && !normalCloseCode) {
          emitStreamFault(currentSessionId, "websocket_unexpected_close", {
            event: "websocket_close",
            code: closeCode
          });
        }
        cleanup(currentSessionId, "close", {
          code: closeCode,
          normalCloseCode
        });
      }
      state.sessionId = undefined;
      state.bound = false;
      state.active = false;
    });

    socket.on("error", () => {
      if (state.sessionId) {
        emitStreamFault(state.sessionId, "websocket_error", {
          event: "websocket_error"
        });
      }
    });
  });

  return wss;
};

export { attachMediaStreamServer, sendAssistantMockAudio };
export type { InboundAudioFrame };
