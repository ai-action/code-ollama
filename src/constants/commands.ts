export interface Command {
  name: string;
  description: string;
}

export const COMMANDS: Command[] = [
  { name: '/model', description: 'Switch the active model' },
] as const;
