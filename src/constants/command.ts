export interface CommandList {
  name: string;
  description: string;
}

export const LIST: CommandList[] = [
  { name: '/model', description: 'switch the model' },
] as const;

export const NAMES = LIST.map(({ name }) => name);
