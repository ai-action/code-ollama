import { Client } from '@modelcontextprotocol/sdk/client';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio';
import type {
  CallToolResult,
  Tool as McpTool,
} from '@modelcontextprotocol/sdk/types';
import type { Tool as OllamaTool } from 'ollama';

import { PACKAGE } from '@/constants';
import type { ToolResult } from '@/types';

import { loadConfig } from '../config';

const MCP_TOOL_PREFIX = 'mcp__';

interface McpToolEntry {
  client: Client;
  serverName: string;
  toolName: string;
}

interface McpServerEntry {
  client: Client;
  publicServerName: string;
  transport: StdioClientTransport;
}

const servers = new Map<string, McpServerEntry>();
const toolsByPublicName = new Map<string, McpToolEntry>();
let loadPromise: Promise<OllamaTool[]> | null = null;

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
  loadPromise ??= loadMcpToolDefinitions();
  return loadPromise;
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

async function loadMcpToolDefinitions(): Promise<OllamaTool[]> {
  const config = loadConfig();
  const configuredServers = config.mcpServers ?? {};
  const definitions: OllamaTool[] = [];
  const usedPublicToolNames = new Set<string>();

  for (const [serverName, serverConfig] of Object.entries(configuredServers)) {
    if (serverConfig.disabled) {
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
      servers.set(publicServerName, {
        client,
        publicServerName,
        transport,
      });

      const { tools } = await client.listTools();
      for (const tool of tools) {
        const publicName = uniqueName(
          `${MCP_TOOL_PREFIX}${publicServerName}__${sanitizeToolNamePart(tool.name)}`,
          usedPublicToolNames,
        );
        usedPublicToolNames.add(publicName);
        toolsByPublicName.set(publicName, {
          client,
          serverName,
          toolName: tool.name,
        });
        definitions.push(toOllamaTool(publicName, serverName, tool));
      }
    } catch {
      // Ignore unavailable MCP servers so local tools keep working.
    }
  }

  return definitions;
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
