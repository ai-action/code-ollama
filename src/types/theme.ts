import type { TerminalRendererOptions } from 'marked-terminal';

export type ThemeId =
  | 'github-light'
  | 'github-dark'
  | 'nord'
  | 'dracula'
  | 'solarized-light'
  | 'solarized-dark';

export type ThemeColorName =
  | 'blue'
  | 'cyan'
  | 'gray'
  | 'green'
  | 'magenta'
  | 'red'
  | 'yellow';

export interface ThemeColors {
  accent: ThemeColorName;
  border: ThemeColorName;
  codeBorder: ThemeColorName;
  command: ThemeColorName;
  error: ThemeColorName;
  messageSystem: ThemeColorName;
  modeAuto: ThemeColorName;
  modePlan: ThemeColorName;
  modeSafe: ThemeColorName;
  model: ThemeColorName;
  secondary: ThemeColorName;
  status: ThemeColorName;
  warning: ThemeColorName;
}

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  description: string;
  markdownTheme: TerminalRendererOptions['theme'];
  codeTheme: string;
  colors: ThemeColors;
}
