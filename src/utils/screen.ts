type ClearHandler = (() => void) | null;

let clearHandler: ClearHandler = null;

export function setClearHandler(handler: ClearHandler): void {
  clearHandler = handler;
}

export function clear(): void {
  clearHandler?.();
}
