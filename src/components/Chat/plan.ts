import type { Plan, PlanTask, PlanTaskAction } from '@/types';

import {
  isCommandBasedVerification,
  isMeaningfulVerificationCommand,
} from './verification';

const IMPLEMENTATION_REQUEST_REGEX =
  /^\s*(?:please\s+)?(?:(?:(?:can|could|would|will)\s+you|i(?:'d| would)?\s+like\s+you\s+to|i\s+want\s+you\s+to)\s+)?(?:plan\s+(?:a|an|the|this|that|my|our|your|some|changes?|implementation|how|to|out)\b|implement|fix|change|update|edit|add|remove|replace|delete|create|refactor|improve|build|modify|rename|move|make\s+(?:a|an|the)?\s*(?:change|plan)|research\s+and\s+plan)\b/i;
const INFORMATIONAL_REQUEST_REGEX =
  /^\s*(?:can|could|would)\s+you\s+(?:explain|describe|show\s+me\s+where)\b|^\s*(?:explain|describe|where|why|what|who|when|how\s+(?:does|do|is|are|did|was|were))\b/i;
const UNRESOLVED_READY_PLAN_REGEX =
  /\b(?:no specific (?:change|details?|requirements?|target|behavior|implementation)(?: (?:was|were|is|are))? (?:provided|specified|requested)|tbd\b|to be determined\b|once (?:clarified|provided)\b|needs? clarification\b|(?:details?|requirements?|change) (?:is |are )?(?:unspecified|not provided|to be provided|provided by the user)|(?:use|using|add|insert|with|or) (?:a )?placeholder\b|placeholder (?:if|until|pending)\b)/i;

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
  const action = requireString(task.action, `tasks[${String(index)}].action`);
  if (!['inspect', 'change', 'verify'].includes(action)) {
    throw new Error(
      `tasks[${String(index)}].action must be inspect, change, or verify`,
    );
  }
  return {
    action: action as PlanTaskAction,
    id: requireString(task.id, `tasks[${String(index)}].id`),
    description: requireString(
      task.description,
      `tasks[${String(index)}].description`,
    ),
    dependencies: optionalStringArray(
      task.dependencies,
      `tasks[${String(index)}].dependencies`,
    ),
    targets: optionalStringArray(
      task.targets,
      `tasks[${String(index)}].targets`,
    ),
    verification: requireString(
      task.verification,
      `tasks[${String(index)}].verification`,
    ),
  };
}

export function parsePlan(value: unknown): Plan {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('plan proposal arguments must be an object');
  }
  const args = value as Record<string, unknown>;
  if (args.tasks !== undefined && !Array.isArray(args.tasks)) {
    throw new Error('tasks must be an array');
  }

  const plan: Plan = {
    title: requireString(args.title, 'title'),
    summary: requireString(args.summary, 'summary'),
    tasks: (args.tasks ?? []).map(parseTask),
    tests: optionalStringArray(args.tests, 'tests'),
    assumptions: optionalStringArray(args.assumptions, 'assumptions'),
  };

  const taskIds = new Set(plan.tasks.map(({ id }) => id));
  if (taskIds.size !== plan.tasks.length) {
    throw new Error('task IDs must be unique');
  }

  const precedingTaskIds = new Set<string>();
  for (const task of plan.tasks) {
    if (task.action === 'change' && task.targets.length === 0) {
      throw new Error(`change task ${task.id} requires at least one target`);
    }
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

  if (plan.tasks.length === 0) {
    throw new Error('plan proposals require at least one task');
  }
  const changesProject = plan.tasks.some(({ action }) => action === 'change');
  if (changesProject && plan.tests.length === 0) {
    throw new Error(
      'plan proposals with change tasks require at least one command-based verification check',
    );
  }
  if (plan.tests.some((test) => !isCommandBasedVerification(test))) {
    throw new Error(
      'plan proposal verification checks must be exact shell commands',
    );
  }
  if (changesProject && !plan.tests.some(isMeaningfulVerificationCommand)) {
    throw new Error(
      'plan proposals with change tasks require at least one meaningful verification command',
    );
  }

  return plan;
}

export function validatePlanForRequest(plan: Plan, request: string): Plan {
  if (
    INFORMATIONAL_REQUEST_REGEX.test(request) &&
    !isImplementationRequest(request)
  ) {
    throw new Error(
      'plan proposals cannot satisfy an informational request; respond normally',
    );
  }
  if (
    UNRESOLVED_READY_PLAN_REGEX.test(
      [
        plan.title,
        plan.summary,
        ...plan.tasks.map(({ description }) => description),
        ...plan.assumptions,
      ].join('\n'),
    )
  ) {
    throw new Error(
      'plan proposals cannot contain unresolved or placeholder work; ask a clarification question normally',
    );
  }

  return plan;
}

export function isImplementationRequest(request: string): boolean {
  return IMPLEMENTATION_REQUEST_REGEX.test(request);
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
        `   - Action: ${task.action}`,
        ...(task.targets.length
          ? [`   - Targets: ${task.targets.join(', ')}`]
          : []),
        `   - Dependencies: ${dependencies}`,
        `   - Verification: ${task.verification}`,
      ].join('\n');
    })
    .join('\n');
}

export function renderPlan(plan: Plan): string {
  const sections = [
    '## Proposed Plan',
    `### Summary\n\n**${plan.title}**\n\n${plan.summary}`,
    `### Tasks\n\n${renderTasks(plan.tasks)}`,
    ...(plan.tests.length
      ? [`### Test Plan\n\n${renderList(plan.tests)}`]
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
