import { join } from "node:path";
import { pathToFileURL } from "node:url";

const appRoot = process.cwd();

const loadModule = async (relativePath) => {
  const url = pathToFileURL(join(appRoot, relativePath)).href;
  return import(url);
};

await loadModule("apps/api/dist/loadEnv.js");

const { parseWorkerBatchInterval, parseWorkerBatchLimit, startWorkerBatchLoop } = await loadModule(
  "apps/api/dist/modules/jobs/workerApp.js"
);

const intervalMs = parseWorkerBatchInterval();
const limit = parseWorkerBatchLimit();

startWorkerBatchLoop({ intervalMs, limit });

process.stdout.write(`LinguaCall worker started interval=${intervalMs}ms limit=${limit}\n`);
