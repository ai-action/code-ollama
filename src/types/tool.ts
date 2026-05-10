import { TOOL } from '../constants';

export type ToolName = (typeof TOOL)[keyof typeof TOOL];
