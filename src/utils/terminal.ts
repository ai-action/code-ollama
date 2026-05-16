type ColorName =
  | 'blue'
  | 'cyan'
  | 'gray'
  | 'green'
  | 'magenta'
  | 'red'
  | 'yellow';

const ANSI_RESET_FOREGROUND = '\x1B[39m';

const ANSI_COLOR = {
  blue: ['\x1B[34m', ANSI_RESET_FOREGROUND],
  cyan: ['\x1B[36m', ANSI_RESET_FOREGROUND],
  gray: ['\x1B[90m', ANSI_RESET_FOREGROUND],
  green: ['\x1B[32m', ANSI_RESET_FOREGROUND],
  magenta: ['\x1B[35m', ANSI_RESET_FOREGROUND],
  red: ['\x1B[31m', ANSI_RESET_FOREGROUND],
  yellow: ['\x1B[33m', ANSI_RESET_FOREGROUND],
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
