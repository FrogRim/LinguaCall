const fs = require('node:fs');
const path = require('node:path');

const runId = `dev-check-${Date.now()}`;
const root = process.cwd();
const pathEntries = (process.env.PATH || '').split(path.delimiter);
const pathBinEntries = pathEntries.filter((p) => p.toLowerCase().includes('node_modules'));

async function emit(hypothesisId, location, message, data) {
  // #region agent log
  await fetch('http://127.0.0.1:7734/ingest/3a39fe76-9dbc-47cb-b351-fbe2dcfe2b05',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'530fa9'},body:JSON.stringify({sessionId:'530fa9',runId,hypothesisId,location,message,data,timestamp:Date.now()})}).catch(()=>{});
  // #endregion
}

async function main() {
  await emit('H1', 'scripts/debug-dev-check.cjs:14', 'workspace node_modules existence', {
    rootNodeModules: fs.existsSync(path.join(root, 'node_modules')),
    apiNodeModules: fs.existsSync(path.join(root, 'apps', 'api', 'node_modules')),
    webNodeModules: fs.existsSync(path.join(root, 'apps', 'web', 'node_modules')),
  });

  await emit('H2', 'scripts/debug-dev-check.cjs:20', 'expected local bin existence', {
    rootTsxBin: fs.existsSync(path.join(root, 'node_modules', '.bin', 'tsx')),
    rootViteBin: fs.existsSync(path.join(root, 'node_modules', '.bin', 'vite')),
    apiTsxBin: fs.existsSync(path.join(root, 'apps', 'api', 'node_modules', '.bin', 'tsx')),
    webViteBin: fs.existsSync(path.join(root, 'apps', 'web', 'node_modules', '.bin', 'vite')),
  });

  let resolvedTsx = null;
  let resolvedVite = null;
  try {
    resolvedTsx = require.resolve('tsx/package.json');
  } catch (_err) {
    resolvedTsx = null;
  }
  try {
    resolvedVite = require.resolve('vite/package.json');
  } catch (_err) {
    resolvedVite = null;
  }

  await emit('H3', 'scripts/debug-dev-check.cjs:39', 'module resolution status', {
    resolvedTsx,
    resolvedVite,
  });

  await emit('H4', 'scripts/debug-dev-check.cjs:44', 'process execution context', {
    cwd: root,
    npmExecPath: process.env.npm_execpath || null,
    shell: process.env.ComSpec || null,
    nodeVersion: process.version,
  });

  await emit('H5', 'scripts/debug-dev-check.cjs:51', 'PATH node_modules entries', {
    pathNodeModulesEntries: pathBinEntries.slice(0, 20),
    pathContainsNodeModulesBin: pathEntries.some((p) => p.toLowerCase().includes('node_modules') && p.toLowerCase().includes('.bin')),
  });
}

main().catch(() => {});
