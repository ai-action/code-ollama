export const NAME = {
  SAFE: 'safe',
  AUTO: 'auto',
  PLAN: 'plan',
} as const;

export type Name = (typeof NAME)[keyof typeof NAME];

export const LABEL: Record<Name, string> = {
  safe: 'Safe',
  auto: 'Auto',
  plan: 'Plan',
};
