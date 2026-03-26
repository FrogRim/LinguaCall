import "../../api/src/loadEnv";
import {
  parseWorkerBatchInterval,
  parseWorkerBatchLimit,
  startWorkerBatchLoop
} from "../../api/src/modules/jobs/workerApp";

const intervalMs = parseWorkerBatchInterval();
const limit = parseWorkerBatchLimit();

startWorkerBatchLoop({ intervalMs, limit });

process.stdout.write(`LinguaCall worker started interval=${intervalMs}ms limit=${limit}\n`);
