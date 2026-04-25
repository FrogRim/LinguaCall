import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

delete process.env.WORKER_SHARED_SECRET;

vi.mock("../storage/inMemoryStore", () => {
  return {
    store: {
      getReportDeliveryStates: vi.fn(async () => [])
    }
  };
});

vi.mock("../modules/jobs/workerApp", () => {
  return {
    runWorkerBatchOnce: vi.fn(async () => ({
      dispatched: { dispatched: [], count: 0 },
      reminders: { sent: 0, sessionIds: [] },
      missed: { marked: 0, sessionIds: [] },
      reportNotifications: { notified: 0, reportIds: [] },
      ranAt: new Date().toISOString()
    }))
  };
});

vi.mock("../modules/jobs/schedulerJobs", () => {
  return {
    dispatchScheduledSessions: vi.fn(async () => ({ dispatched: [], count: 0 })),
    markMissedScheduledSessions: vi.fn(async () => ({ marked: 0, sessionIds: [] })),
    sendScheduledReminders: vi.fn(async () => ({ sent: 0, sessionIds: [] }))
  };
});

vi.mock("../modules/jobs/reportJobs", () => {
  return {
    sendReportReadyNotifications: vi.fn(async () => ({ notified: 0, reportIds: [] }))
  };
});

import workersRouter from "../routes/workers";

describe("worker route security", () => {
  it("rejects worker execution when the shared secret is missing", async () => {
    const app = express();
    app.use(express.json());
    app.use("/workers", workersRouter);

    const response = await request(app).post("/workers/run");

    expect(response.status).toBe(401);
    expect(response.body.error?.message).toBe("worker secret not configured");
  });
});
