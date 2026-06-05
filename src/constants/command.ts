import type { CommandList } from '@/types';

export const LIST: CommandList[] = [
  { name: '/clear', description: 'clear the current session' },
  { name: '/compact', description: 'summarize conversation and prune context' },
  { name: '/session', description: 'manage sessions' },
  { name: '/model', description: 'manage Ollama models' },
  { name: '/theme', description: 'change the theme' },
  { name: '/search', description: 'configure web search' },
  { name: '/exit', description: 'exit the application' },
] as const;
