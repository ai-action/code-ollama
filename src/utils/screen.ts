type ClearHandler = ((sessionId?: string) => void) | null;

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
  process.stdout.write('\x1Bc\x1B[?25l');
}
