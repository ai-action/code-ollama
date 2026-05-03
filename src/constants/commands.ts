export interface Command {
  name: string;
  description: string;
}

export const COMMANDS: Command[] = [
  { name: '/model', description: 'switch the model' },
] as const;
