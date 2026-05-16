import type { CommandList } from '@/types';

export const LIST: CommandList[] = [
  { name: '/clear', description: 'clear the current session' },
  { name: '/session', description: 'manage sessions' },
  { name: '/model', description: 'switch the model' },
  { name: '/theme', description: 'change the theme' },
  { name: '/search', description: 'configure web search' },
  { name: '/exit', description: 'exit the application' },
] as const;
