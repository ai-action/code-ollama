import type { Plan } from '@/types';

import { parsePlan, renderPlan, serializePlanForExecution } from './plan';

const READY_PLAN: Plan = {
  kind: 'ready',
  title: 'Add structured plans',
  summary: 'Use a control tool for Plan-mode completion.',
  tasks: [
    {
      id: 'task-1',
      description: 'Add the plan contract',
      dependencies: [],
      verification: 'The validator tests pass',
    },
    {
      id: 'task-2',
      description: 'Integrate plan submission',
      dependencies: ['task-1'],
      verification: 'The Chat tests pass',
    },
  ],
  tests: ['Run the Plan-mode tests'],
  assumptions: ['Tool calling is required'],
  questions: [],
};

describe('parsePlan', () => {
  it('parses a ready plan', () => {
    expect(parsePlan(READY_PLAN)).toEqual(READY_PLAN);
  });

  it('requires tasks for a ready plan', () => {
    expect(() => parsePlan({ ...READY_PLAN, tasks: [] })).toThrow(
      'ready plans require at least one task',
    );
  });

  it('requires questions when input is needed', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        kind: 'needs_input',
        tasks: [],
        questions: [],
      }),
    ).toThrow('needs_input plans require at least one question');
  });

  it('rejects tasks in an informational answer', () => {
    expect(() => parsePlan({ ...READY_PLAN, kind: 'answer' })).toThrow(
      'answer submissions cannot contain tasks',
    );
  });

  it('rejects duplicate task IDs', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tasks: [READY_PLAN.tasks[0], READY_PLAN.tasks[0]],
      }),
    ).toThrow('task IDs must be unique');
  });

  it('rejects unknown and self dependencies', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tasks: [{ ...READY_PLAN.tasks[0], dependencies: ['missing'] }],
      }),
    ).toThrow('unknown dependency: missing');

    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tasks: [{ ...READY_PLAN.tasks[0], dependencies: ['task-1'] }],
      }),
    ).toThrow('cannot depend on itself');
  });

  it('requires dependencies to reference earlier tasks', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tasks: [READY_PLAN.tasks[1], READY_PLAN.tasks[0]],
      }),
    ).toThrow('dependency must reference an earlier task: task-1');
  });

  it('rejects malformed fields', () => {
    expect(() => parsePlan({ ...READY_PLAN, summary: '' })).toThrow(
      'summary must be a non-empty string',
    );
    expect(() => parsePlan({ ...READY_PLAN, tests: 'test' })).toThrow(
      'tests must be an array',
    );
    expect(() => parsePlan({ ...READY_PLAN, kind: 'draft' })).toThrow(
      'kind must be ready, needs_input, or answer',
    );
  });

  it('rejects non-object arguments', () => {
    expect(() => parsePlan(null)).toThrow(
      'submit_plan arguments must be an object',
    );
    expect(() => parsePlan('plan')).toThrow(
      'submit_plan arguments must be an object',
    );
    expect(() => parsePlan([])).toThrow(
      'submit_plan arguments must be an object',
    );
  });

  it('rejects non-array tasks', () => {
    expect(() => parsePlan({ ...READY_PLAN, tasks: 'tasks' })).toThrow(
      'tasks must be an array',
    );
  });

  it('rejects a task that is not an object', () => {
    expect(() =>
      parsePlan({ ...READY_PLAN, tasks: ['not an object'] }),
    ).toThrow('tasks[0] must be an object');
  });
});

describe('renderPlan', () => {
  it('renders a ready plan with application-owned headings', () => {
    const rendered = renderPlan(READY_PLAN);

    expect(rendered).toContain('## Proposed Plan');
    expect(rendered).toContain('### Tasks');
    expect(rendered).toContain('task-2: Integrate plan submission');
    expect(rendered).toContain('Dependencies: task-1');
    expect(rendered).toContain('### Test Plan');
    expect(rendered).toContain('### Assumptions');
  });

  it('renders a ready plan without optional sections when empty', () => {
    const rendered = renderPlan({ ...READY_PLAN, tests: [], assumptions: [] });

    expect(rendered).toContain('## Proposed Plan');
    expect(rendered).not.toContain('### Test Plan');
    expect(rendered).not.toContain('### Assumptions');
  });

  it('renders questions without a reviewable plan', () => {
    const rendered = renderPlan({
      ...READY_PLAN,
      kind: 'needs_input',
      tasks: [],
      questions: ['Which behavior should be used?'],
    });

    expect(rendered).toContain('## Plan Needs Input');
    expect(rendered).toContain('### Questions');
    expect(rendered).not.toContain('### Draft Tasks');
  });

  it('renders informational answers as ordinary Markdown', () => {
    expect(
      renderPlan({
        ...READY_PLAN,
        kind: 'answer',
        tasks: [],
        tests: [],
        assumptions: [],
      }),
    ).toBe(
      '## Add structured plans\n\nUse a control tool for Plan-mode completion.',
    );
  });
});

it('serializes the exact plan for execution', () => {
  expect(JSON.parse(serializePlanForExecution(READY_PLAN))).toEqual(READY_PLAN);
});
