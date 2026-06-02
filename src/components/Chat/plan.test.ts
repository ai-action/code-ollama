import { hasExecutablePlan } from './plan';

const PLAN_WITH_STEPS = [
  '## Proposed Plan',
  '',
  '### Execution Steps',
  '',
].join('\n');

describe('hasExecutablePlan', () => {
  it('returns true for a plan with at least one execution step', () => {
    expect(
      hasExecutablePlan(
        `${PLAN_WITH_STEPS}- write_file("src/app.ts") - Update the file`,
      ),
    ).toBe(true);
  });

  it('returns true for a plan step using a bullet asterisk', () => {
    expect(
      hasExecutablePlan(
        `${PLAN_WITH_STEPS}* run_shell("npm test") - Run the test suite`,
      ),
    ).toBe(true);
  });

  it('returns true when execution steps section has multiple items', () => {
    expect(
      hasExecutablePlan(
        `${PLAN_WITH_STEPS}- edit_file("src/app.ts") - Refine logic\n- run_shell("npm test") - Verify`,
      ),
    ).toBe(true);
  });

  it('returns true when a next section follows execution steps', () => {
    expect(
      hasExecutablePlan(
        `${PLAN_WITH_STEPS}- run_shell("npm run build") - Verify build\n\n## Notes\n\nSome notes`,
      ),
    ).toBe(true);
  });

  it('returns false for conversational text', () => {
    expect(hasExecutablePlan('This can be answered directly.')).toBe(false);
  });

  it('returns false when Proposed Plan section is missing', () => {
    expect(
      hasExecutablePlan(
        '### Execution Steps\n\n- run_shell("npm test") - Run tests',
      ),
    ).toBe(false);
  });

  it('returns false when Execution Steps section is missing', () => {
    expect(
      hasExecutablePlan(
        '## Proposed Plan\n\n- run_shell("npm test") - Run tests',
      ),
    ).toBe(false);
  });

  it('returns false when Execution Steps section has no bullet items', () => {
    expect(hasExecutablePlan(PLAN_WITH_STEPS)).toBe(false);
  });
});
