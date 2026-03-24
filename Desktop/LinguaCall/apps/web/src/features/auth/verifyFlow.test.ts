import assert from "node:assert/strict";
import test from "node:test";
import { completeVerifiedSession } from "./verifyFlow";

test("completeVerifiedSession refreshes session before navigating", async () => {
  const events: string[] = [];

  await completeVerifiedSession({
    refreshSession: async () => {
      events.push("refresh:start");
      await Promise.resolve();
      events.push("refresh:end");
    },
    navigate: (path) => {
      events.push(`navigate:${path}`);
    }
  });

  assert.deepEqual(events, ["refresh:start", "refresh:end", "navigate:/session"]);
});
