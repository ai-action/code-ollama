import type { CommandList } from '@/types';

export const LIST: CommandList[] = [
  { name: '/clear', description: 'clear the current session' },
  { name: '/compact', description: 'summarize conversation and prune context' },
  { name: '/stats', description: 'show session usage statistics' },
  { name: '/sessions', description: 'manage sessions' },
  { name: '/models', description: 'manage Ollama models' },
  { name: '/host', description: 'configure the Ollama host' },
  { name: '/mcp', description: 'show MCP server status' },
  { name: '/memory', description: 'manage local memory' },
  { name: '/skills', description: 'show loaded skills' },
  { name: '/theme', description: 'change the theme' },
  { name: '/search', description: 'configure web search' },
  { name: '/exit', description: 'exit the application' },
] as const;
