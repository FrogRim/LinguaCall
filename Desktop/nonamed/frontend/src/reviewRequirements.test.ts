import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = process.cwd();
const indexHtml = readFileSync(resolve(rootDir, 'index.html'), 'utf8');
const indexCss = readFileSync(resolve(rootDir, 'src/index.css'), 'utf8');
const sourceFiles = [
  'src/AuthBootstrapGate.tsx',
  'src/pages/Builder.tsx',
  'src/pages/Dashboard.tsx',
  'src/pages/History.tsx',
  'src/components/HarnessCard.tsx',
  'src/components/ConditionSlider.tsx',
  'src/components/SummaryCard.tsx',
].map((relativePath) => ({
  relativePath,
  content: readFileSync(resolve(rootDir, relativePath), 'utf8'),
}));

describe('App-in-Toss review requirements', () => {
  it('uses app-specific Korean metadata in index.html', () => {
    expect(indexHtml).toContain('<html lang="ko">');
    expect(indexHtml).toContain('<title>AI 투자 하니스</title>');
    expect(indexHtml).not.toContain('<title>frontend</title>');
  });

  it('locks the app to light mode only', () => {
    expect(indexCss).toContain('color-scheme: light;');
    expect(indexCss).not.toContain('color-scheme: light dark;');
    expect(indexCss).not.toContain('@media (prefers-color-scheme: dark)');
  });

  it('removes local TDS stub imports from shipped frontend files', () => {
    for (const file of sourceFiles) {
      expect(file.content).not.toMatch(/from ['"](?:\.\/tds|\.\/components\/tds|\.\.\/tds|\.\.\/components\/tds)['"]/);
    }
  });
});
