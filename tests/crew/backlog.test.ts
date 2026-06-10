import { describe, it, expect } from 'vitest';
import { parseBacklog } from '../../scripts/crew/lib/backlog.mjs';

const FIXTURE = `
### BC-01 · Program week never advances — \`done (9f009bd, 2026-06-10)\`
- **Type:** bug · **Priority:** P0 · **Complexity:** M · **Depends on:** —
- **Files:** \`src/domain/periodization.ts\`, \`src/app/lib/bootstrap.ts\`, tests.

### BC-06 · Onboarding & profile screen — \`open\`
- **Type:** feature · **Priority:** P1 · **Complexity:** M · **Depends on:** BC-01
- **Files:** \`src/app/lib/profileForm.ts\`, \`src/domain/profile.ts\`

### BC-07 · Mock placeholder PBI — \`in-progress (someone/2026-06-10)\`
- **Type:** chore · **Priority:** P2 · **Complexity:** S · **Depends on:** BC-01, BC-06
- **Files:** \`docs/BACKLOG.md\`
`;

describe('parseBacklog (mock fixture)', () => {
  const pbis = parseBacklog(FIXTURE);
  it('parses id, title, priority, complexity', () => {
    const bc1 = pbis.find((p) => p.id === 'BC-01');
    expect(bc1).toMatchObject({ priority: 'P0', complexity: 'M', status: 'done' });
    expect(bc1?.title).toBe('Program week never advances');
  });
  it('parses dependsOn as id list, — as empty', () => {
    expect(pbis.find((p) => p.id === 'BC-01')?.dependsOn).toEqual([]);
    expect(pbis.find((p) => p.id === 'BC-07')?.dependsOn).toEqual(['BC-01', 'BC-06']);
  });
  it('parses Files into clean path list, dropping prose like "tests."', () => {
    expect(pbis.find((p) => p.id === 'BC-01')?.files).toEqual([
      'src/domain/periodization.ts',
      'src/app/lib/bootstrap.ts',
    ]);
  });
  it('parses status from header (open/in-progress/done)', () => {
    expect(pbis.find((p) => p.id === 'BC-06')?.status).toBe('open');
    expect(pbis.find((p) => p.id === 'BC-07')?.status).toBe('in-progress');
  });
});
