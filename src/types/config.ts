import type { ThemeId } from './theme';

export interface Config {
  host: string;
  model?: string;
  searxngBaseUrl?: string;
  theme: ThemeId;
  trustedDirectories?: string[];
  disabledSkills?: string[];
}
