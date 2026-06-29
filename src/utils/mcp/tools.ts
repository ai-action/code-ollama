import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import type {
  CallToolResult,
  Resource as McpResource,
  Tool as McpTool,
} from '@modelcontextprotocol/sdk/types';
import type { Tool as OllamaTool } from 'ollama';

import { MODE, PACKAGE } from '@/constants';
import type { McpServerPermissions, Mode, ToolResult } from '@/types';

import { loadConfig } from '../config';

const MCP_TOOL_PREFIX = 'mcp__';

interface McpToolEntry {
  client: Client;
  permissions: McpToolPermissions;
  serverName: string;
  toolName: string;
}

export interface McpToolPermissions {
  allowedModes: Mode[];
  autoApprove: boolean;
  denied: boolean;
}

export interface McpResourceSummary {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

interface McpServerEntry {
  client: Client;
  publicServerName: string;
  transport: StdioClientTransport;
}

export type McpServerStatus =
  | {
      name: string;
      status: 'disabled';
      toolNames: [];
      warnings?: string[];
    }
  | {
      name: string;
      status: 'failed';
      toolNames: [];
      error: string;
      warnings?: string[];
    }
  | {
      name: string;
      status: 'loaded';
      toolNames: string[];
      resources?: McpResourceSummary[];
      warnings?: string[];
    };

const servers = new Map<string, McpServerEntry>();
const toolsByPublicName = new Map<string, McpToolEntry>();
const serverStatuses = new Map<string, McpServerStatus>();
let loadPromise: Promise<OllamaTool[]> | null = null;
let loadGeneration = 0;

const DEFAULT_ALLOWED_MODES: Mode[] = [MODE.SAFE, MODE.AUTO];
const DEFAULT_TOOL_PERMISSIONS: McpToolPermissions = {
  allowedModes: DEFAULT_ALLOWED_MODES,
  autoApprove: false,
  denied: false,
};

export function isMcpToolName(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX);
}

export function parseMcpToolName(
  name: string,
): { serverName: string; toolName: string } | null {
  if (!isMcpToolName(name)) {
    return null;
  }

  const [, serverName, toolName] = /^mcp__(.+?)__(.+)$/.exec(name) ?? [];
  if (!serverName || !toolName) {
    return null;
  }

  return { serverName, toolName };
}

export async function getMcpToolDefinitions(): Promise<OllamaTool[]> {
  loadPromise ??= loadMcpToolDefinitions(loadGeneration);
  return loadPromise;
}

export async function getMcpToolDefinitionsForMode(
  mode: Mode,
): Promise<OllamaTool[]> {
  const definitions = await getMcpToolDefinitions();
  return definitions.filter((tool) => {
    const name = tool.function.name;
    return (
      typeof name === 'string' &&
      isMcpToolName(name) &&
      isMcpToolAllowedInMode(name, mode)
    );
  });
}

export function getMcpServerStatuses(): McpServerStatus[] {
  return Array.from(serverStatuses.values());
}

export function getMcpToolPermissions(publicName: string): McpToolPermissions {
  return (
    toolsByPublicName.get(publicName)?.permissions ?? DEFAULT_TOOL_PERMISSIONS
  );
}

export function isMcpToolAllowedInMode(
  publicName: string,
  mode: Mode,
): boolean {
  const permissions = getMcpToolPermissions(publicName);
  return !permissions.denied && permissions.allowedModes.includes(mode);
}

export function requiresMcpToolApproval(publicName: string): boolean {
  const permissions = getMcpToolPermissions(publicName);
  return !permissions.autoApprove;
}

export async function getMcpToolExecutionError(
  publicName: string,
  mode?: Mode,
): Promise<string | undefined> {
  await getMcpToolDefinitions();

  const entry = toolsByPublicName.get(publicName);
  if (!entry) {
    return undefined;
  }

  if (entry.permissions.denied) {
    return `Tool not allowed: ${publicName}`;
  }

  if (mode && !entry.permissions.allowedModes.includes(mode)) {
    return `Tool not allowed in ${mode} mode: ${publicName}`;
  }
}

export async function reloadMcpToolDefinitions(): Promise<OllamaTool[]> {
  await closeMcpClients();
  loadPromise = loadMcpToolDefinitions(loadGeneration);
  return loadPromise;
}

export async function closeMcpClients(): Promise<void> {
  loadGeneration += 1;

  const serverEntries = Array.from(servers.values());
  servers.clear();
  toolsByPublicName.clear();
  serverStatuses.clear();
  loadPromise = null;

  await Promise.allSettled(
    serverEntries.map(async ({ client, transport }) => {
      try {
        await client.close();
      } catch {
        try {
          await transport.close();
        } catch {
          // Ignore MCP cleanup failures. Exit and reload must stay best-effort.
        }
      }
    }),
  );
}

export async function callMcpTool(
  publicName: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  await getMcpToolDefinitions();

  const entry = toolsByPublicName.get(publicName);
  if (!entry) {
    const parsed = parseMcpToolName(publicName);
    const label = parsed
      ? `${parsed.serverName}/${parsed.toolName}`
      : publicName;
    return { content: '', error: `Unknown MCP tool: ${label}` };
  }

  try {
    const result = await entry.client.callTool({
      name: entry.toolName,
      arguments: args,
    });
    return formatMcpResult(result as CallToolResult);
  } catch (error) {
    return {
      content: '',
      error: error instanceof Error ? error.message : String(error),
      ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
    };
  }
}

async function loadMcpToolDefinitions(
  generation: number,
): Promise<OllamaTool[]> {
  const config = loadConfig();
  const configuredServers = config.mcpServers ?? {};
  const definitions: OllamaTool[] = [];
  const usedPublicToolNames = new Set<string>();

  for (const [serverName, serverConfig] of Object.entries(configuredServers)) {
    if (serverConfig.disabled) {
      setServerStatus(generation, serverName, {
        name: serverName,
        status: 'disabled',
        toolNames: [],
      });
      continue;
    }

    try {
      const publicServerName = uniqueName(
        sanitizeToolNamePart(serverName),
        new Set([...servers.keys()]),
      );
      const client = new Client({
        name: PACKAGE.NAME,
        version: PACKAGE.VERSION,
      });
      const transport = new StdioClientTransport({
        command: serverConfig.command,
        args: serverConfig.args,
        env: serverConfig.env
          ? buildServerEnvironment(serverConfig.env)
          : undefined,
        stderr: 'pipe',
      });

      await client.connect(transport);
      setServer(generation, publicServerName, {
        client,
        publicServerName,
        transport,
      });

      const { tools } = await client.listTools();
      const toolNames: string[] = [];
      const nativeToolNames = tools.map((tool) => tool.name);
      for (const tool of tools) {
        const publicName = uniqueName(
          `${MCP_TOOL_PREFIX}${publicServerName}__${sanitizeToolNamePart(tool.name)}`,
          usedPublicToolNames,
        );
        usedPublicToolNames.add(publicName);
        setTool(generation, publicName, {
          client,
          permissions: getToolPermissions(serverConfig.permissions, tool.name),
          serverName,
          toolName: tool.name,
        });
        definitions.push(toOllamaTool(publicName, serverName, tool));
        toolNames.push(publicName);
      }
      const warnings = getPermissionWarnings(
        serverConfig.permissions,
        nativeToolNames,
      );
      const resourceResult = await listMcpResourceSummaries(client);
      warnings.push(...resourceResult.warnings);

      setServerStatus(generation, serverName, {
        name: serverName,
        status: 'loaded',
        toolNames,
        ...(resourceResult.resources.length
          ? { resources: resourceResult.resources }
          : {}),
        ...(warnings.length ? { warnings } : {}),
      });
    } catch (error) {
      setServerStatus(generation, serverName, {
        name: serverName,
        status: 'failed',
        toolNames: [],
        // v8 ignore next
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return definitions;
}

async function listMcpResourceSummaries(
  client: Client,
): Promise<{ resources: McpResourceSummary[]; warnings: string[] }> {
  const resources: McpResourceSummary[] = [];
  let cursor: string | undefined;

  try {
    do {
      const result = await client.listResources(
        cursor ? { cursor } : undefined,
      );
      resources.push(...result.resources.map(toResourceSummary));
      cursor = result.nextCursor;
    } while (cursor);

    return { resources, warnings: [] };
  } catch (error) {
    if (isUnsupportedResourcesError(error)) {
      return { resources, warnings: [] };
    }

    return {
      resources,
      warnings: [
        `Failed to list resources: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    };
  }
}

function isUnsupportedResourcesError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (code === -32601) {
      return true;
    }
  }

  const message = error instanceof Error ? error.message : String(error);
  return message.includes('-32601') || message.includes('Method not found');
}

function toResourceSummary(resource: McpResource): McpResourceSummary {
  return {
    uri: resource.uri,
    name: resource.name,
    ...(resource.title ? { title: resource.title } : {}),
    ...(resource.description ? { description: resource.description } : {}),
    ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
    ...(resource.size === undefined ? {} : { size: resource.size }),
  };
}

function getPermissionWarnings(
  permissions: McpServerPermissions | undefined,
  nativeToolNames: string[],
): string[] {
  if (!permissions) {
    return [];
  }

  const warnings: string[] = [];
  const nativeToolNameSet = new Set(nativeToolNames);
  // v8 ignore next
  const availableToolNames = nativeToolNames.join(', ') || 'none';

  // v8 ignore next
  for (const mode of permissions.allowedModes ?? []) {
    if (!isValidMode(mode)) {
      warnings.push(
        `permissions.allowedModes contains unknown mode "${mode}". Valid modes: plan, safe, auto`,
      );
    }
  }

  for (const toolName of permissions.autoApprove ?? []) {
    if (!nativeToolNameSet.has(toolName)) {
      warnings.push(
        `permissions.autoApprove references unknown tool "${toolName}". Available native tool names: ${availableToolNames}`,
      );
    }
  }

  for (const toolName of permissions.deny ?? []) {
    if (!nativeToolNameSet.has(toolName)) {
      warnings.push(
        `permissions.deny references unknown tool "${toolName}". Available native tool names: ${availableToolNames}`,
      );
    }
  }

  return warnings;
}

function isValidMode(value: string): value is Mode {
  return value === MODE.PLAN || value === MODE.SAFE || value === MODE.AUTO;
}

function getToolPermissions(
  permissions: McpServerPermissions | undefined,
  toolName: string,
): McpToolPermissions {
  return {
    allowedModes: permissions?.allowedModes?.filter(isValidMode) ?? [
      ...DEFAULT_ALLOWED_MODES,
    ],
    autoApprove: permissions?.autoApprove?.includes(toolName) ?? false,
    denied: permissions?.deny?.includes(toolName) ?? false,
  };
}

function setServer(
  generation: number,
  publicServerName: string,
  entry: McpServerEntry,
) {
  if (generation === loadGeneration) {
    servers.set(publicServerName, entry);
  }
}

function setTool(generation: number, publicName: string, entry: McpToolEntry) {
  if (generation === loadGeneration) {
    toolsByPublicName.set(publicName, entry);
  }
}

function setServerStatus(
  generation: number,
  serverName: string,
  status: McpServerStatus,
) {
  if (generation === loadGeneration) {
    serverStatuses.set(serverName, status);
  }
}

function toOllamaTool(
  publicName: string,
  serverName: string,
  tool: McpTool,
): OllamaTool {
  return {
    type: 'function',
    function: {
      name: publicName,
      description: [
        tool.description ?? `MCP tool ${tool.name}`,
        `Provided by MCP server ${serverName}.`,
      ].join('\n'),
      parameters: tool.inputSchema,
    },
  };
}

function formatMcpResult(result: CallToolResult): ToolResult {
  const parts = result.content.map((content) => {
    switch (content.type) {
      case 'text':
        return content.text;
      case 'image':
        return `[image: ${content.mimeType}, ${String(content.data.length)} base64 chars]`;
      case 'audio':
        return `[audio: ${content.mimeType}, ${String(content.data.length)} base64 chars]`;
      case 'resource':
        if ('text' in content.resource) {
          return [
            `[resource: ${content.resource.uri}]`,
            content.resource.text,
          ].join('\n');
        }
        return `[resource: ${content.resource.uri}, ${String(content.resource.blob.length)} base64 chars]`;
      case 'resource_link':
        return `[resource link: ${content.name} ${content.uri}]`;
    }
  });

  if (result.structuredContent) {
    parts.push(
      `Structured content:\n${JSON.stringify(result.structuredContent, null, 2)}`,
    );
  }

  return {
    content: parts.filter(Boolean).join('\n\n'),
    ...(result.isError ? { error: 'MCP tool returned an error' } : {}),
  };
}

function sanitizeToolNamePart(value: string): string {
  const sanitized = value.replace(/\W/g, '_').replace(/_+/g, '_');
  return sanitized.replace(/^_+|_+$/g, '') || 'unnamed';
}

function buildServerEnvironment(
  serverEnv: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    // v8 ignore next -- process.env entries are strings at runtime.
    if (value !== undefined) {
      env[key] = value;
    }
  }

  return { ...env, ...serverEnv };
}

function uniqueName(baseName: string, usedNames: ReadonlySet<string>): string {
  if (!usedNames.has(baseName)) {
    return baseName;
  }

  let index = 2;
  let candidate = `${baseName}_${String(index)}`;
  while (usedNames.has(candidate)) {
    index += 1;
    candidate = `${baseName}_${String(index)}`;
  }

  return candidate;
}
