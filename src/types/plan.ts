export type PlanOutcome = 'ready' | 'needs_input' | 'answer';

export interface PlanTask {
  id: string;
  description: string;
  dependencies: string[];
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
