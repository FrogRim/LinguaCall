/**
 * Pure PTT helper functions — no browser API or external dependencies.
 * Exported here so they can be tested with Node.js built-in test runner.
 */

export type GreetingPayload = {
  type: "response.create";
  response: { modalities: string[]; instructions: string };
} | null;

/** Returns the greeting event to send on dataChannel open, or null in PTT mode. */
export const buildGreetingPayload = (pttMode: boolean): GreetingPayload => {
  if (pttMode) return null;
  return {
    type: "response.create",
    response: {
      modalities: ["audio", "text"],
      instructions: "Greet the learner briefly and start the conversation immediately."
    }
  };
};

export type PttSessionUpdate = {
  type: "session.update";
  session: { turn_detection: null; input_audio_format: "pcm16" };
};

/** Returns the session.update event that disables server-side VAD for PTT mode. */
export const buildPttSessionUpdate = (): PttSessionUpdate => ({
  type: "session.update",
  session: { turn_detection: null, input_audio_format: "pcm16" }
});

/**
 * Returns true if the transcript text contains any keyword (case-insensitive substring match).
 * Used to detect early-exit phrases spoken by the user.
 */
export const matchesEarlyExitKeyword = (
  transcript: string,
  keywords: string[]
): boolean => {
  const lower = transcript.toLowerCase();
  return keywords.some((kw) => lower.includes(kw.toLowerCase()));
};
