import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const runtimeFiles = [
  'scheduler/batchRunner.ts',
  'worker/kisClient.ts',
  'pusher/pushClient.ts',
] as const;

function readRuntimeSource(relativePath: (typeof runtimeFiles)[number]) {
  return readFileSync(path.join(__dirname, '..', 'src', relativePath), 'utf8');
}

describe('runtime logging hardening', () => {
  it.each(runtimeFiles)('%s does not use raw console logging', (relativePath) => {
    expect(readRuntimeSource(relativePath)).not.toMatch(/console\.(log|error|warn|info)/);
  });

  it('scheduler logging includes harness and indicator context', () => {
    const source = readRuntimeSource('scheduler/batchRunner.ts');

    expect(source).toContain('harnessId: harness.id');
    expect(source).toContain('indicator: c.indicator');
  });

  it('worker and pusher logging include runtime identifiers', () => {
    expect(readRuntimeSource('worker/kisClient.ts')).toContain("harnessId: harness.id");
    expect(readRuntimeSource('pusher/pushClient.ts')).toContain('attempt, maxRetries: MAX_RETRIES');
  });
});
