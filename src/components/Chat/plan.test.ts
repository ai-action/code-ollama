import {
  hasExecutablePlan,
  isDirectPlanAnswer,
  isPlanModeFinal,
  isPlanNeedsInput,
} from './plan';

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

describe('isPlanModeFinalResponse', () => {
  it('returns true for Plan Needs Input responses', () => {
    expect(
      isPlanModeFinal('## Plan Needs Input\n\n### Questions\n- Which file?'),
    ).toBe(true);
  });

  it('returns true for Proposed Plan responses', () => {
    expect(isPlanModeFinal('## Proposed Plan\n\n### Summary\nUpdate it')).toBe(
      true,
    );
  });

  it('ignores leading whitespace before the heading', () => {
    expect(isPlanModeFinal('\n\n  ## Plan Needs Input\n\n### Questions')).toBe(
      true,
    );
  });

  it('returns false for ordinary research text', () => {
    expect(isPlanModeFinal('Research complete.')).toBe(false);
  });
});

describe('isPlanNeedsInputResponse', () => {
  it('returns true only for Plan Needs Input as the first heading', () => {
    expect(
      isPlanNeedsInput(
        [
          '## Plan Needs Input',
          '',
          '### Draft Plan',
          '- Confirm the target',
          '',
          '## Proposed Plan',
          '',
          '### Execution Steps',
          '- edit_file("src/app.ts") - Update it',
        ].join('\n'),
      ),
    ).toBe(true);
  });

  it('returns false for Proposed Plan responses', () => {
    expect(
      isPlanNeedsInput(
        '## Proposed Plan\n\n### Execution Steps\n- edit_file("src/app.ts")',
      ),
    ).toBe(false);
  });
});

describe('isDirectPlanAnswer', () => {
  it('returns true for ordinary informational answers', () => {
    expect(
      isDirectPlanAnswer('You can change this in src/cli.ts and Chat.tsx.'),
    ).toBe(true);
  });

  it('returns false for empty content', () => {
    expect(isDirectPlanAnswer('')).toBe(false);
  });

  it('returns false for generic research completion markers', () => {
    expect(isDirectPlanAnswer('Research complete.')).toBe(false);
    expect(isDirectPlanAnswer('Done')).toBe(false);
  });

  it('returns false for templated plan responses', () => {
    expect(isDirectPlanAnswer('## Plan Needs Input\n\n### Questions')).toBe(
      false,
    );
    expect(isDirectPlanAnswer('## Proposed Plan\n\n### Summary')).toBe(false);
  });
});
