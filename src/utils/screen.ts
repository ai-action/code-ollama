type ClearHandler = ((sessionId?: string) => void) | null;
type ColorName = 'cyan';

const ANSI_COLOR = {
  cyan: ['\x1B[36m', '\x1B[39m'],
} satisfies Record<ColorName, [open: string, close: string]>;

let clearHandler: ClearHandler = null;

export function setClearHandler(handler: ClearHandler): void {
  clearHandler = handler;
}

/**
 * Clear the screen with Ink.
 */
export function clear(sessionId?: string): void {
  clearHandler?.(sessionId);
}

/**
 * Reset the screen with ANSI escape sequence.
 */
export function reset(): void {
  write('\x1Bc\x1B[?25l');
}

export function color(text: string, name: ColorName): string {
  const [open, close] = ANSI_COLOR[name];
  return `${open}${text}${close}`;
}

export function write(text: string): void {
  process.stdout.write(text);
}
