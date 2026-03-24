import assert from "node:assert/strict";
import test from "node:test";
import {
  attachOrDisposeResolvedController,
  planLiveSessionEnd,
  type LiveSessionControllerLike,
  type LiveSessionView
} from "./liveSession";

test("planLiveSessionEnd clears a pending connecting session immediately", () => {
  const active: LiveSessionView = {
    sessionId: "session_123",
    state: "connecting",
    controller: null,
    note: "Connecting live audio..."
  };

  const result = planLiveSessionEnd(active, "session_123", "Ending call");

  assert.deepEqual(result, {
    kind: "server_only",
    nextActiveSession: null
  });
});

test("planLiveSessionEnd marks a controlled live session as ending", () => {
  const controller: LiveSessionControllerLike = {
    end: async () => undefined
  };
  const active: LiveSessionView = {
    sessionId: "session_123",
    state: "live",
    controller,
    note: "Live session connected."
  };

  const result = planLiveSessionEnd(active, "session_123", "Ending call");

  assert.equal(result.kind, "controller");
  assert.deepEqual(result.nextActiveSession, {
    ...active,
    state: "ending",
    note: "Ending call"
  });
});

test("attachOrDisposeResolvedController disposes an orphaned controller", async () => {
  const endReasons: string[] = [];
  const controller: LiveSessionControllerLike = {
    end: async (reason?: string) => {
      endReasons.push(reason ?? "");
    }
  };

  const result = await attachOrDisposeResolvedController({
    activeSession: null,
    sessionId: "session_123",
    controller,
    connectedNote: "Waiting for OpenAI Realtime connection..."
  });

  assert.deepEqual(result, {
    kind: "disposed"
  });
  assert.deepEqual(endReasons, ["session_cancelled_before_connect"]);
});
