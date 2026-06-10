import { describe, it, expect } from 'vitest';
import { globToRegExp } from '../../scripts/crew/lib/glob.mjs';

describe('globToRegExp (mock paths)', () => {
  it('matches a single-segment * within a dir', () => {
    expect(globToRegExp('src/domain/*.ts').test('src/domain/schedule.ts')).toBe(true);
    expect(globToRegExp('src/domain/*.ts').test('src/domain/sub/x.ts')).toBe(false);
  });
  it('matches ** across segments', () => {
    expect(globToRegExp('src/app/**/page.tsx').test('src/app/program/page.tsx')).toBe(true);
    expect(globToRegExp('src/app/**').test('src/app/lib/date.ts')).toBe(true);
  });
  it('matches exact paths and escapes dots', () => {
    expect(globToRegExp('package.json').test('package.json')).toBe(true);
    expect(globToRegExp('package.json').test('packageXjson')).toBe(false);
  });
});
