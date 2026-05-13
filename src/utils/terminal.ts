type ColorName = 'cyan';

const ANSI_COLOR = {
  cyan: ['\x1B[36m', '\x1B[39m'],
} satisfies Record<ColorName, [open: string, close: string]>;

export function color(text: string, name: ColorName): string {
  const [open, close] = ANSI_COLOR[name];
  return `${open}${text}${close}`;
}

export function write(text: string): void {
  process.stdout.write(text);
}

export function writeError(text: string): void {
  process.stderr.write(text);
}
