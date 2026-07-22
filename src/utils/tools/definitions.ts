import type { Tool as OllamaTool } from 'ollama';

import { MODE, TOOL } from '@/constants';
import type { Mode, PlanOutcome, ToolName } from '@/types';

import { getMcpToolDefinitions, getMcpToolDefinitionsForMode } from '../mcp';

interface ToolDefinitionOptions {
  mode?: Mode;
  allowPlanAnswer?: boolean;
}

function nonEmptyString(description: string) {
  return { type: 'string', minLength: 1, description };
}

/**
 * Helper to define tool parameters
 */
function defineTool(
  name: ToolName,
  description: string,
  params: Record<
    string,
    {
      type: string;
      description: string;
      items?: { type: string; description: string };
    }
  >,
  required: string[],
) {
  return {
    type: 'function' as const,
    function: {
      name,
      description,
      parameters: {
        type: 'object',
        properties: params,
        required,
      },
    },
  };
}

export const FINISH_PLAN_MODE_TOOL: OllamaTool = {
  type: 'function',
  function: {
    name: TOOL.FINISH_PLAN_MODE,
    description:
      'Finish the current Plan-mode turn with a structured plan, a request for user input, or an informational answer',
    parameters: {
      type: 'object',
      properties: {
        outcome: {
          type: 'string',
          enum: ['ready', 'needs_input', 'answer'],
          description:
            'The outcome: ready for an actionable plan, needs_input for an unresolved decision, or answer only for an informational request',
        },
        title: nonEmptyString('A concise title for the plan or answer'),
        summary: nonEmptyString('The outcome, findings, or proposed change'),
        tasks: {
          type: 'array',
          description: 'Ordered implementation tasks; empty unless applicable',
          items: {
            type: 'object',
            properties: {
              action: {
                type: 'string',
                enum: ['inspect', 'change', 'verify'],
                description:
                  'Whether the task only inspects state, changes project state, or verifies completed work',
              },
              id: {
                type: 'string',
                minLength: 1,
                description: 'A short stable identifier such as task-1',
              },
              description: {
                type: 'string',
                minLength: 1,
                description: 'The implementation outcome for this task',
              },
              dependencies: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                description: 'IDs of tasks that must be completed first',
              },
              targets: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                description:
                  'Concrete files, directories, or resources changed by a change task; required for change tasks',
              },
              verification: {
                type: 'string',
                minLength: 1,
                description: 'How completion of this task will be verified',
              },
            },
            required: [
              'action',
              'id',
              'description',
              'targets',
              'verification',
            ],
          },
        },
        tests: {
          type: 'array',
          description:
            'Exact command-based verification checks selected from AGENTS.md or project configuration; ready plans require at least one',
          items: { type: 'string', minLength: 1 },
        },
        assumptions: {
          type: 'array',
          description: 'Defaults or constraints assumed by the plan',
          items: { type: 'string', minLength: 1 },
        },
        questions: {
          type: 'array',
          description:
            'Exactly one focused question when outcome is needs_input; otherwise empty',
          items: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                minLength: 1,
                description:
                  'The focused question requiring user input, without embedded suggested choices',
              },
              options: {
                type: 'array',
                items: { type: 'string', minLength: 1 },
                description:
                  'Two to four meaningful choices for bounded decisions and whenever the user requests options; omit for free-text answers',
              },
            },
            required: ['prompt'],
          },
        },
      },
      required: [
        'outcome',
        'title',
        'summary',
        'tasks',
        'tests',
        'assumptions',
        'questions',
      ],
    },
  },
};

function getFinishPlanModeTool(allowAnswer = true): OllamaTool {
  const parameters = FINISH_PLAN_MODE_TOOL.function.parameters;
  if (allowAnswer || !parameters?.properties) {
    return FINISH_PLAN_MODE_TOOL;
  }

  return {
    ...FINISH_PLAN_MODE_TOOL,
    function: {
      ...FINISH_PLAN_MODE_TOOL.function,
      parameters: {
        ...parameters,
        properties: {
          ...parameters.properties,
          outcome: {
            ...parameters.properties.outcome,
            enum: ['ready', 'needs_input'],
          },
        },
      },
    },
  };
}

export function specializeFinishPlanModeParameters(
  parameters: NonNullable<OllamaTool['function']['parameters']>,
  outcome: PlanOutcome,
): NonNullable<OllamaTool['function']['parameters']> {
  const properties = parameters.properties;
  const allowedOutcomes = properties?.outcome.enum;
  if (
    !properties ||
    (Array.isArray(allowedOutcomes) && !allowedOutcomes.includes(outcome))
  ) {
    return parameters;
  }

  const arrayLimits =
    outcome === 'answer'
      ? {
          tasks: { maxItems: 0 },
          tests: { maxItems: 0 },
          assumptions: { maxItems: 0 },
          questions: { maxItems: 0 },
        }
      : outcome === 'ready'
        ? {
            tasks: { minItems: 1 },
            questions: { maxItems: 0 },
          }
        : { questions: { minItems: 1, maxItems: 1 } };

  return {
    ...parameters,
    properties: {
      ...properties,
      outcome: { ...properties.outcome, enum: [outcome] },
      ...Object.fromEntries(
        Object.entries(arrayLimits).map(([name, limits]) => [
          name,
          { ...properties[name], ...limits },
        ]),
      ),
    },
  };
}

/**
 * Tool definitions for Ollama API
 */
export const TOOLS = [
  defineTool(
    TOOL.READ_FILE,
    'Read the contents of a file at the specified path, optionally limited by line range',
    {
      path: { type: 'string', description: 'The path to the file to read' },
      startLine: {
        type: 'number',
        description: 'Optional starting line number to read from (1-indexed)',
      },
      endLine: {
        type: 'number',
        description: 'Optional ending line number to read through (inclusive)',
      },
      maxLines: {
        type: 'number',
        description:
          'Optional maximum number of lines to read; cannot be combined with endLine',
      },
      maxChars: {
        type: 'number',
        description: `Optional maximum number of characters to return; defaults to 50000; applies after any line-range selection`,
      },
    },
    ['path'],
  ),

  defineTool(
    TOOL.WRITE_FILE,
    'Write content to a file at the specified path',
    {
      path: { type: 'string', description: 'The path to the file to write' },
      content: {
        type: 'string',
        description: 'The content to write to the file',
      },
    },
    ['path', 'content'],
  ),

  defineTool(
    TOOL.EDIT_FILE,
    'Replace one unique exact text match in an existing file; if oldText matches multiple locations, reread the file and retry with a larger unique block',
    {
      path: { type: 'string', description: 'The path to the file to edit' },
      oldText: {
        type: 'string',
        description:
          'A unique exact existing text block to replace; include enough surrounding context to match once',
      },
      newText: {
        type: 'string',
        description: 'The replacement text to write in place of oldText',
      },
    },
    ['path', 'oldText', 'newText'],
  ),

  defineTool(
    TOOL.CREATE_DIRECTORY,
    'Create a directory and any missing parent directories at the specified path',
    {
      path: {
        type: 'string',
        description: 'The directory path to create',
      },
    },
    ['path'],
  ),

  defineTool(
    TOOL.RENAME_PATH,
    'Rename or move an existing file or directory to a new path',
    {
      from: {
        type: 'string',
        description: 'The existing file or directory path to rename or move',
      },
      to: {
        type: 'string',
        description: 'The destination path for the renamed or moved item',
      },
    },
    ['from', 'to'],
  ),

  defineTool(
    TOOL.DELETE_PATH,
    'Delete a file or directory at the specified path',
    {
      path: {
        type: 'string',
        description: 'The file or directory path to delete',
      },
      recursive: {
        type: 'boolean',
        description:
          'Whether to delete non-empty directories recursively; use false for files and empty directories',
      },
    },
    ['path', 'recursive'],
  ),

  defineTool(
    TOOL.RUN_SHELL,
    'Execute a shell command',
    {
      command: { type: 'string', description: 'The shell command to execute' },
    },
    ['command'],
  ),

  defineTool(
    TOOL.LIST_DIR,
    'List the contents of a directory',
    {
      path: {
        type: 'string',
        description: 'The path to the directory to list',
      },
    },
    ['path'],
  ),

  defineTool(
    TOOL.FIND_FILES,
    'Recursively find files under a directory, optionally matching a simple substring or wildcard pattern',
    {
      path: {
        type: 'string',
        description: 'The directory path to search in',
      },
      pattern: {
        type: 'string',
        description:
          'Optional case-insensitive substring or wildcard pattern to match against file paths',
      },
      includeHidden: {
        type: 'boolean',
        description:
          'Whether to include hidden files and directories; defaults to false',
      },
    },
    ['path'],
  ),

  defineTool(
    TOOL.GREP_SEARCH,
    'Search files within a directory; multi-word queries also match common code identifier forms',
    {
      pattern: {
        type: 'string',
        description: 'The regex, phrase, or code concept to search for',
      },
      path: { type: 'string', description: 'The directory path to search in' },
    },
    ['pattern', 'path'],
  ),

  defineTool(
    TOOL.WEB_SEARCH,
    'Search the web for external or current information',
    {
      query: { type: 'string', description: 'The search query to look up' },
    },
    ['query'],
  ),

  defineTool(
    TOOL.WEB_FETCH,
    'Fetch the readable content of a webpage at the given URL',
    {
      url: { type: 'string', description: 'The full URL of the page to fetch' },
    },
    ['url'],
  ),
] satisfies OllamaTool[];

export async function getToolDefinitions(
  options: ToolDefinitionOptions = {},
): Promise<OllamaTool[]> {
  const builtInTools =
    options.mode === MODE.PLAN
      ? [
          ...TOOLS.filter((tool) => READ_TOOLS.has(tool.function.name)),
          getFinishPlanModeTool(options.allowPlanAnswer),
        ]
      : TOOLS;
  const mcpTools = options.mode
    ? await getMcpToolDefinitionsForMode(options.mode)
    : await getMcpToolDefinitions();

  return [...builtInTools, ...mcpTools];
}

// tools that can be used during plan mode
export const READ_TOOLS = new Set<string>(TOOL.READ_TOOL_NAMES);

// tools that require approval before execution (safe mode or plan approval)
export const WRITE_TOOLS = new Set<string>(TOOL.WRITE_TOOL_NAMES);
