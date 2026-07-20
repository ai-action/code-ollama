export type PlanKind = 'ready' | 'needs_input' | 'answer';

export interface PlanTask {
  id: string;
  description: string;
  dependencies: string[];
  verification: string;
}

export interface Plan {
  kind: PlanKind;
  title: string;
  summary: string;
  tasks: PlanTask[];
  tests: string[];
  assumptions: string[];
  questions: string[];
}
