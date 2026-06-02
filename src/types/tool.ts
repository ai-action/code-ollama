import { TOOL } from '@/constants';

export type ToolName = Extract<(typeof TOOL)[keyof typeof TOOL], string>;

export interface ToolResult {
  content: string;
  error?: string;
  diff?: ToolDiff;
}

export interface ToolDiff {
  path: string;
  visible: string;
  truncated: boolean;
  totalLines: number;
  visibleLines: number;
}
