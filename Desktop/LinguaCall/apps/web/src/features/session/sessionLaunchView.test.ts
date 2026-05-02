import assert from "node:assert/strict";
import test from "node:test";
import {
  getSessionConstraintState,
  selectSessionSpotlight
} from "./sessionLaunchView";

test("selectSessionSpotlight prioritizes an active live session", () => {
  const result = selectSessionSpotlight({
    activeSessionId: "session_live",
    sessions: [
      {
        id: "session_scheduled",
        status: "scheduled",
        scheduledForAtUtc: "2026-05-02T03:30:00.000Z"
      }
    ]
  });

  assert.deepEqual(result, {
    kind: "live"
  });
});

test("selectSessionSpotlight falls back to the earliest scheduled session", () => {
  const now = Date.now;
  Date.now = () => new Date("2026-05-02T03:00:00.000Z").getTime();

  try {
    const result = selectSessionSpotlight({
      activeSessionId: null,
      sessions: [
        {
          id: "session_later",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T05:00:00.000Z"
        },
        {
          id: "session_sooner",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T04:00:00.000Z"
        },
        {
          id: "session_done",
          status: "completed",
          scheduledForAtUtc: null
        }
      ]
    });

    assert.deepEqual(result, {
      kind: "scheduled",
      scheduledForAtUtc: "2026-05-02T04:00:00.000Z"
    });
  } finally {
    Date.now = now;
  }
});

test("selectSessionSpotlight ignores scheduled sessions that are already in the past", () => {
  const now = Date.now;
  Date.now = () => new Date("2026-05-02T04:30:00.000Z").getTime();

  try {
    const result = selectSessionSpotlight({
      activeSessionId: null,
      sessions: [
        {
          id: "session_past",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T04:00:00.000Z"
        },
        {
          id: "session_future",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T05:00:00.000Z"
        }
      ]
    });

    assert.deepEqual(result, {
      kind: "scheduled",
      scheduledForAtUtc: "2026-05-02T05:00:00.000Z"
    });
  } finally {
    Date.now = now;
  }
});

test("selectSessionSpotlight keeps a session that is exactly at the current scheduled time", () => {
  const now = Date.now;
  Date.now = () => new Date("2026-05-02T05:00:00.000Z").getTime();

  try {
    const result = selectSessionSpotlight({
      activeSessionId: null,
      sessions: [
        {
          id: "session_now",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T05:00:00.000Z"
        },
        {
          id: "session_future",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T05:30:00.000Z"
        }
      ]
    });

    assert.deepEqual(result, {
      kind: "scheduled",
      scheduledForAtUtc: "2026-05-02T05:00:00.000Z"
    });
  } finally {
    Date.now = now;
  }
});

test("selectSessionSpotlight becomes empty when only past scheduled sessions remain", () => {
  const now = Date.now;
  Date.now = () => new Date("2026-05-02T06:00:00.000Z").getTime();

  try {
    const result = selectSessionSpotlight({
      activeSessionId: null,
      sessions: [
        {
          id: "session_past_1",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T04:00:00.000Z"
        },
        {
          id: "session_past_2",
          status: "scheduled",
          scheduledForAtUtc: "2026-05-02T05:00:00.000Z"
        }
      ]
    });

    assert.deepEqual(result, {
      kind: "empty"
    });
  } finally {
    Date.now = now;
  }
});

test("getSessionConstraintState marks 10-minute-only launch access", () => {
  assert.equal(getSessionConstraintState([10]), "ten_minute_only");
});

test("getSessionConstraintState marks 15-minute access when available", () => {
  assert.equal(getSessionConstraintState([10, 15]), "ten_or_fifteen");
});
