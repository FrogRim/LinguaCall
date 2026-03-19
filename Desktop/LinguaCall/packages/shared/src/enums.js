"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.failureReasons = exports.reportStatuses = exports.sessionStatuses = void 0;
exports.sessionStatuses = {
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
};
exports.reportStatuses = {
    notRequested: "not_requested",
    ready: "ready",
    pending: "pending",
    failed: "failed"
};
exports.failureReasons = {
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
};
