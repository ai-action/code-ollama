import type { Plan } from '@/types';

import {
  parsePlan,
  renderPlan,
  serializePlanForExecution,
  validatePlanForRequest,
} from './plan';

const READY_PLAN: Plan = {
  outcome: 'ready',
  title: 'Add structured plans',
  summary: 'Use a control tool for Plan-mode completion.',
  tasks: [
    {
      action: 'change',
      id: 'task-1',
      description: 'Add the plan contract',
      dependencies: [],
      targets: ['src/components/Chat/plan.ts'],
      verification: 'The validator tests pass',
    },
    {
      action: 'change',
      id: 'task-2',
      description: 'Integrate plan submission',
      dependencies: ['task-1'],
      targets: ['src/components/Chat/Chat.tsx'],
      verification: 'The Chat tests pass',
    },
  ],
  tests: ['npm test -- run src/components/Chat/plan.test.ts'],
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

  it('requires command-based verification for a ready plan', () => {
    expect(() => parsePlan({ ...READY_PLAN, tests: [] })).toThrow(
      'ready plans with change tasks require at least one command-based verification check',
    );
    expect(() =>
      parsePlan({ ...READY_PLAN, tests: ['Run the tests'] }),
    ).toThrow('ready plan verification checks must be exact shell commands');
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tests: ['grep -q finish_plan_mode src/components/Chat/plan.ts'],
      }),
    ).not.toThrow();
    expect(() => parsePlan({ ...READY_PLAN, tests: ['echo done'] })).toThrow(
      'at least one meaningful verification command',
    );
  });

  it('allows read-only ready plans without command verification', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tasks: [
          {
            ...READY_PLAN.tasks[0],
            action: 'inspect',
            targets: [],
          },
        ],
        tests: [],
      }),
    ).not.toThrow();
  });

  it('requires concrete targets for change tasks', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tasks: [{ ...READY_PLAN.tasks[0], targets: [] }],
      }),
    ).toThrow('change task task-1 requires at least one target');
  });

  it('rejects questions for a ready plan', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        questions: ['Which behavior should be used?'],
      }),
    ).toThrow('ready plans cannot contain questions');
  });

  it('requires exactly one question when input is needed', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: [],
      }),
    ).toThrow('needs_input plans require exactly one question');

    expect(() =>
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: ['First?', 'Second?'],
      }),
    ).toThrow('needs_input plans require exactly one question');
  });

  it('normalizes legacy and structured questions', () => {
    expect(
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: ['Which behavior should be used?'],
      }).questions,
    ).toEqual([{ prompt: 'Which behavior should be used?', options: [] }]);

    expect(
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: [
          {
            prompt: 'Which behavior should be used?',
            options: ['Safe', 'Fast'],
          },
        ],
      }).questions,
    ).toEqual([
      {
        prompt: 'Which behavior should be used?',
        options: ['Safe', 'Fast'],
      },
    ]);
  });

  it('validates selectable question options', () => {
    const parseOptions = (options: unknown) =>
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: [{ prompt: 'Choose one', options }],
      });

    expect(() => parseOptions(['Only choice'])).toThrow(
      'options must contain zero or two to four options',
    );
    expect(() => parseOptions(['A', 'B', 'C', 'D', 'E'])).toThrow(
      'options must contain zero or two to four options',
    );
    expect(() => parseOptions(['Same', 'Same'])).toThrow(
      'options must be unique',
    );
    expect(() => parseOptions('A')).toThrow('options must be an array');
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: [42],
      }),
    ).toThrow('questions[0] must be a string or object');
  });

  it('requires structured options for embedded choices', () => {
    const parsePrompt = (prompt: string) =>
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: [{ prompt }],
      });

    for (const prompt of [
      'What should the timeout be? Select one or provide another value.',
      'Which timeout? (e.g., Ollama client timeout, fetch timeout)',
      'Which function should change: streamChat or generateStructuredChat?',
      'Which option?\n- Safe\n- Fast',
    ]) {
      expect(() => parsePrompt(prompt)).toThrow(
        'options are required when the prompt presents predefined choices',
      );
    }

    expect(() =>
      parsePlan({
        ...READY_PLAN,
        outcome: 'needs_input',
        tasks: [],
        questions: ['What should the timeout value be?'],
      }),
    ).not.toThrow();
  });

  it('rejects tasks in an informational answer', () => {
    expect(() => parsePlan({ ...READY_PLAN, outcome: 'answer' })).toThrow(
      'answer submissions cannot contain tasks',
    );
  });

  it('rejects questions in an informational answer', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        outcome: 'answer',
        tasks: [],
        questions: ['Which behavior should be used?'],
      }),
    ).toThrow('answer submissions cannot contain questions');
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
    expect(() => parsePlan({ ...READY_PLAN, outcome: 'draft' })).toThrow(
      'outcome must be ready, needs_input, or answer',
    );
  });

  it('defaults omitted optional arrays and task dependencies', () => {
    expect(
      parsePlan({
        outcome: 'answer',
        title: 'Plan mode location',
        summary: 'Plan mode is implemented in the Chat flow.',
      }),
    ).toEqual({
      outcome: 'answer',
      title: 'Plan mode location',
      summary: 'Plan mode is implemented in the Chat flow.',
      tasks: [],
      tests: [],
      assumptions: [],
      questions: [],
    });

    expect(
      parsePlan({
        ...READY_PLAN,
        tasks: [
          {
            action: 'inspect',
            id: 'task-1',
            description: 'Add the plan contract',
            verification: 'The validator tests pass',
          },
        ],
      }).tasks[0],
    ).toMatchObject({ dependencies: [], targets: [] });
  });

  it('rejects non-object arguments', () => {
    expect(() => parsePlan(null)).toThrow(
      'finish_plan_mode arguments must be an object',
    );
    expect(() => parsePlan('plan')).toThrow(
      'finish_plan_mode arguments must be an object',
    );
    expect(() => parsePlan([])).toThrow(
      'finish_plan_mode arguments must be an object',
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

  it('rejects a task with an invalid action', () => {
    expect(() =>
      parsePlan({
        ...READY_PLAN,
        tasks: [
          {
            ...READY_PLAN.tasks[0],
            action: 'invalid' as unknown as 'change',
          },
        ],
      }),
    ).toThrow('tasks[0].action must be inspect, change, or verify');
  });

  it('rejects non-array questions', () => {
    expect(() => parsePlan({ ...READY_PLAN, questions: 'question' })).toThrow(
      'questions must be an array',
    );
  });
});

describe('validatePlanForRequest', () => {
  const answerPlan: Plan = {
    outcome: 'answer',
    title: 'Clarification needed',
    summary: 'More context is required.',
    tasks: [],
    tests: [],
    assumptions: [],
    questions: [],
  };

  it('rejects answers for explicit implementation requests', () => {
    expect(() =>
      validatePlanForRequest(
        answerPlan,
        'Plan a small change to the Plan mode documentation',
      ),
    ).toThrow(
      'answer submissions cannot satisfy an implementation request; use ready or needs_input',
    );
    expect(() =>
      validatePlanForRequest(answerPlan, 'Could you fix Plan mode?'),
    ).toThrow('answer submissions cannot satisfy an implementation request');
  });

  it('allows answers for informational requests', () => {
    expect(
      validatePlanForRequest(answerPlan, 'Explain where Plan mode is defined'),
    ).toBe(answerPlan);
    expect(
      validatePlanForRequest(answerPlan, 'Plan mode documentation location?'),
    ).toBe(answerPlan);
  });

  it('rejects ready plans for informational requests', () => {
    expect(() =>
      validatePlanForRequest(
        READY_PLAN,
        'Explain where Plan mode is implemented',
      ),
    ).toThrow(
      'ready plans cannot satisfy an informational request; use answer',
    );
  });

  it('rejects unresolved ready plans', () => {
    expect(() =>
      validatePlanForRequest(
        {
          ...READY_PLAN,
          summary: 'No specific change was provided.',
          tasks: [
            {
              ...READY_PLAN.tasks[0],
              description:
                'Update Plan mode with details provided by the user or a placeholder.',
            },
          ],
        },
        'Plan a small change to Plan mode',
      ),
    ).toThrow(
      'ready plans cannot contain unresolved or placeholder work; use needs_input',
    );

    expect(
      validatePlanForRequest(
        {
          ...READY_PLAN,
          summary: 'Replace placeholder text with a concrete empty state.',
        },
        'Replace the placeholder text',
      ),
    ).toBeDefined();
  });

  it('requires choices when the user asks for suggested options', () => {
    const needsInputPlan: Plan = {
      outcome: 'needs_input',
      title: 'Choose a timeout',
      summary: 'The timeout target needs clarification.',
      tasks: [],
      tests: [],
      assumptions: [],
      questions: [
        {
          prompt: 'Which timeout should change?',
          options: [],
        },
      ],
    };

    expect(() =>
      validatePlanForRequest(needsInputPlan, 'Can you suggest options?'),
    ).toThrow(
      'needs_input submissions must provide options when the user requests them',
    );
    expect(() =>
      validatePlanForRequest(needsInputPlan, 'What are my choices?'),
    ).toThrow('must provide options when the user requests them');
    expect(
      validatePlanForRequest(needsInputPlan, 'I need to describe the target'),
    ).toBe(needsInputPlan);
    expect(
      validatePlanForRequest(
        {
          ...needsInputPlan,
          questions: [
            {
              prompt: 'Which timeout should change?',
              options: ['Streaming timeout', 'Tool timeout'],
            },
          ],
        },
        'Please provide some alternatives',
      ),
    ).toMatchObject({ outcome: 'needs_input' });
  });
});

describe('renderPlan', () => {
  it('renders a ready plan with application-owned headings', () => {
    const rendered = renderPlan(READY_PLAN);

    expect(rendered).toContain('## Proposed Plan');
    expect(rendered).toContain('### Tasks');
    expect(rendered).toContain('2. **Integrate plan submission**');
    expect(rendered).toContain('Dependencies: Step 1');
    expect(rendered).not.toContain('task-1');
    expect(rendered).not.toContain('task-2');
    expect(rendered).toContain('### Test Plan');
    expect(rendered).toContain('### Assumptions');
  });

  it('renders a ready plan without optional sections when empty', () => {
    const rendered = renderPlan({ ...READY_PLAN, tests: [], assumptions: [] });

    expect(rendered).toContain('## Proposed Plan');
    expect(rendered).not.toContain('### Test Plan');
    expect(rendered).not.toContain('### Assumptions');
  });

  it('renders unknown task dependencies by ID', () => {
    const rendered = renderPlan({
      ...READY_PLAN,
      tasks: [
        {
          ...READY_PLAN.tasks[0],
          dependencies: ['missing-task'],
        },
      ],
    });

    expect(rendered).toContain('Dependencies: missing-task');
  });

  it('renders questions without a reviewable plan', () => {
    const rendered = renderPlan({
      ...READY_PLAN,
      outcome: 'needs_input',
      tasks: [],
      questions: [
        { prompt: 'Which behavior should be used?', options: ['A', 'B'] },
      ],
    });

    expect(rendered).toContain('## Plan Needs Input');
    expect(rendered).toContain('### Question');
    expect(rendered).toContain('Which behavior should be used?');
    expect(rendered).not.toContain('- A');
    expect(rendered).not.toContain('### Draft Tasks');
  });

  it('renders informational answers as ordinary Markdown', () => {
    expect(
      renderPlan({
        ...READY_PLAN,
        outcome: 'answer',
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
