export type PlanOutcome = 'ready' | 'needs_input' | 'answer';
export type PlanTaskAction = 'inspect' | 'change' | 'verify';

export interface PlanTask {
  action: PlanTaskAction;
  id: string;
  description: string;
  dependencies: string[];
  targets: string[];
  verification: string;
}

export interface PlanQuestion {
  prompt: string;
  options: string[];
}

export interface Plan {
  outcome: PlanOutcome;
  title: string;
  summary: string;
  tasks: PlanTask[];
  tests: string[];
  assumptions: string[];
  questions: PlanQuestion[];
}
