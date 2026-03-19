type OutboundCallResult = {
  provider: "mock" | "twilio";
  status: "mock" | "queued" | "failed";
  callSid: string;
  providerCallSid?: string;
  reason?: string;
};

type EndOutboundCallResult = {
  provider: "mock" | "twilio";
  status: "mock" | "completed" | "failed";
  callSid: string;
  reason?: string;
};

type OutboundCallInput = {
  sessionId: string;
  to?: string;
  from?: string;
  callSid: string;
  twimlUrl: string;
  statusCallbackUrl?: string;
  statusCallbackEvents?: string[];
  timeoutSeconds?: number;
};

const readEnv = (value?: string): string | undefined => {
  const normalized = (value ?? "").trim();
  return normalized.length > 0 ? normalized : undefined;
};

const asProvider = () => {
  const provider = readEnv(process.env.CALL_PROVIDER) ?? "mock";
  return provider.trim().toLowerCase();
};

const createMockResult = (callSid: string, reason?: string): OutboundCallResult => ({
  provider: "mock",
  status: "mock",
  callSid,
  reason
});

const buildTwilioAuthHeader = (accountSid: string, authToken: string): string =>
  `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;

const normalizeCallSid = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  return undefined;
};

const createTwilioCall = async (input: OutboundCallInput): Promise<OutboundCallResult> => {
  const accountSid = readEnv(process.env.TWILIO_ACCOUNT_SID);
  const authToken = readEnv(process.env.TWILIO_AUTH_TOKEN);
  if (!accountSid || !authToken) {
    return {
      provider: "twilio",
      status: "failed",
      callSid: input.callSid,
      reason: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required"
    };
  }

  const to = readEnv(input.to);
  const from = readEnv(input.from);
  if (!to || !from) {
    return {
      provider: "twilio",
      status: "failed",
      callSid: input.callSid,
      reason: "to/from phone numbers are required for Twilio outbound"
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`;
  const params = new URLSearchParams({
    To: to,
    From: from,
    Url: input.twimlUrl,
    Method: "GET"
  });
  if (input.statusCallbackUrl) {
    params.set("StatusCallback", input.statusCallbackUrl);
  }
  if (input.statusCallbackEvents?.length) {
    params.set("StatusCallbackEvent", input.statusCallbackEvents.join(" "));
  }
  if (input.timeoutSeconds !== undefined && Number.isFinite(input.timeoutSeconds)) {
    params.set("Timeout", String(Math.max(1, Math.floor(input.timeoutSeconds))));
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: buildTwilioAuthHeader(accountSid, authToken),
        "content-type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    if (!response.ok) {
      const raw = await response.text();
      return {
        provider: "twilio",
        status: "failed",
        callSid: input.callSid,
        reason: `twilio error: ${response.status} ${response.statusText} ${raw?.slice(0, 160) ?? ""}`.trim()
      };
    }

    const payload = await response.json() as Record<string, unknown>;
    const sid = normalizeCallSid((payload as { sid?: unknown }).sid);
    if (!sid) {
      return {
        provider: "twilio",
        status: "failed",
        callSid: input.callSid,
        reason: "twilio response missing CallSid"
      };
    }
    return {
      provider: "twilio",
      status: "queued",
      callSid: input.callSid,
      providerCallSid: sid
    };
  } catch (error) {
    return {
      provider: "twilio",
      status: "failed",
      callSid: input.callSid,
      reason: error instanceof Error ? error.message : "twilio request failed"
    };
  }
};

const endTwilioCall = async (callSid: string): Promise<EndOutboundCallResult> => {
  const accountSid = readEnv(process.env.TWILIO_ACCOUNT_SID);
  const authToken = readEnv(process.env.TWILIO_AUTH_TOKEN);
  if (!accountSid || !authToken) {
    return {
      provider: "twilio",
      status: "failed",
      callSid,
      reason: "TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required"
    };
  }

  const normalizedSid = normalizeCallSid(callSid);
  if (!normalizedSid) {
    return {
      provider: "twilio",
      status: "failed",
      callSid,
      reason: "callSid is required for provider hangup"
    };
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls/${encodeURIComponent(
    normalizedSid
  )}.json`;
  const params = new URLSearchParams({
    Status: "completed"
  });

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        authorization: buildTwilioAuthHeader(accountSid, authToken),
        "content-type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    });

    if (!response.ok) {
      const text = await response.text();
      if (response.status === 404) {
        return {
          provider: "twilio",
          status: "completed",
          callSid: normalizedSid,
          reason: `twilio call already ended: ${text?.slice(0, 120) ?? ""}`.trim()
        };
      }
      return {
        provider: "twilio",
        status: "failed",
        callSid: normalizedSid,
        reason: `twilio error: ${response.status} ${response.statusText} ${text?.slice(0, 120) ?? ""}`.trim()
      };
    }

    return {
      provider: "twilio",
      status: "completed",
      callSid: normalizedSid
    };
  } catch (error) {
    return {
      provider: "twilio",
      status: "failed",
      callSid: normalizedSid,
      reason: error instanceof Error ? error.message : "twilio request failed"
    };
  }
};

export async function createOutboundCall(input: OutboundCallInput): Promise<OutboundCallResult> {
  const provider = asProvider();
  if (provider !== "twilio") {
    return createMockResult(input.callSid);
  }
  return createTwilioCall(input);
}

export async function endOutboundCall(callSid: string): Promise<EndOutboundCallResult> {
  const provider = asProvider();
  if (provider !== "twilio") {
    return {
      provider: "mock",
      status: "mock",
      callSid
    };
  }
  return endTwilioCall(callSid);
}

export type { EndOutboundCallResult, OutboundCallInput, OutboundCallResult };
