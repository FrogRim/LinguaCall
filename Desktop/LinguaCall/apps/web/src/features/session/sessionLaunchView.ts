export type SessionSpotlight =
  | { kind: "live" }
  | { kind: "scheduled"; scheduledForAtUtc: string }
  | { kind: "empty" };

export type SessionConstraintState = "ten_minute_only" | "ten_or_fifteen";

type SessionSummary = {
  id: string;
  status: string;
  scheduledForAtUtc?: string | null;
};

export function selectSessionSpotlight(options: {
  activeSessionId: string | null;
  sessions: SessionSummary[];
}): SessionSpotlight {
  if (options.activeSessionId) {
    return { kind: "live" };
  }

  const now = Date.now();
  const nextScheduled = options.sessions
    .filter((session) => {
      if (
        session.status !== "scheduled" ||
        typeof session.scheduledForAtUtc !== "string" ||
        session.scheduledForAtUtc.length === 0
      ) {
        return false;
      }

      return new Date(session.scheduledForAtUtc).getTime() >= now;
    })
    .sort(
      (left, right) =>
        new Date(left.scheduledForAtUtc ?? "").getTime() -
        new Date(right.scheduledForAtUtc ?? "").getTime()
    )[0];

  if (nextScheduled?.scheduledForAtUtc) {
    return {
      kind: "scheduled",
      scheduledForAtUtc: nextScheduled.scheduledForAtUtc
    };
  }

  return { kind: "empty" };
}

export function getSessionConstraintState(
  durationOptions: number[]
): SessionConstraintState {
  return durationOptions.includes(15) ? "ten_or_fifteen" : "ten_minute_only";
}
