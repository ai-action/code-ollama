export const ROLE = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

export type Role = (typeof ROLE)[keyof typeof ROLE];
