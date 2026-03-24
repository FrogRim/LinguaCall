export type LiveSessionControllerLike = {
  end: (endReason?: string) => Promise<void>;
};

export type LiveSessionView = {
  sessionId: string;
  state: string;
  controller: LiveSessionControllerLike | null;
  note?: string;
};

export const planLiveSessionEnd = <T extends LiveSessionView>(
  activeSession: T | null,
  sessionId: string,
  endingNote: string
):
  | { kind: "controller"; nextActiveSession: T }
  | { kind: "server_only"; nextActiveSession: T | null } => {
  if (!activeSession || activeSession.sessionId !== sessionId) {
    return {
      kind: "server_only",
      nextActiveSession: activeSession
    };
  }

  if (!activeSession.controller) {
    return {
      kind: "server_only",
      nextActiveSession: null
    };
  }

  return {
    kind: "controller",
    nextActiveSession: {
      ...activeSession,
      state: "ending",
      note: endingNote
    }
  };
};

export const attachOrDisposeResolvedController = async <T extends LiveSessionView>({
  activeSession,
  sessionId,
  controller,
  connectedNote
}: {
  activeSession: T | null;
  sessionId: string;
  controller: LiveSessionControllerLike;
  connectedNote: string;
}): Promise<
  | { kind: "attached"; nextActiveSession: T }
  | { kind: "disposed" }
> => {
  if (activeSession && activeSession.sessionId === sessionId) {
    return {
      kind: "attached",
      nextActiveSession: {
        ...activeSession,
        controller,
        note: connectedNote
      }
    };
  }

  await controller.end("session_cancelled_before_connect").catch(() => undefined);
  return {
    kind: "disposed"
  };
};
