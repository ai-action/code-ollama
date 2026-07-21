import type { Plan, PlanKind, PlanQuestion, PlanTask } from '@/types';

const IMPLEMENTATION_REQUEST_REGEX =
  /^\s*(?:please\s+)?(?:(?:(?:can|could|would|will)\s+you|i(?:'d| would)?\s+like\s+you\s+to|i\s+want\s+you\s+to)\s+)?(?:plan\s+(?:a|an|the|this|that|my|our|your|some|changes?|implementation|how|to|out)\b|implement|fix|change|update|edit|add|remove|delete|create|refactor|improve|build|modify|rename|move|make\s+(?:a|an|the)?\s*(?:change|plan)|research\s+and\s+plan)\b/i;
const OPTIONS_REQUEST_REGEX =
  /\b(?:(?:suggest|show|give|provide|offer)(?:\s+me)?(?:\s+(?:some|the|a few))?\s+(?:options|choices|alternatives)|what\s+(?:are|would be)\s+(?:my|the|some)\s+(?:options|choices|alternatives))\b/i;
const EMBEDDED_CHOICE_PATTERNS = [
  /\b(?:choose|select)\s+(?:one|an?\s+option)\b/i,
  /\b(?:e\.g\.|for example|such as)\s*,?[^)\n]+(?:,|\bor\b)[^)\n]*/i,
  /\bwhich\b[^?\n]*\bor\b[^?\n]*\?/i,
  /(?:^|\n)\s*(?:[-*]|\d+[.)])\s+.+\n\s*(?:[-*]|\d+[.)])\s+/im,
];

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value.trim();
}

function requireStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  return value.map((item, index) =>
    requireString(item, `${path}[${String(index)}]`),
  );
}

function optionalStringArray(value: unknown, path: string): string[] {
  return value === undefined ? [] : requireStringArray(value, path);
}

function parseTask(value: unknown, index: number): PlanTask {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`tasks[${String(index)}] must be an object`);
  }

  const task = value as Record<string, unknown>;
  return {
    id: requireString(task.id, `tasks[${String(index)}].id`),
    description: requireString(
      task.description,
      `tasks[${String(index)}].description`,
    ),
    dependencies: optionalStringArray(
      task.dependencies,
      `tasks[${String(index)}].dependencies`,
    ),
    verification: requireString(
      task.verification,
      `tasks[${String(index)}].verification`,
    ),
  };
}

function parseQuestion(value: unknown, index: number): PlanQuestion {
  if (typeof value === 'string') {
    const prompt = requireString(value, `questions[${String(index)}]`);
    if (EMBEDDED_CHOICE_PATTERNS.some((pattern) => pattern.test(prompt))) {
      throw new Error(
        `questions[${String(index)}].options are required when the prompt presents predefined choices`,
      );
    }
    return {
      prompt,
      options: [],
    };
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`questions[${String(index)}] must be a string or object`);
  }

  const question = value as Record<string, unknown>;
  const options = optionalStringArray(
    question.options,
    `questions[${String(index)}].options`,
  );
  if (options.length === 1 || options.length > 4) {
    throw new Error(
      `questions[${String(index)}].options must contain zero or two to four options`,
    );
  }
  if (new Set(options).size !== options.length) {
    throw new Error(`questions[${String(index)}].options must be unique`);
  }
  const prompt = requireString(
    question.prompt,
    `questions[${String(index)}].prompt`,
  );
  if (
    options.length === 0 &&
    EMBEDDED_CHOICE_PATTERNS.some((pattern) => pattern.test(prompt))
  ) {
    throw new Error(
      `questions[${String(index)}].options are required when the prompt presents predefined choices`,
    );
  }

  return {
    prompt,
    options,
  };
}

function optionalQuestions(value: unknown): PlanQuestion[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error('questions must be an array');
  }

  return value.map(parseQuestion);
}

export function parsePlan(value: unknown): Plan {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('submit_plan arguments must be an object');
  }
  const args = value as Record<string, unknown>;
  const kind = requireString(args.kind, 'kind');
  if (!['ready', 'needs_input', 'answer'].includes(kind)) {
    throw new Error('kind must be ready, needs_input, or answer');
  }
  if (args.tasks !== undefined && !Array.isArray(args.tasks)) {
    throw new Error('tasks must be an array');
  }

  const plan: Plan = {
    kind: kind as PlanKind,
    title: requireString(args.title, 'title'),
    summary: requireString(args.summary, 'summary'),
    tasks: (args.tasks ?? []).map(parseTask),
    tests: optionalStringArray(args.tests, 'tests'),
    assumptions: optionalStringArray(args.assumptions, 'assumptions'),
    questions: optionalQuestions(args.questions),
  };

  const taskIds = new Set(plan.tasks.map(({ id }) => id));
  if (taskIds.size !== plan.tasks.length) {
    throw new Error('task IDs must be unique');
  }

  const precedingTaskIds = new Set<string>();
  for (const task of plan.tasks) {
    for (const dependency of task.dependencies) {
      if (dependency === task.id) {
        throw new Error(`task ${task.id} cannot depend on itself`);
      }
      if (!taskIds.has(dependency)) {
        throw new Error(
          `task ${task.id} has unknown dependency: ${dependency}`,
        );
      }
      if (!precedingTaskIds.has(dependency)) {
        throw new Error(
          `task ${task.id} dependency must reference an earlier task: ${dependency}`,
        );
      }
    }
    precedingTaskIds.add(task.id);
  }

  if (plan.kind === 'ready' && plan.tasks.length === 0) {
    throw new Error('ready plans require at least one task');
  }
  if (plan.kind === 'needs_input' && plan.questions.length !== 1) {
    throw new Error('needs_input plans require exactly one question');
  }
  if (plan.kind === 'answer' && plan.tasks.length > 0) {
    throw new Error('answer submissions cannot contain tasks');
  }

  return plan;
}

export function validatePlanForRequest(plan: Plan, request: string): Plan {
  if (plan.kind === 'answer' && IMPLEMENTATION_REQUEST_REGEX.test(request)) {
    throw new Error(
      'answer submissions cannot satisfy an implementation request; use ready or needs_input',
    );
  }
  if (
    plan.kind === 'needs_input' &&
    OPTIONS_REQUEST_REGEX.test(request) &&
    plan.questions[0]?.options.length === 0
  ) {
    throw new Error(
      'needs_input submissions must provide options when the user requests them',
    );
  }

  return plan;
}

function renderList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function renderTasks(tasks: PlanTask[]): string {
  const stepById = new Map(
    tasks.map((task, index) => [task.id, index + 1] as const),
  );

  return tasks
    .map((task, index) => {
      const dependencies = task.dependencies.length
        ? task.dependencies
            .map((dependency) => {
              const step = stepById.get(dependency);
              return step === undefined ? dependency : `Step ${String(step)}`;
            })
            .join(', ')
        : 'None';
      return [
        `${String(index + 1)}. **${task.description}**`,
        `   - Dependencies: ${dependencies}`,
        `   - Verification: ${task.verification}`,
      ].join('\n');
    })
    .join('\n');
}

export function renderPlan(plan: Plan): string {
  if (plan.kind === 'answer') {
    return `## ${plan.title}\n\n${plan.summary}`;
  }

  const sections =
    plan.kind === 'ready'
      ? [
          '## Proposed Plan',
          `### Summary\n\n**${plan.title}**\n\n${plan.summary}`,
          `### Tasks\n\n${renderTasks(plan.tasks)}`,
          ...(plan.tests.length
            ? [`### Test Plan\n\n${renderList(plan.tests)}`]
            : []),
          ...(plan.assumptions.length
            ? [`### Assumptions\n\n${renderList(plan.assumptions)}`]
            : []),
        ]
      : [
          '## Plan Needs Input',
          `### Question\n\n${plan.questions[0].prompt}`,
          `### What I Found\n\n**${plan.title}**\n\n${plan.summary}`,
          ...(plan.tasks.length
            ? [`### Draft Tasks\n\n${renderTasks(plan.tasks)}`]
            : []),
          ...(plan.assumptions.length
            ? [`### Assumptions\n\n${renderList(plan.assumptions)}`]
            : []),
        ];

  return sections.join('\n\n');
}

export function serializePlanForExecution(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}
