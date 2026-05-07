let clearHandler: (() => void) | null = null;

export function setClearHandler(handler: (() => void) | null): void {
  clearHandler = handler;
}

export function clear(): void {
  if (clearHandler) {
    clearHandler();
    return;
  }

  process.stdout.write('\x1Bc');
}
