import type { RenderOptions } from 'ink';

export const RENDER_OPTIONS = {
  exitOnCtrlC: false,
  maxFps: 60,
} as const satisfies RenderOptions;
