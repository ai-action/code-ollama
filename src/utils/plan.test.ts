import { hasExecutablePlan } from './plan';

describe('hasExecutablePlan', () => {
  it('returns true for a write_file plan step', () => {
    expect(
      hasExecutablePlan('- [ ] write_file("src/app.ts", "content") - Update'),
    ).toBe(true);
  });

  it('returns true for a run_shell plan step', () => {
    expect(
      hasExecutablePlan('- [ ] run_shell("npm test") - Run the test suite'),
    ).toBe(true);
  });

  it('returns true for an edit_file plan step', () => {
    expect(
      hasExecutablePlan(
        '- [ ] edit_file("src/app.ts", "oldText", "newText") - Refine logic',
      ),
    ).toBe(true);
  });

  it('returns true when an executable step appears later in the content', () => {
    expect(
      hasExecutablePlan(
        'Here is the plan:\n\n- [ ] run_shell("npm run build") - Verify build',
      ),
    ).toBe(true);
  });

  it('returns false for conversational text', () => {
    expect(hasExecutablePlan('This can be answered directly.')).toBe(false);
  });

  it('returns false for checklist items without executable tools', () => {
    expect(hasExecutablePlan('- [ ] explain the bug')).toBe(false);
  });

  it('returns false for unsupported tool names', () => {
    expect(
      hasExecutablePlan('- [ ] deploy("production") - Release the build'),
    ).toBe(false);
  });
});
