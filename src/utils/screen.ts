// terminal control sequence (ANSI screen clear)
const CLEAR = '\x1Bc';

export function clear(): void {
  process.stdout.write(CLEAR);
}
