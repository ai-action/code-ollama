export const tick = (ms = 0) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
