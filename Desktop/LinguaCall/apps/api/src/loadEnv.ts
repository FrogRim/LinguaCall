import { existsSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const normalizedApiSuffix = path.normalize("apps/api");
const isRunningFromApiDir = path.normalize(cwd).endsWith(normalizedApiSuffix);

const candidateEnvPaths = isRunningFromApiDir
  ? [path.resolve(cwd, ".env")]
  : [path.resolve(cwd, "apps/api/.env"), path.resolve(cwd, ".env")];

for (const candidatePath of candidateEnvPaths) {
  if (!existsSync(candidatePath)) {
    continue;
  }

  try {
    process.loadEnvFile(candidatePath);
    break;
  } catch {
    // Continue to the next candidate path.
  }
}
