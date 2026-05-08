export interface CommandList {
  name: string;
  description: string;
}

export const LIST: CommandList[] = [
  { name: '/clear', description: 'clear the current session' },
  { name: '/model', description: 'switch the model' },
  { name: '/exit', description: 'exit the application' },
] as const;
