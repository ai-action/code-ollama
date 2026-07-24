export type PlanTaskAction = 'inspect' | 'change' | 'verify';

export interface PlanTask {
  action: PlanTaskAction;
  id: string;
  description: string;
  dependencies: string[];
  targets: string[];
  verification: string;
}

export interface Plan {
  title: string;
  summary: string;
  tasks: PlanTask[];
  tests: string[];
  assumptions: string[];
}
