import { TOOL } from '../constants';

export type Tool = (typeof TOOL)[keyof typeof TOOL];

export interface ToolResult {
  content: string;
  error?: string;
}
