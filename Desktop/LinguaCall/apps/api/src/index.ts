import "./loadEnv";
import express, { type Request } from "express";
import { createServer } from "node:http";
import cors from "cors";
import helmet from "helmet";
import usersRouter from "./routes/users";
import sessionsRouter from "./routes/sessions";
import callsRouter from "./routes/calls";
import workersRouter from "./routes/workers";
import reportsRouter from "./routes/reports";
import billingRouter from "./routes/billing";
import { attachMediaStreamServer } from "./mediaStream";
import { mediaRuntime } from "./mediaRuntime";
import { store } from "./storage/inMemoryStore";
import { classifyMediaStreamFailureReason } from "./callFaultClassifier";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(helmet());
app.use(cors());
app.use(
  express.json({
    verify: (req: Request, _res, buffer) => {
      if (buffer && buffer.length > 0) {
        (req as Request & { rawBody?: string }).rawBody = buffer.toString("utf8");
      }
    }
  })
);
app.use(express.urlencoded({ extended: true }));

app.get("/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "lingua-call-api",
    requestId: "health-" + Date.now()
  });
  return;
});

app.use("/users", usersRouter);
app.use("/sessions", sessionsRouter);
app.use("/calls", callsRouter);
app.use("/workers", workersRouter);
app.use("/reports", reportsRouter);
app.use("/billing", billingRouter);

const parseWorkerBatchInterval = () => {
  const raw = process.env.WORKER_BATCH_INTERVAL_MS;
  if (!raw) {
    return 30000;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed < 1000 ? 30000 : parsed;
};

const parseWorkerBatchLimit = () => {
  const raw = process.env.WORKER_BATCH_LIMIT;
  if (!raw) {
    return 20;
  }
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 20 : parsed;
};

const workerBatchLimit = parseWorkerBatchLimit();
const runWorkerBatchLoop = async () => {
  try {
    const dispatched = await store.dispatchDueScheduledSessions(workerBatchLimit);
    const reminders = await store.sendDueReminders(workerBatchLimit);
    const missed = await store.markMissedScheduledSessions(workerBatchLimit);
    const reportNotifications = await store.sendReportReadyNotifications(workerBatchLimit);
    if (
      dispatched.length > 0 ||
      reminders.sent > 0 ||
      missed.marked > 0 ||
      reportNotifications.notified > 0
    ) {
      console.log(
        `worker-batch: dispatched=${dispatched.length}, reminders=${reminders.sent}, missed=${missed.marked}, reportNotifications=${reportNotifications.notified}`
      );
    }
  } catch (error) {
    console.error("worker-batch failed", error);
  }
};

let workerBatchInFlight = false;
const scheduleWorkerBatch = () => {
  const interval = parseWorkerBatchInterval();
  const run = async () => {
    if (workerBatchInFlight) {
      return;
    }
    workerBatchInFlight = true;
    try {
      await runWorkerBatchLoop();
    } finally {
      workerBatchInFlight = false;
    }
  };

  void run();
  setInterval(() => {
    void run();
  }, interval);
};

app.use((req, res) => {
  res.status(404).json({
    ok: false,
    error: { code: "not_found", message: `No route found: ${req.method} ${req.path}` }
  });
});

const server = createServer(app);
if (process.env.ENABLE_WORKER_BATCH_LOOP === "true") {
  scheduleWorkerBatch();
}
const enableTwilioMediaStream =
  process.env.ENABLE_TWILIO_MEDIA_STREAM === "true" ||
  process.env.CALL_PROVIDER === "twilio";

if (enableTwilioMediaStream) {
  attachMediaStreamServer(server, {
    onInboundAudio: async (frame) => {
      await mediaRuntime.handleInboundAudio(frame);
    },
    onStreamClose: (sessionId) => {
      if (!sessionId) {
        return;
      }
      mediaRuntime.clearSession(sessionId);
    },
    onStreamFault: async (sessionId, reason, details) => {
      if (!sessionId) {
        return;
      }
      const failureReason = classifyMediaStreamFailureReason(reason, details?.code);
      await store.markSessionTerminal(sessionId, "provider_error", failureReason).catch(() => undefined);
      await store.markMediaStreamError(sessionId, "media_stream_fault", {
        reason,
        details,
        at: new Date().toISOString()
      }).catch(() => undefined);
    }
  });
}

server.listen(PORT, () => {
  console.log(`LinguaCall API listening on :${PORT}`);
});

export default app;
