import type { ThemeId } from './theme';

export interface Config {
  host: string;
  model?: string;
  mcpServers?: Record<string, McpServerConfig>;
  searxngBaseUrl?: string;
  theme: ThemeId;
  trustedDirectories?: string[];
  disabledSkills?: string[];
}

export interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  disabled?: boolean;
  permissions?: McpServerPermissions;
}

export interface McpServerPermissions {
  allowedModes?: string[];
  autoApprove?: string[];
  deny?: string[];
}
