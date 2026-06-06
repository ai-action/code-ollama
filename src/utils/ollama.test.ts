const { mockChat, mockDelete, mockFetch, mockList, mockPull } = vi.hoisted(
  () => ({
    mockChat: vi.fn(),
    mockDelete: vi.fn(),
    mockFetch: vi.fn(),
    mockList: vi.fn(),
    mockPull: vi.fn(),
  }),
);

vi.mock('ollama', () => ({
  Ollama: class MockOllama {
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
  deleteModel,
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
        | { messages: { tool_calls?: unknown }[] }
        | undefined;
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

    it('returns true for "I am going to check" intent', () => {
      expect(hasUncalledToolIntent('I am going to check the directory')).toBe(
        true,
      );
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

    it('returns true for explicit tool-use intent', () => {
      expect(hasUncalledToolIntent('I will use a tool to read the file')).toBe(
        true,
      );
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
