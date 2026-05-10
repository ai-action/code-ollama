import type { CommandList } from '../types';

export const LIST: CommandList[] = [
  { name: '/clear', description: 'clear the current session' },
  { name: '/model', description: 'switch the model' },
  { name: '/search', description: 'configure web search' },
  { name: '/exit', description: 'exit the application' },
] as const;
