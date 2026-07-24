import type { Plan } from '@/types';

import {
  parsePlan,
  renderPlan,
  serializePlanForExecution,
  validatePlanForRequest,
} from './plan';

const PLAN: Plan = {
  title: 'Simplify Plan mode',
  summary: 'Use ordinary conversation until a plan is ready for review.',
  tasks: [
    {
      action: 'change',
      id: 'task-1',
      description: 'Simplify the Plan-mode state machine',
      dependencies: [],
      targets: ['src/components/Chat/hooks/useRunTurn.ts'],
      verification: 'The focused tests pass',
    },
    {
      action: 'verify',
      id: 'task-2',
      description: 'Verify conversational and proposal completion',
      dependencies: ['task-1'],
      targets: [],
      verification: 'The focused tests pass',
    },
  ],
  tests: ['npm test -- run src/components/Chat/plan.test.ts'],
  assumptions: ['Plan proposals are optional'],
};

describe('parsePlan', () => {
  it('parses a valid proposal', () => {
    expect(parsePlan(PLAN)).toEqual(PLAN);
  });

  it('requires a task and concrete change targets', () => {
    expect(() => parsePlan({ ...PLAN, tasks: [] })).toThrow(
      'plan proposals require at least one task',
    );
    expect(() =>
      parsePlan({
        ...PLAN,
        tasks: [{ ...PLAN.tasks[0], targets: [] }],
      }),
    ).toThrow('change task task-1 requires at least one target');
  });

  it('requires meaningful command-based verification for changes', () => {
    expect(() => parsePlan({ ...PLAN, tests: [] })).toThrow(
      'require at least one command-based verification check',
    );
    expect(() => parsePlan({ ...PLAN, tests: ['Run the tests'] })).toThrow(
      'verification checks must be exact shell commands',
    );
    expect(() => parsePlan({ ...PLAN, tests: ['echo done'] })).toThrow(
      'at least one meaningful verification command',
    );
  });

  it('allows inspect-only proposals without commands', () => {
    expect(() =>
      parsePlan({
        ...PLAN,
        tasks: [
          {
            ...PLAN.tasks[0],
            action: 'inspect',
            targets: [],
          },
        ],
        tests: [],
      }),
    ).not.toThrow();
  });

  it('validates task IDs and dependency ordering', () => {
    expect(() =>
      parsePlan({
        ...PLAN,
        tasks: [PLAN.tasks[0], PLAN.tasks[0]],
      }),
    ).toThrow('task IDs must be unique');
    expect(() =>
      parsePlan({
        ...PLAN,
        tasks: [{ ...PLAN.tasks[0], dependencies: ['missing'] }],
      }),
    ).toThrow('unknown dependency: missing');
    expect(() =>
      parsePlan({
        ...PLAN,
        tasks: [{ ...PLAN.tasks[0], dependencies: ['task-1'] }],
      }),
    ).toThrow('cannot depend on itself');
    expect(() =>
      parsePlan({
        ...PLAN,
        tasks: [PLAN.tasks[1], PLAN.tasks[0]],
      }),
    ).toThrow('dependency must reference an earlier task: task-1');
  });

  it('defaults optional arrays and rejects malformed input', () => {
    const parsed = parsePlan({
      ...PLAN,
      tasks: [
        {
          action: 'inspect',
          id: 'task-1',
          description: 'Inspect the implementation',
          verification: 'The relevant code is identified',
        },
      ],
      tests: undefined,
      assumptions: undefined,
    });

    expect(parsed).toMatchObject({
      tests: [],
      assumptions: [],
      tasks: [{ dependencies: [], targets: [] }],
    });
    expect(() => parsePlan(null)).toThrow(
      'plan proposal arguments must be an object',
    );
    expect(() => parsePlan({ ...PLAN, summary: '' })).toThrow(
      'summary must be a non-empty string',
    );
    expect(() => parsePlan({ ...PLAN, tasks: 'tasks' })).toThrow(
      'tasks must be an array',
    );
    expect(() => parsePlan({ ...PLAN, tasks: [null] })).toThrow(
      'tasks[0] must be an object',
    );
    expect(() => parsePlan({ ...PLAN, tests: 'npm test' })).toThrow(
      'tests must be an array',
    );
    expect(() => parsePlan({ ...PLAN, tasks: undefined })).toThrow(
      'plan proposals require at least one task',
    );
    expect(() =>
      parsePlan({
        ...PLAN,
        tasks: [{ ...PLAN.tasks[0], action: 'invalid' }],
      }),
    ).toThrow('tasks[0].action must be inspect, change, or verify');
  });
});

describe('validatePlanForRequest', () => {
  it('rejects proposals for informational requests', () => {
    expect(() =>
      validatePlanForRequest(PLAN, 'Explain where Plan mode is implemented'),
    ).toThrow(
      'plan proposals cannot satisfy an informational request; respond normally',
    );
  });

  it('rejects unresolved proposals', () => {
    expect(() =>
      validatePlanForRequest(
        {
          ...PLAN,
          summary: 'No specific change was provided.',
        },
        'Plan a change',
      ),
    ).toThrow(
      'plan proposals cannot contain unresolved or placeholder work; ask a clarification question normally',
    );
  });

  it('accepts an executable implementation proposal', () => {
    expect(validatePlanForRequest(PLAN, 'Simplify Plan mode')).toBe(PLAN);
  });
});

describe('renderPlan', () => {
  it('renders application-owned headings and readable dependencies', () => {
    const rendered = renderPlan(PLAN);

    expect(rendered).toContain('## Proposed Plan');
    expect(rendered).toContain('### Tasks');
    expect(rendered).toContain(
      '2. **Verify conversational and proposal completion**',
    );
    expect(rendered).toContain('Dependencies: Step 1');
    expect(rendered).not.toContain('task-1');
    expect(rendered).toContain('### Test Plan');
    expect(rendered).toContain('### Assumptions');
  });

  it('omits empty optional sections', () => {
    const rendered = renderPlan({ ...PLAN, tests: [], assumptions: [] });

    expect(rendered).not.toContain('### Test Plan');
    expect(rendered).not.toContain('### Assumptions');
  });

  it('renders unknown dependencies by ID', () => {
    expect(
      renderPlan({
        ...PLAN,
        tasks: [{ ...PLAN.tasks[1], dependencies: ['missing'] }],
      }),
    ).toContain('Dependencies: missing');
  });
});

it('serializes the exact proposal for execution', () => {
  expect(JSON.parse(serializePlanForExecution(PLAN))).toEqual(PLAN);
});
