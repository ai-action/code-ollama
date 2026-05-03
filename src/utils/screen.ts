export function clear(): void {
  process.stdout.write('\x1Bc');
}
