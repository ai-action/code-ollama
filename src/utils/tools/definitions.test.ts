import type { Tool as OllamaTool } from 'ollama';

const { getMcpToolDefinitions, getMcpToolDefinitionsForMode } = vi.hoisted(
  () => ({
    getMcpToolDefinitions: vi.fn<() => Promise<OllamaTool[]>>(() =>
      Promise.resolve([]),
    ),
    getMcpToolDefinitionsForMode: vi.fn<
      (mode: 'plan' | 'safe' | 'auto') => Promise<OllamaTool[]>
    >(() => Promise.resolve([])),
  }),
);

vi.mock('../mcp', () => ({
  getMcpToolDefinitions,
  getMcpToolDefinitionsForMode,
}));

import {
  FINISH_PLAN_MODE_TOOL,
  getToolDefinitions,
  READ_TOOLS,
  specializeFinishPlanModeParameters,
  TOOLS,
  WRITE_TOOLS,
} from './definitions';

describe('definitions', () => {
  beforeEach(() => {
    getMcpToolDefinitions.mockClear();
    getMcpToolDefinitionsForMode.mockClear();
  });

  describe('TOOLS', () => {
    it('requires non-empty finish_plan_mode strings in the JSON schema', () => {
      expect(FINISH_PLAN_MODE_TOOL.function.parameters).toMatchObject({
        properties: {
          title: { type: 'string', minLength: 1 },
          summary: { type: 'string', minLength: 1 },
          tasks: {
            items: {
              properties: {
                id: { type: 'string', minLength: 1 },
                description: { type: 'string', minLength: 1 },
                dependencies: {
                  items: { type: 'string', minLength: 1 },
                },
                verification: { type: 'string', minLength: 1 },
              },
            },
          },
          tests: { items: { type: 'string', minLength: 1 } },
          assumptions: { items: { type: 'string', minLength: 1 } },
          questions: {
            items: {
              properties: {
                prompt: { type: 'string', minLength: 1 },
                options: { items: { type: 'string', minLength: 1 } },
              },
            },
          },
        },
      });
    });

    it('specializes finish_plan_mode array cardinality by outcome', () => {
      const parameters = FINISH_PLAN_MODE_TOOL.function.parameters;
      expect(parameters).toBeDefined();
      if (!parameters) {
        return;
      }

      expect(
        specializeFinishPlanModeParameters(parameters, 'answer'),
      ).toMatchObject({
        properties: {
          outcome: { enum: ['answer'] },
          tasks: { maxItems: 0 },
          tests: { maxItems: 0 },
          assumptions: { maxItems: 0 },
          questions: { maxItems: 0 },
        },
      });
      expect(
        specializeFinishPlanModeParameters(parameters, 'ready'),
      ).toMatchObject({
        properties: {
          outcome: { enum: ['ready'] },
          tasks: { minItems: 1 },
          questions: { maxItems: 0 },
        },
      });
      expect(
        specializeFinishPlanModeParameters(parameters, 'needs_input'),
      ).toMatchObject({
        properties: {
          outcome: { enum: ['needs_input'] },
          questions: { minItems: 1, maxItems: 1 },
        },
      });
    });

    it('returns parameters unchanged when outcome is not in the allowed enum', () => {
      const rawParameters = FINISH_PLAN_MODE_TOOL.function.parameters;
      if (!rawParameters?.properties) {
        return;
      }
      const parameters = {
        ...rawParameters,
        properties: {
          ...rawParameters.properties,
          outcome: {
            ...rawParameters.properties.outcome,
            enum: ['ready', 'needs_input'],
          },
        },
      };
      const result = specializeFinishPlanModeParameters(parameters, 'answer');

      expect(result).toBe(parameters);
      expect(result.properties?.outcome.enum).toEqual(['ready', 'needs_input']);
    });

    it('exports tool definitions', () => {
      expect(TOOLS).toHaveLength(12);
      expect(TOOLS.map((t) => t.function.name)).toContain('read_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('write_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('edit_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('create_directory');
      expect(TOOLS.map((t) => t.function.name)).toContain('rename_path');
      expect(TOOLS.map((t) => t.function.name)).toContain('delete_path');
      expect(TOOLS.map((t) => t.function.name)).toContain('run_shell');
      expect(TOOLS.map((t) => t.function.name)).toContain('list_dir');
      expect(TOOLS.map((t) => t.function.name)).toContain('find_files');
      expect(TOOLS.map((t) => t.function.name)).toContain('grep_search');
      expect(TOOLS.map((t) => t.function.name)).toContain('web_search');
      expect(TOOLS.map((t) => t.function.name)).toContain('web_fetch');
    });

    it('merges built-in tools with MCP tools', async () => {
      getMcpToolDefinitions.mockResolvedValueOnce([
        {
          type: 'function',
          function: {
            name: 'mcp__docs__resolve',
            description: 'Resolve docs',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ]);

      const definitions = await getToolDefinitions();

      expect(definitions).toHaveLength(13);
      expect(definitions.map((tool) => tool.function.name)).toContain(
        'mcp__docs__resolve',
      );
    });

    it('uses mode-filtered MCP tools when a mode is provided', async () => {
      getMcpToolDefinitionsForMode.mockResolvedValueOnce([
        {
          type: 'function',
          function: {
            name: 'mcp__docs__resolve',
            description: 'Resolve docs',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ]);

      const definitions = await getToolDefinitions({ mode: 'safe' });

      expect(getMcpToolDefinitionsForMode).toHaveBeenCalledWith('safe');
      expect(getMcpToolDefinitions).not.toHaveBeenCalled();
      expect(definitions.map((tool) => tool.function.name)).toContain(
        'mcp__docs__resolve',
      );
    });

    it('returns read-only built-in tools plus plan-allowed MCP tools in plan mode', async () => {
      getMcpToolDefinitionsForMode.mockResolvedValueOnce([
        {
          type: 'function',
          function: {
            name: 'mcp__docs__resolve',
            description: 'Resolve docs',
            parameters: { type: 'object', properties: {}, required: [] },
          },
        },
      ]);

      const definitions = await getToolDefinitions({ mode: 'plan' });
      const names = definitions.map((tool) => tool.function.name);

      expect(names).toContain('read_file');
      expect(names).toContain('find_files');
      expect(names).toContain('finish_plan_mode');
      expect(names).toContain('mcp__docs__resolve');
      expect(names).not.toContain('write_file');
      expect(names).not.toContain('run_shell');

      const finishPlanMode = definitions.find(
        ({ function: toolFunction }) =>
          toolFunction.name === 'finish_plan_mode',
      );
      expect(finishPlanMode?.function.parameters?.required).toEqual([
        'outcome',
        'title',
        'summary',
        'tasks',
        'tests',
        'assumptions',
        'questions',
      ]);
    });

    it('excludes answer from finish_plan_mode when the request requires a plan', async () => {
      const definitions = await getToolDefinitions({
        mode: 'plan',
        allowPlanAnswer: false,
      });
      const finishPlanMode = definitions.find(
        ({ function: toolFunction }) =>
          toolFunction.name === 'finish_plan_mode',
      );

      expect(
        finishPlanMode?.function.parameters?.properties?.outcome.enum,
      ).toEqual(['ready', 'needs_input']);
      expect(
        FINISH_PLAN_MODE_TOOL.function.parameters?.properties?.outcome.enum,
      ).toEqual(['ready', 'needs_input', 'answer']);
    });
  });

  describe('WRITE_TOOLS', () => {
    it('contains write_file, edit_file, create_directory, rename_path, delete_path, and run_shell', () => {
      expect(WRITE_TOOLS.has('write_file')).toBe(true);
      expect(WRITE_TOOLS.has('edit_file')).toBe(true);
      expect(WRITE_TOOLS.has('create_directory')).toBe(true);
      expect(WRITE_TOOLS.has('rename_path')).toBe(true);
      expect(WRITE_TOOLS.has('delete_path')).toBe(true);
      expect(WRITE_TOOLS.has('run_shell')).toBe(true);
      expect(WRITE_TOOLS.has('finish_plan_mode')).toBe(false);
      expect(WRITE_TOOLS.has('read_file')).toBe(false);
    });
  });

  describe('READ_TOOLS', () => {
    it('contains find_files and web_search', () => {
      expect(READ_TOOLS.has('find_files')).toBe(true);
      expect(READ_TOOLS.has('web_search')).toBe(true);
      expect(READ_TOOLS.has('finish_plan_mode')).toBe(false);
      expect(READ_TOOLS.has('write_file')).toBe(false);
    });
  });
});
