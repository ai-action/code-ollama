const { mockChat, mockDelete, mockFetch, mockList, mockOllama, mockPull } =
  vi.hoisted(() => ({
    mockChat: vi.fn(),
    mockDelete: vi.fn(),
    mockFetch: vi.fn(),
    mockList: vi.fn(),
    mockOllama: vi.fn(),
    mockPull: vi.fn(),
  }));

vi.mock('ollama', () => ({
  Ollama: class MockOllama {
    constructor(config: { host: string }) {
      mockOllama(config);
    }
    chat(...args: unknown[]) {
      return mockChat(...args) as Promise<AsyncIterable<unknown>>;
    }

    delete(...args: unknown[]) {
      return mockDelete(...args) as Promise<unknown>;
    }

    list(...args: unknown[]) {
      return mockList(...args) as Promise<unknown>;
    }

    pull(...args: unknown[]) {
      return mockPull(...args) as Promise<unknown>;
    }
  },
}));

import {
  checkHealth,
  configureHost,
  deleteModel,
  generateStructuredChat,
  hasSerializedToolCall,
  hasUncalledToolIntent,
  listModels,
  pullModel,
  sanitizeAssistantContent,
  streamChat,
} from './ollama';

describe('ollama', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockChat.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield { message: { content: 'Hello' } };
      },
    });
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockList.mockResolvedValue({
      models: [{ name: 'codellama' }, { name: 'llama2' }],
    });
    mockPull.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield {
          status: 'pulling',
          digest: '123',
          total: 10,
          completed: 5,
        };
      },
      abort: vi.fn(),
    });
    mockDelete.mockResolvedValue({ status: 'success' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('checkHealth', () => {
    it('returns true when the server is reachable', async () => {
      await expect(checkHealth()).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://localhost:11434');
    });

    it('returns false when the server is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

      await expect(checkHealth()).resolves.toBe(false);
    });

    it('returns false when the server responds without an ok status', async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 503 });

      await expect(checkHealth()).resolves.toBe(false);
    });

    it('checks a candidate host with an abort signal', async () => {
      const controller = new AbortController();

      await expect(
        checkHealth('http://remote:11434', controller.signal),
      ).resolves.toBe(true);
      expect(mockFetch).toHaveBeenCalledWith('http://remote:11434', {
        signal: controller.signal,
      });
    });

    it('propagates an aborted connection check', async () => {
      const controller = new AbortController();
      controller.abort();
      const abortError = new Error('aborted');
      mockFetch.mockRejectedValueOnce(abortError);

      await expect(
        checkHealth('http://remote:11434', controller.signal),
      ).rejects.toBe(abortError);
    });
  });

  describe('configureHost', () => {
    it('recreates the client only when the host changes', () => {
      const callsBefore = mockOllama.mock.calls.length;

      configureHost('http://remote:11434');
      configureHost('http://remote:11434');

      expect(mockOllama).toHaveBeenCalledTimes(callsBefore + 1);
      expect(mockOllama).toHaveBeenLastCalledWith({
        host: 'http://remote:11434',
      });
    });
  });

  describe('streamChat', () => {
    it('yields content from stream', async () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const results: { type: string; content: string }[] = [];

      for await (const chunk of streamChat(messages, 'codellama')) {
        results.push(chunk as { type: string; content: string });
      }

      expect(results).toEqual([{ type: 'content', content: 'Hello' }]);
      expect(mockChat).toHaveBeenCalledWith({
        model: 'codellama',
        messages,
        stream: true,
        think: false,
        tools: undefined,
      });
    });

    it('omits signal from chat options when no signal is provided', async () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];

      for await (const chunk of streamChat(
        messages,
        'codellama',
        undefined,
        undefined,
      )) {
        void chunk;
      }

      const callArgs = mockChat.mock.calls[0]?.[0] as Record<string, unknown>;
      expect('signal' in callArgs).toBe(false);
    });

    it('passes tool_calls in message through to the chat request', async () => {
      const toolCall = {
        function: { name: 'read_file', arguments: { path: '/test.txt' } },
      };
      const messages = [
        {
          role: 'assistant' as const,
          content: '',
          tool_calls: [toolCall],
        },
      ];

      for await (const chunk of streamChat(messages, 'codellama')) {
        void chunk;
      }

      const callArgs = mockChat.mock.lastCall?.[0] as
        { messages: { tool_calls?: unknown }[] } | undefined;
      expect(callArgs?.messages[0]?.tool_calls).toEqual([toolCall]);
    });

    it('passes image attachments through to the chat request', async () => {
      const messages = [
        {
          role: 'user' as const,
          content: 'describe this',
          images: ['/tmp/a.png'],
        },
      ];

      for await (const chunk of streamChat(messages, 'codellama')) {
        void chunk;
      }

      expect(mockChat).toHaveBeenCalledWith({
        model: 'codellama',
        messages,
        stream: true,
        think: false,
        tools: undefined,
      });
    });

    it('skips chunks with empty content', async () => {
      // Override mock to yield empty content first
      mockChat.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield { message: { content: '' } };
          yield { message: { content: 'Non-empty' } };
        },
      });

      // Need to re-import to get a fresh client with new mock
      const { streamChat: streamChatWithEmpty } = await import('./ollama');
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const results: { type: string; content: string }[] = [];

      for await (const chunk of streamChatWithEmpty(messages, 'codellama')) {
        results.push(chunk as { type: string; content: string });
      }

      expect(results).toEqual([{ type: 'content', content: 'Non-empty' }]);
    });

    it('yields tool_calls from stream', async () => {
      mockChat.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            message: {
              content: '',
              tool_calls: [
                {
                  function: {
                    name: 'read_file',
                    arguments: { path: '/test.txt' },
                  },
                },
              ],
            },
          };
        },
      });

      const { streamChat: streamChatWithTools } = await import('./ollama');
      const messages = [{ role: 'user' as const, content: 'read file' }];
      const results: { type: string; tool_calls?: unknown[] }[] = [];

      for await (const chunk of streamChatWithTools(messages, 'codellama')) {
        results.push(chunk);
      }

      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('tool_calls');
      expect(results[0].tool_calls).toHaveLength(1);
      expect(results[0].tool_calls?.[0]).toMatchObject({
        function: { name: 'read_file', arguments: { path: '/test.txt' } },
      });
    });

    it('aggregates tool calls streamed in separate chunks', async () => {
      mockChat.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          for (const path of ['/one.ts', '/two.ts']) {
            await Promise.resolve();
            yield {
              message: {
                content: '',
                tool_calls: [
                  {
                    function: {
                      name: 'read_file',
                      arguments: { path },
                    },
                  },
                ],
              },
            };
          }
        },
      });
      const results = [];

      for await (const chunk of streamChat(
        [{ role: 'user', content: 'read files' }],
        'codellama',
      )) {
        results.push(chunk);
      }

      expect(results).toEqual([
        {
          type: 'tool_calls',
          tool_calls: [
            {
              function: {
                name: 'read_file',
                arguments: { path: '/one.ts' },
              },
            },
            {
              function: {
                name: 'read_file',
                arguments: { path: '/two.ts' },
              },
            },
          ],
        },
      ]);
    });

    it('yields final usage stats before buffered tool calls', async () => {
      mockChat.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield {
            message: {
              content: 'Working',
              tool_calls: [
                {
                  function: {
                    name: 'read_file',
                    arguments: { path: '/test.txt' },
                  },
                },
              ],
            },
            done: true,
            prompt_eval_count: 120,
            eval_count: 30,
            total_duration: 5_000_000_000,
            load_duration: 100_000_000,
            prompt_eval_duration: 900_000_000,
            eval_duration: 3_500_000_000,
          };
        },
      });
      const results = [];

      for await (const chunk of streamChat(
        [{ role: 'user', content: 'read a file' }],
        'qwen3:8b',
      )) {
        results.push(chunk);
      }

      expect(results).toEqual([
        { type: 'content', content: 'Working' },
        {
          type: 'stats',
          stats: {
            model: 'qwen3:8b',
            promptTokens: 120,
            outputTokens: 30,
            totalDurationNs: 5_000_000_000,
            loadDurationNs: 100_000_000,
            promptEvalDurationNs: 900_000_000,
            evalDurationNs: 3_500_000_000,
          },
        },
        {
          type: 'tool_calls',
          tool_calls: [
            {
              function: {
                name: 'read_file',
                arguments: { path: '/test.txt' },
              },
            },
          ],
        },
      ]);
    });

    it('does not yield stats without a completed response', async () => {
      mockChat.mockResolvedValueOnce({
        async *[Symbol.asyncIterator]() {
          await Promise.resolve();
          yield { message: { content: 'Partial' }, done: false };
        },
      });
      const results = [];

      for await (const chunk of streamChat(
        [{ role: 'user', content: 'hello' }],
        'qwen3:8b',
      )) {
        results.push(chunk);
      }

      expect(results).toEqual([{ type: 'content', content: 'Partial' }]);
    });
  });

  describe('generateStructuredChat', () => {
    it('requests a non-streaming schema-constrained response', async () => {
      const controller = new AbortController();
      const format = {
        type: 'object',
        properties: { kind: { type: 'string' } },
        required: ['kind'],
      };
      mockChat.mockResolvedValue({
        message: { content: '{"kind":"answer"}' },
        prompt_eval_count: 40,
        eval_count: 10,
        total_duration: 2_000_000_000,
        load_duration: 100_000_000,
        prompt_eval_duration: 500_000_000,
        eval_duration: 1_000_000_000,
      });

      const toolCall = {
        function: { name: 'read_file', arguments: { path: '/test.txt' } },
      };
      const messages = [
        {
          role: 'user' as const,
          content: 'Answer with JSON',
          images: ['/tmp/reference.png'],
          tool_calls: [toolCall],
        },
      ];

      await expect(
        generateStructuredChat(messages, 'gemma4', format, controller.signal),
      ).resolves.toEqual({
        content: '{"kind":"answer"}',
        stats: {
          model: 'gemma4',
          promptTokens: 40,
          outputTokens: 10,
          totalDurationNs: 2_000_000_000,
          loadDurationNs: 100_000_000,
          promptEvalDurationNs: 500_000_000,
          evalDurationNs: 1_000_000_000,
        },
      });
      expect(mockChat).toHaveBeenCalledWith({
        model: 'gemma4',
        messages,
        stream: false,
        format,
        think: false,
        signal: controller.signal,
      });

      await generateStructuredChat(
        [{ role: 'user', content: 'Answer without attachments' }],
        'gemma4',
        format,
      );
      expect(mockChat).toHaveBeenLastCalledWith({
        model: 'gemma4',
        messages: [{ role: 'user', content: 'Answer without attachments' }],
        stream: false,
        format,
        think: false,
      });
    });
  });

  describe('listModels', () => {
    it('returns list of models', async () => {
      const models = await listModels();
      expect(models).toEqual(['codellama', 'llama2']);
    });
  });

  describe('pullModel', () => {
    it('requests a streamed pull', async () => {
      const pull = await pullModel('qwen3:8b');
      const updates: unknown[] = [];

      for await (const update of pull) {
        updates.push(update);
      }

      expect(mockPull).toHaveBeenCalledWith({
        model: 'qwen3:8b',
        stream: true,
      });
      expect(updates).toEqual([
        {
          status: 'pulling',
          digest: '123',
          total: 10,
          completed: 5,
        },
      ]);
    });
  });

  describe('deleteModel', () => {
    it('deletes a model', async () => {
      await deleteModel('codellama:7b');
      expect(mockDelete).toHaveBeenCalledWith({ model: 'codellama:7b' });
    });
  });

  describe('hasUncalledToolIntent', () => {
    it('returns true for "I will read" intent', () => {
      expect(hasUncalledToolIntent('I will read the file')).toBe(true);
    });

    it('returns true when Markdown formats the intended action', () => {
      expect(
        hasUncalledToolIntent(
          'Since I need an exact match, I will **read only the section** of the file.',
        ),
      ).toBe(true);
    });

    it('returns true for contracted tool intent', () => {
      expect(hasUncalledToolIntent("I'll read the relevant lines.")).toBe(true);
    });

    it('returns true for deferred tool intent', () => {
      expect(hasUncalledToolIntent('I will start by reading the file.')).toBe(
        true,
      );
      expect(hasUncalledToolIntent("I'll try reading the section.")).toBe(true);
    });

    it('returns true for "I am going to check" intent', () => {
      expect(hasUncalledToolIntent('I am going to check the directory')).toBe(
        true,
      );
    });

    it('returns true when the model promises to apply a change', () => {
      expect(
        hasUncalledToolIntent('I will now apply the change using edit_file.'),
      ).toBe(true);
    });

    it('returns true for serialized tool calls printed as content', () => {
      for (const content of [
        'Tool edit_file({"path":"src/constants/prompt.ts"})',
        'tool_name:edit_file tool_input:{path:"src/constants/prompt.ts"}',
        '<tool_call|><|tool_response>',
      ]) {
        expect(hasSerializedToolCall(content)).toBe(true);
        expect(hasUncalledToolIntent(content)).toBe(true);
      }
    });

    it('returns true for "next, I will list" intent', () => {
      expect(hasUncalledToolIntent('Next, I will list the files')).toBe(true);
    });

    it('returns true for "now I will search" intent', () => {
      expect(hasUncalledToolIntent('Now I will search for the pattern')).toBe(
        true,
      );
    });

    it('returns true for "first, I will update" intent', () => {
      expect(hasUncalledToolIntent('First, I will update the config')).toBe(
        true,
      );
    });

    it('returns true for commit intent', () => {
      expect(hasUncalledToolIntent('I will now commit this change.')).toBe(
        true,
      );
    });

    it('returns true for staging intent', () => {
      expect(hasUncalledToolIntent('I am going to stage the deletion.')).toBe(
        true,
      );
    });

    it('returns true for file creation intent', () => {
      expect(hasUncalledToolIntent('I will create src/new-file.ts.')).toBe(
        true,
      );
    });

    it('returns true for path move intent', () => {
      expect(
        hasUncalledToolIntent('I am going to move docs/old.md to docs/new.md.'),
      ).toBe(true);
    });

    it('returns true for directory deletion intent', () => {
      expect(hasUncalledToolIntent('I will delete the temp directory.')).toBe(
        true,
      );
    });

    it('returns true for explicit tool-use intent', () => {
      expect(hasUncalledToolIntent('I will use a tool to read the file')).toBe(
        true,
      );
    });

    it('returns true for proceeding with an edit', () => {
      expect(
        hasUncalledToolIntent(
          'I will now proceed with editing the PLAN_INSTRUCTION constant.',
        ),
      ).toBe(true);
    });

    it('returns true for named tool-use intent', () => {
      expect(
        hasUncalledToolIntent('I will use the `edit_file` tool for this.'),
      ).toBe(true);
    });

    it('returns false for ordinary content with no tool intent', () => {
      expect(hasUncalledToolIntent('Here is the result of the search.')).toBe(
        false,
      );
    });

    it('returns false for empty string', () => {
      expect(hasUncalledToolIntent('')).toBe(false);
    });

    it('returns false when action verb is present but no intent phrase', () => {
      expect(hasUncalledToolIntent('The file was read successfully.')).toBe(
        false,
      );
    });

    it('returns false for generic future-tense explanations', () => {
      expect(
        hasUncalledToolIntent(
          'I will always aim to keep changes minimal, follow existing standards, and integrate cleanly with the current codebase.',
        ),
      ).toBe(false);
    });

    it('returns false when a tool verb appears later in the response', () => {
      expect(
        hasUncalledToolIntent(
          'I will answer at a high level. You can use /skills to list loaded skills.',
        ),
      ).toBe(false);
    });

    it('returns false for non-tool creation phrasing', () => {
      expect(hasUncalledToolIntent('I will create a plan for the work.')).toBe(
        false,
      );
    });

    it('returns false for non-tool movement phrasing', () => {
      expect(hasUncalledToolIntent('I will move on to the next topic.')).toBe(
        false,
      );
    });
  });

  describe('sanitizeAssistantContent', () => {
    it('returns content unchanged when no control tokens present', () => {
      const content = 'Hello, this is a normal response.';
      expect(sanitizeAssistantContent(content)).toBe(content);
    });

    it('removes trailing <channel> token', () => {
      const content = 'Hello response<channel>';
      expect(sanitizeAssistantContent(content)).toBe('Hello response');
    });

    it('removes trailing <|channel|> token', () => {
      const content = 'Hello response<|channel|>';
      expect(sanitizeAssistantContent(content)).toBe('Hello response');
    });

    it('removes multiple trailing control tokens', () => {
      const content = 'Hello response<channel><|channel|>  ';
      expect(sanitizeAssistantContent(content)).toBe('Hello response');
    });

    it('removes control tokens with whitespace', () => {
      const content = 'Hello response   <channel>  ';
      expect(sanitizeAssistantContent(content)).toBe('Hello response');
    });

    it('does not remove tokens in the middle of content', () => {
      const content = 'Hello <channel> response';
      expect(sanitizeAssistantContent(content)).toBe(content);
    });

    it('handles empty string', () => {
      expect(sanitizeAssistantContent('')).toBe('');
    });

    it('handles string with only control tokens', () => {
      expect(sanitizeAssistantContent('<channel>')).toBe('');
    });
  });
});
