const readEnv = (value?: string): string | undefined => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asRecord = (value: unknown): Record<string, unknown> | undefined => {
  return value && typeof value === "object" ? value as Record<string, unknown> : undefined;
};

const readStringValue = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized.length > 0) {
        return normalized;
      }
      continue;
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return String(candidate);
    }
  }
  return undefined;
};

const readExpiresAt = (...candidates: unknown[]): string | undefined => {
  for (const candidate of candidates) {
    if (typeof candidate === "string") {
      const normalized = candidate.trim();
      if (normalized.length > 0) {
        return normalized;
      }
      continue;
    }
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      const epochMs = candidate > 1_000_000_000_000 ? candidate : candidate * 1000;
      return new Date(epochMs).toISOString();
    }
  }
  return undefined;
};

export type CreateOpenAIRealtimeSessionInput = {
  sessionId: string;
  callId: string;
  clerkUserId: string;
  language: string;
  exam: string;
  topic: string;
  level: string;
  durationMinutes: number;
  accuracyPolicy?: {
    topicLockEnabled: boolean;
    explicitTopicSwitchRequired: boolean;
    correctionMode: "light_inline";
    maxAssistantSentences: number;
    maxAssistantQuestionsPerTurn: number;
    enforceTopicRetention: boolean;
    enforceIntentAlignment: boolean;
    enforceCorrectionRelevance: boolean;
    forbiddenDomainHints: string[];
    allowedSubtopicHints: string[];
  };
};

export type OpenAIRealtimeSession = {
  clientSecret: string;
  expiresAt?: string;
  model: string;
};

export const buildInstructions = (input: CreateOpenAIRealtimeSessionInput) => {
  const { language, exam, topic, level, durationMinutes, accuracyPolicy } = input;

  if (language === "de" && exam === "goethe_b2") {
    return [
      "Du bist LinguaCall, ein Deutschlernpartner für die Goethe-Zertifikat B2 Prüfung.",
      "Führe das Gespräch ausschließlich auf Deutsch.",
      "Konzentriere dich auf den Sprechen-Teil der Goethe B2 Prüfung:",
      "  - Monologisches Sprechen: Kurzpräsentation zu einem Thema (ca. 3–4 Min.)",
      "  - Dialogisches Sprechen: Diskussion und gemeinsame Aufgabenlösung",
      "  - Reaktion auf eine Aussage oder ein Schaubild",
      `Thema der Sitzung: ${topic}.`,
      `Sprachniveau des Lernenden: ${level} (Ziel: B2).`,
      `Sitzungsdauer: ${durationMinutes} Minuten.`,
      "Korrigiere Fehler behutsam und direkt nach dem Satz des Lernenden.",
      "Gib nach der Korrektur sofort eine korrekte Beispielformulierung.",
      "Bewerte am Ende Aussprache, Grammatik, Wortschatz und Flüssigkeit kurz auf Deutsch.",
      "Halte das Gespräch aktiv: Stelle Rückfragen, um den Lernenden zum Sprechen zu motivieren."
    ].join(" ");
  }

  if (language === "zh" && exam === "hsk5") {
    return [
      "你是LinguaCall，一位专注于HSK 5级口语练习的汉语辅导伙伴。",
      "请全程使用普通话进行对话。",
      `本次练习主题：${topic}。`,
      `学习者水平：${level}（目标：HSK 5级）。`,
      `练习时长：${durationMinutes}分钟。`,
      "请轻柔地纠正语法和用词错误，并立即给出正确示例。",
      "多提问，保持对话流畅，鼓励学习者多开口表达。"
    ].join(" ");
  }

  if (language === "es" && exam === "dele_b1") {
    return [
      "Eres LinguaCall, un compañero de práctica de español oral orientado al examen DELE B1.",
      "Mantén la conversación completamente en español.",
      `Tema de la sesión: ${topic}.`,
      `Nivel del estudiante: ${level} (objetivo: DELE B1).`,
      `Duración de la sesión: ${durationMinutes} minutos.`,
      "Corrige los errores con suavidad justo después de cada frase y proporciona la forma correcta.",
      "Haz preguntas para mantener al estudiante hablando de forma activa."
    ].join(" ");
  }

  // Default: English / OPIC
  if (language === "en" && exam === "opic") {
    const rules = [
      "You are LinguaCall, a live English speaking practice partner for OPIC preparation.",
      `Keep the learner on the current topic: ${topic}.`,
      `Target learner level: ${level}.`,
      `Target session duration: ${durationMinutes} minutes.`,
      "Stay concise and interactive.",
      `Use at most ${accuracyPolicy?.maxAssistantSentences ?? 3} sentences per turn.`,
      `Ask at most ${accuracyPolicy?.maxAssistantQuestionsPerTurn ?? 1} question per turn.`,
      "Do not switch to a new topic unless the learner explicitly asks to change the topic.",
      "Respond to the learner's latest utterance before introducing any follow-up.",
      "If you give a correction, keep it light and connect it directly to the learner's latest sentence.",
      "If you are unsure, ask a clarifying question instead of guessing."
    ];
    if (accuracyPolicy?.allowedSubtopicHints.length) {
      rules.push(`Prefer these subtopic cues when useful: ${accuracyPolicy.allowedSubtopicHints.join(", ")}.`);
    }
    if (accuracyPolicy?.forbiddenDomainHints.length) {
      rules.push(`Avoid drifting into unrelated domains such as: ${accuracyPolicy.forbiddenDomainHints.join(", ")}.`);
    }
    return rules.join(" ");
  }

  return [
    "You are LinguaCall, a live English speaking practice partner for OPIC exam preparation.",
    "Keep the conversation natural, concise, and interactive.",
    `Target topic: ${topic}.`,
    `Target level: ${level}.`,
    `Session duration target: ${durationMinutes} minutes.`,
    "Correct lightly during the conversation and keep the learner speaking."
  ].join(" ");
};

export const createOpenAIRealtimeSession = async (
  input: CreateOpenAIRealtimeSessionInput
): Promise<OpenAIRealtimeSession> => {
  const apiKey = readEnv(process.env.OPENAI_API_KEY);
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const model = readEnv(process.env.OPENAI_REALTIME_MODEL) ?? "gpt-realtime";
  const voice = readEnv(process.env.OPENAI_REALTIME_VOICE) ?? "alloy";
  const transcriptionModel = readEnv(process.env.OPENAI_REALTIME_TRANSCRIPTION_MODEL) ?? "gpt-4o-mini-transcribe";
  const sessionUrl = readEnv(process.env.OPENAI_REALTIME_SESSION_URL) ?? "https://api.openai.com/v1/realtime/sessions";

  const response = await fetch(sessionUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      voice,
      modalities: ["audio", "text"],
      instructions: buildInstructions(input),
      input_audio_transcription: {
        model: transcriptionModel
      },
      turn_detection: {
        type: "server_vad"
      }
    })
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`failed_to_create_realtime_session: ${response.status} ${text}`.trim());
  }

  const payload = await response.json() as Record<string, unknown>;
  const sessionPayload = asRecord(payload.session);
  const clientSecretPayload = asRecord(payload.client_secret) ?? asRecord(sessionPayload?.client_secret);
  const secretPayload = asRecord(payload.secret) ?? asRecord(sessionPayload?.secret);
  const ephemeralPayload =
    asRecord(payload.ephemeral_key) ??
    asRecord(payload.ephemeralKey) ??
    asRecord(sessionPayload?.ephemeral_key) ??
    asRecord(sessionPayload?.ephemeralKey);

  const clientSecretValue = readStringValue(
    clientSecretPayload?.value,
    clientSecretPayload?.secret,
    payload.client_secret,
    secretPayload?.value,
    secretPayload?.secret,
    payload.secret,
    ephemeralPayload?.value,
    ephemeralPayload?.secret,
    payload.clientSecret,
    payload.token,
    sessionPayload?.client_secret,
    sessionPayload?.clientSecret,
    sessionPayload?.token
  );

  if (!clientSecretValue) {
    throw new Error("realtime_session_missing_client_secret");
  }

  const expiresAt = readExpiresAt(
    clientSecretPayload?.expires_at,
    clientSecretPayload?.expiresAt,
    secretPayload?.expires_at,
    secretPayload?.expiresAt,
    ephemeralPayload?.expires_at,
    ephemeralPayload?.expiresAt,
    payload.expires_at,
    payload.expiresAt,
    sessionPayload?.expires_at,
    sessionPayload?.expiresAt
  );

  const resolvedModel = readStringValue(
    payload.model,
    sessionPayload?.model,
    model
  ) ?? model;

  return {
    clientSecret: clientSecretValue,
    expiresAt,
    model: resolvedModel
  };
};
