import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGreetingPayload,
  buildPttSessionUpdate,
  matchesEarlyExitKeyword,
} from "./pttHelpers.ts";
import { buildHighlightSegments } from "./highlightHelpers.ts";

// ── buildGreetingPayload ──────────────────────────────────────────────────────

test("buildGreetingPayload: normal mode returns a response.create event", () => {
  const payload = buildGreetingPayload(false);
  assert.ok(payload !== null, "should return a payload in normal mode");
  assert.equal(payload.type, "response.create");
  assert.ok(
    typeof payload.response?.instructions === "string" &&
      payload.response.instructions.length > 0,
    "should contain instructions"
  );
});

test("buildGreetingPayload: PTT mode returns null (no auto-greeting)", () => {
  const payload = buildGreetingPayload(true);
  assert.equal(
    payload,
    null,
    "PTT mode must not send an automatic greeting"
  );
});

// ── buildPttSessionUpdate ─────────────────────────────────────────────────────

test("buildPttSessionUpdate: type is session.update", () => {
  const update = buildPttSessionUpdate();
  assert.equal(update.type, "session.update");
});

test("buildPttSessionUpdate: turn_detection is null (VAD disabled)", () => {
  const update = buildPttSessionUpdate();
  assert.equal(
    update.session.turn_detection,
    null,
    "PTT mode must disable server-side VAD"
  );
});

test("buildPttSessionUpdate: input_audio_format is pcm16", () => {
  const update = buildPttSessionUpdate();
  assert.equal(update.session.input_audio_format, "pcm16");
});

// ── matchesEarlyExitKeyword ───────────────────────────────────────────────────

test("matchesEarlyExitKeyword: returns true for exact Korean keyword", () => {
  assert.equal(matchesEarlyExitKeyword("끝내자", ["끝내자", "그만하자"]), true);
});

test("matchesEarlyExitKeyword: returns true when keyword is a substring", () => {
  assert.equal(matchesEarlyExitKeyword("이제 끝내자 진짜", ["끝내자"]), true);
});

test("matchesEarlyExitKeyword: case-insensitive match for English keyword", () => {
  assert.equal(matchesEarlyExitKeyword("Let's Finish now", ["let's finish"]), true);
});

test("matchesEarlyExitKeyword: returns false when no keywords match", () => {
  assert.equal(matchesEarlyExitKeyword("좋아 계속하자", ["끝내자", "그만하자"]), false);
});

test("matchesEarlyExitKeyword: returns false for empty keywords list", () => {
  assert.equal(matchesEarlyExitKeyword("끝내자", []), false);
});

// ── buildHighlightSegments ────────────────────────────────────────────────────

test("buildHighlightSegments: no corrections returns single normal segment", () => {
  const segs = buildHighlightSegments("Hello world", []);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].type, "normal");
  assert.equal(segs[0].text, "Hello world");
});

test("buildHighlightSegments: marks issue as error segment with suggestion", () => {
  const segs = buildHighlightSegments("I goed to school", [
    { timestamp_ms_from_call_start: 0, issue: "goed", suggestion: "went" }
  ]);
  const errorSeg = segs.find(s => s.type === "error");
  assert.ok(errorSeg, "should have an error segment");
  assert.equal(errorSeg?.text, "goed");
  assert.equal(errorSeg?.suggestion, "went");
});

test("buildHighlightSegments: surrounding text stays normal", () => {
  const segs = buildHighlightSegments("I goed to school", [
    { timestamp_ms_from_call_start: 0, issue: "goed", suggestion: "went" }
  ]);
  const normal = segs.filter(s => s.type === "normal");
  assert.ok(normal.length >= 1);
  assert.ok(normal.some(s => s.text.includes("I")));
});

test("buildHighlightSegments: issue match is case-insensitive", () => {
  const segs = buildHighlightSegments("I Goed to school", [
    { timestamp_ms_from_call_start: 0, issue: "goed", suggestion: "went" }
  ]);
  const errorSeg = segs.find(s => s.type === "error");
  assert.ok(errorSeg, "should match case-insensitively");
});
