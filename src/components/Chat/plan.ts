import type { Plan, PlanKind, PlanTask } from '@/types';

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
    questions: optionalStringArray(args.questions, 'questions'),
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
  if (plan.kind === 'needs_input' && plan.questions.length === 0) {
    throw new Error('needs_input plans require at least one question');
  }
  if (plan.kind === 'answer' && plan.tasks.length > 0) {
    throw new Error('answer submissions cannot contain tasks');
  }

  return plan;
}

function renderList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

function renderTasks(tasks: PlanTask[]): string {
  return tasks
    .map((task, index) => {
      const dependencies = task.dependencies.length
        ? task.dependencies.join(', ')
        : 'None';
      return [
        `${String(index + 1)}. **${task.id}: ${task.description}**`,
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
          `### Questions\n\n${renderList(plan.questions)}`,
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
