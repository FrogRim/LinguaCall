import assert from "node:assert/strict";
import test from "node:test";
import { getFriendlyCopy } from "./friendlyCopy";

test("session copy exposes launch spotlight and constraint messages in English", () => {
  const copy = getFriendlyCopy("en").session;

  assert.equal(copy.spotlightLiveTitle, "Live session in progress");
  assert.equal(copy.spotlightScheduledTitle, "Your next reserved session");
  assert.equal(copy.constraintTenMinuteOnly, "Your current access starts with a 10-minute session.");
  assert.equal(copy.constraintTenOrFifteen, "Your current plan supports either a 10-minute or 15-minute session.");
});

test("session copy exposes launch spotlight and constraint messages in Korean", () => {
  const copy = getFriendlyCopy("ko").session;

  assert.equal(copy.spotlightLiveTitle, "지금 진행 중인 통화");
  assert.equal(copy.spotlightScheduledTitle, "가장 먼저 확인할 다음 예약");
  assert.equal(copy.constraintTenMinuteOnly, "현재 이용 상태에서는 10분 세션부터 시작할 수 있습니다.");
  assert.equal(copy.constraintTenOrFifteen, "현재 플랜에서는 10분 또는 15분 세션을 선택할 수 있습니다.");
});
