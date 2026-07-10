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

interface BaseMcpServerConfig {
  disabled?: boolean;
  permissions?: McpServerPermissions;
}

export type McpServerConfig = StdioMcpServerConfig | HttpMcpServerConfig;

export interface StdioMcpServerConfig extends BaseMcpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface HttpMcpServerConfig extends BaseMcpServerConfig {
  url: string;
  headers?: Record<string, string>;
  oauth?: McpServerOAuthConfig;
}

export interface McpServerOAuthConfig {
  callbackPort?: number;
  clientId?: string;
  scopes?: string;
}

export interface McpServerPermissions {
  allowedModes?: string[];
  autoApprove?: string[];
  deny?: string[];
}
