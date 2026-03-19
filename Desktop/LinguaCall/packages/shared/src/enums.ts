export const sessionStatuses = {
  draft: "draft",
  ready: "ready",
  scheduled: "scheduled",
  connecting: "connecting",
  dialing: "dialing",
  ringing: "ringing",
  inProgress: "in_progress",
  ending: "ending",
  completed: "completed",
  failed: "failed",
  cancelled: "cancelled",
  noAnswer: "no_answer",
  busy: "busy",
  voicemail: "voicemail",
  userCancelled: "user_cancelled",
  providerError: "provider_error",
  scheduleMissed: "schedule_missed"
} as const;

export const reportStatuses = {
  notRequested: "not_requested",
  ready: "ready",
  pending: "pending",
  failed: "failed"
} as const;

export const failureReasons = {
  none: "none",
  twilioNoAnswerTimeout: "twilio_no_answer_timeout",
  twilioSipError: "twilio_sip_error",
  providerError: "provider_error",
  platformFault: "platform_fault",
  validationError: "validation_error",
  micPermissionDenied: "mic_permission_denied",
  networkError: "network_error",
  mediaConnectionFailed: "media_connection_failed",
  userNoShow: "user_no_show"
} as const;

export type SessionStatus = keyof typeof sessionStatuses extends never
  ? never
  : (typeof sessionStatuses)[keyof typeof sessionStatuses];

export type ContactMode = "immediate" | "scheduled_once";
export type WebhookProvider = "twilio" | "kakao" | "telegram" | "payments";
export type ReportStatus = keyof typeof reportStatuses extends never
  ? never
  : (typeof reportStatuses)[keyof typeof reportStatuses];
export type FailureReason = keyof typeof failureReasons extends never
  ? never
  : (typeof failureReasons)[keyof typeof failureReasons];

export type LessonLanguage = "en" | "de" | "zh" | "es";
export type ExamType = "opic" | "goethe_b2" | "hsk5" | "dele_b1";
