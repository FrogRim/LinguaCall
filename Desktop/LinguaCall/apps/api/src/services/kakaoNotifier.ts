type KakaoNoticeKind = "reminder" | "report_ready";

type KakaoNotifierResult = {
  ok: boolean;
  status: "sent" | "accepted" | "failed" | "mock_sent" | "mock_accepted";
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

const envOrDefault = (...keys: string[]) => keys.map((key) => process.env[key]?.trim()).find((value) => !!value);

const toJson = async (response: unknown) => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const sendKakaoHttp = async (
  kind: KakaoNoticeKind,
  payload: ReminderPayload | ReportPayload
): Promise<KakaoNotifierResult> => {
  const apiUrl = envOrDefault("KAKAO_API_URL", "KAKAO_API_ENDPOINT");
  const apiToken = envOrDefault("KAKAO_API_TOKEN", "KAKAO_AUTH_TOKEN");

  if (!apiUrl || !apiToken) {
    return {
      ok: true,
      status: "mock_accepted",
      messageId: `mock-${kind}-${Date.now()}`
    };
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiToken}`
      },
      body: JSON.stringify({
        kind,
        payload
      })
    });

    const body = await toJson(response);
    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        reason: `${response.status} ${response.statusText}: ${JSON.stringify(body)}`
      };
    }

    return {
      ok: true,
      status: "sent",
      messageId: typeof body.messageId === "string" ? body.messageId : `kakao-${kind}-${Date.now()}`
    };
  } catch (error) {
    return {
      ok: false,
      status: "failed",
      reason: error instanceof Error ? error.message : "unknown_kakao_error"
    };
  }
};

const sendKakaoReminder = async (payload: ReminderPayload): Promise<KakaoNotifierResult> => {
  return sendKakaoHttp("reminder", payload);
};

const sendKakaoReportSummary = async (payload: ReportPayload): Promise<KakaoNotifierResult> => {
  return sendKakaoHttp("report_ready", payload);
};

export {
  KakaoNotifierResult,
  sendKakaoReminder,
  sendKakaoReportSummary
};
