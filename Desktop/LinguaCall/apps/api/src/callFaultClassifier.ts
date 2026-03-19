import { FailureReason } from "@lingua/shared";

const normalizeWebhookCode = (value: string | number | null | undefined): number | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  const code = Number.parseInt(String(value), 10);
  return Number.isNaN(code) ? undefined : code;
};

export const classifyTwilioFailureReason = (
  status: string,
  sipCodeValue: string | undefined,
  errorCodeValue: string | undefined,
  answeredByValue?: string | null
): FailureReason | undefined => {
  const normalizedStatus = status.toLowerCase().replace(/_/g, "-");
  const normalizedAnsweredBy = (answeredByValue ?? "").toLowerCase();
  const sipCode = normalizeWebhookCode(sipCodeValue);
  const providerErrorCode = normalizeWebhookCode(errorCodeValue);

  if (normalizedAnsweredBy === "machine" && normalizedStatus !== "no-answer" && normalizedStatus !== "busy") {
    return "platform_fault";
  }

  switch (normalizedStatus) {
    case "busy":
      return "twilio_sip_error";
    case "no-answer":
      return "twilio_no_answer_timeout";
    case "failed":
      if (sipCode !== undefined && sipCode >= 500) {
        return "platform_fault";
      }
      if (providerErrorCode !== undefined && providerErrorCode >= 500 && providerErrorCode <= 599) {
        return "platform_fault";
      }
      return "provider_error";
    case "voicemail":
      return "platform_fault";
    default:
      return undefined;
  }
};

export const isTwilioCompletedPlatformFault = (
  callDuration: number | undefined,
  sipCodeValue: string | undefined,
  errorCodeValue: string | undefined
): boolean => {
  const sipCode = normalizeWebhookCode(sipCodeValue);
  const errorCode = normalizeWebhookCode(errorCodeValue);
  if (!callDuration || callDuration >= 60) {
    return false;
  }
  if (sipCode !== undefined && sipCode >= 500) {
    return true;
  }
  if (errorCode !== undefined && errorCode >= 500 && errorCode <= 599) {
    return true;
  }
  return false;
};

export const classifyMediaStreamFailureReason = (
  reason: string,
  rawCode?: string | number | null
): FailureReason => {
  const code = normalizeWebhookCode(rawCode);

  if (reason === "websocket_unexpected_close") {
    if (code !== undefined && code >= 1000) {
      if (code >= 5000 && code <= 5999) {
        return "platform_fault";
      }
      if (code === 1011 || code === 1014) {
        return "platform_fault";
      }
    }
    return "provider_error";
  }

  if (reason === "websocket_error" || reason === "media_runtime_error") {
    return "platform_fault";
  }

  return "provider_error";
};
