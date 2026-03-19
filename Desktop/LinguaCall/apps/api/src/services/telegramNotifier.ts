type TelegramNoticeKind = "reminder" | "report_ready";

type TelegramNotifierResult = {
  ok: boolean;
  status: "sent" | "failed" | "mock_sent";
  messageId?: string;
  reason?: string;
};

type ReminderPayload = {
  sessionId: string;
  sessionPublicId: string;
  userId: string;
  scheduledAt: string;
};

type ReportPayload = {
  reportId: string;
  sessionId: string;
  publicReportId: string;
  userId: string;
  publicSummaryUrl?: string;
};

const readEnv = (value?: string): string | undefined => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const normalizeUserKey = (value?: string): string | undefined => {
  const normalized = readEnv(value);
  if (!normalized) {
    return undefined;
  }
  return normalized.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
};

const readChatMap = (): Record<string, string> => {
  const rawMap = readEnv(process.env.TELEGRAM_CHAT_ID_MAP_JSON) || readEnv(process.env.TELEGRAM_CHAT_ID_MAP);
  if (!rawMap) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawMap);
    if (typeof parsed !== "object" || parsed === null) {
      return {};
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    return entries.reduce<Record<string, string>>((acc, [key, value]) => {
      const normalizedValue = readEnv(String(value));
      const normalizedKey = readEnv(key);
      if (!normalizedValue) {
        return acc;
      }
      if (normalizedKey) {
        acc[normalizedKey] = normalizedValue;
      }
      const userKey = normalizeUserKey(key);
      if (userKey) {
        acc[userKey] = normalizedValue;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const normalizeTelegramChatId = (value: string | undefined): string | undefined => {
  const normalized = readEnv(value);
  if (!normalized) {
    return undefined;
  }
  return normalized;
};

const toJson = async (response: Response) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const resolveTelegramToken = () => readEnv(process.env.TELEGRAM_BOT_TOKEN);
const resolveTelegramChatId = (userId?: string): string | undefined => {
  const normalizedUserId = readEnv(userId);
  if (normalizedUserId) {
    const map = readChatMap();
    const mapped = readEnv(map[normalizedUserId]) || readEnv(map[normalizeUserKey(normalizedUserId) ?? ""]);
    if (mapped) {
      return mapped;
    }

    const perUserEnvKey = normalizeUserKey(normalizedUserId);
    const perUserEnv = perUserEnvKey
      ? readEnv(process.env[`TELEGRAM_CHAT_ID_${perUserEnvKey}`])
      : undefined;
    if (perUserEnv) {
      return perUserEnv;
    }
  }

  return readEnv(process.env.TELEGRAM_CHAT_ID_DEFAULT) || readEnv(process.env.TELEGRAM_CHAT_ID);
};

const resolveTelegramEndpoint = () => {
  const explicit = readEnv(process.env.TELEGRAM_API_URL) || readEnv(process.env.TELEGRAM_API_ENDPOINT);
  if (explicit) {
    return explicit;
  }

  const token = resolveTelegramToken();
  if (!token) {
    return undefined;
  }
  return `https://api.telegram.org/bot${token}/sendMessage`;
};

const formatReminderText = (payload: ReminderPayload) => {
  const scheduledAt = new Date(payload.scheduledAt).toLocaleString();
  return [
    "LinguaCall Reminder",
    `Session ${payload.sessionPublicId} starts`,
    `Scheduled at: ${scheduledAt}`,
    `Session ID: ${payload.sessionId}`
  ].join("\n");
};

const formatReportText = (payload: ReportPayload) => {
  const link = payload.publicSummaryUrl
    ? `\nReport link: ${payload.publicSummaryUrl}`
    : "";
  return [
    "LinguaCall Report Ready",
    `Report ID: ${payload.publicReportId}`,
    `Session ID: ${payload.sessionId}`,
    link
  ].filter(Boolean).join("\n");
};

const sendTelegramHttp = async (
  kind: TelegramNoticeKind,
  payload: ReminderPayload | ReportPayload
): Promise<TelegramNotifierResult> => {
  const endpoint = resolveTelegramEndpoint();
  const botToken = resolveTelegramToken();
  const chatId = resolveTelegramChatId((payload as ReminderPayload | ReportPayload).userId);
  const explicitEndpoint = readEnv(process.env.TELEGRAM_API_URL) || readEnv(process.env.TELEGRAM_API_ENDPOINT);

  if (!endpoint || (!botToken && !explicitEndpoint) || !chatId) {
    return {
      ok: true,
      status: "mock_sent",
      messageId: `mock-telegram-${kind}-${Date.now()}`
    };
  }

  try {
    const text = kind === "reminder"
      ? formatReminderText(payload as ReminderPayload)
      : formatReportText(payload as ReportPayload);
    const body: Record<string, unknown> = {
      text,
      parse_mode: "HTML"
    };
    body.chat_id = normalizeTelegramChatId(chatId);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const responseBody = await toJson(response);
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        reason: `${response.status} ${response.statusText}: ${JSON.stringify(responseBody)}`
      };
    }

    return {
      ok: true,
      status: "sent",
      messageId: typeof responseBody.result?.message_id === "number"
        ? String(responseBody.result.message_id)
        : `telegram-${kind}-${Date.now()}`
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      reason: error instanceof Error ? error.message : "unknown_telegram_error"
    };
  }
};

const sendTelegramReminder = async (payload: ReminderPayload): Promise<TelegramNotifierResult> => {
  return sendTelegramHttp("reminder", payload);
};

const sendTelegramReportSummary = async (payload: ReportPayload): Promise<TelegramNotifierResult> => {
  return sendTelegramHttp("report_ready", payload);
};

export {
  TelegramNotifierResult,
  sendTelegramReminder,
  sendTelegramReportSummary
};
