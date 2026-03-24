import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/linguacall_test";
});

import { store } from "../storage/inMemoryStore";

const baseSessionRow = {
  id: "session-1",
  public_id: "PUB_1",
  user_id: "user-1",
  status: "connecting",
  status_detail: null,
  contact_mode: "immediate",
  language: "en",
  exam: "opic",
  level: "IM2",
  topic: "daily routine",
  duration_target_minutes: 10,
  timezone: "Asia/Seoul",
  scheduled_for_at_utc: null,
  dispatch_deadline_at_utc: null,
  reminder_at_utc: null,
  reminder_sent: false,
  reminder_sent_at: null,
  prompt_version: null,
  call_id: "WV_123",
  report_status: "not_requested",
  failure_reason: null,
  accuracy_policy: null,
  accuracy_state: null,
  reserved_trial_call: false,
  reserved_minutes: 10,
  provider_call_sid: null,
  last_provider_sequence_number: 0,
  created_at: "2026-03-24T00:00:00.000Z",
  updated_at: "2026-03-24T00:00:00.000Z",
  answered_at: null,
  completed_at: null,
  ended_at: null
};

describe("endSessionCall", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("cancels a web voice session that is still connecting and releases reserved allowance", async () => {
    const cancelledRow = {
      ...baseSessionRow,
      status: "cancelled",
      reserved_minutes: 0,
      updated_at: "2026-03-24T00:05:00.000Z",
      ended_at: "2026-03-24T00:05:00.000Z"
    };

    const query = vi.fn(async (sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return { rows: [] };
      }
      if (sql.includes("SELECT *") && sql.includes("FOR UPDATE")) {
        return { rows: [baseSessionRow] };
      }
      if (sql.includes("SET status = 'cancelled'")) {
        return { rows: [cancelledRow] };
      }
      return { rows: [] };
    });

    vi.spyOn(store as never, "getUser").mockResolvedValue({
      id: "user-1",
      clerk_user_id: "local:user-1"
    } as never);
    vi.spyOn((store as unknown as { pool: { connect: () => Promise<unknown> } }).pool, "connect").mockResolvedValue({
      query,
      release: vi.fn()
    } as never);
    const releaseAllowance = vi.spyOn(store as never, "releaseScheduledAllowance") as any;
    releaseAllowance.mockResolvedValue(undefined);
    const commitAllowance = vi.spyOn(store as never, "commitScheduledAllowance") as any;
    commitAllowance.mockResolvedValue(undefined);
    const writeWebhookEvent = vi.spyOn(store as never, "writeWebhookEvent") as any;
    writeWebhookEvent.mockResolvedValue(undefined);

    const result = await store.endSessionCall("local:user-1", "session-1");

    expect(result.status).toBe("cancelled");
    expect(releaseAllowance).toHaveBeenCalledOnce();
    expect(commitAllowance).not.toHaveBeenCalled();
    expect(writeWebhookEvent).toHaveBeenCalledWith(
      expect.anything(),
      "media",
      expect.stringContaining("end:session-1"),
      expect.objectContaining({ event: "app_end_call", status: "cancelled" }),
      "web_voice"
    );
  });
});
