type ClearHandler = (() => void) | null;

let clearHandler: ClearHandler = null;

export function setClearHandler(handler: ClearHandler): void {
  clearHandler = handler;
}

/**
 * Clear the screen with Ink.
 */
export function clear(): void {
  clearHandler?.();
}

/**
 * Reset the screen with ANSI escape sequence.
 */
export function reset(): void {
  process.stdout.write('\x1Bc\x1B[?25l');
}
