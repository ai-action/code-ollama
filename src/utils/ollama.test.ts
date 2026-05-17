const { mockChat, mockDelete, mockList, mockPull } = vi.hoisted(() => ({
  mockChat: vi.fn(),
  mockDelete: vi.fn(),
  mockList: vi.fn(),
  mockPull: vi.fn(),
}));

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

import { deleteModel, listModels, pullModel, streamChat } from './ollama';

describe('ollama', () => {
  beforeEach(() => {
    mockChat.mockResolvedValue({
      async *[Symbol.asyncIterator]() {
        await Promise.resolve();
        yield { message: { content: 'Hello' } };
      },
    });
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

  describe('streamChat', () => {
    it('should yield content from stream', async () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const results: { type: string; content: string }[] = [];

      for await (const chunk of streamChat(messages, 'codellama')) {
        results.push(chunk as { type: string; content: string });
      }

      expect(results).toEqual([{ type: 'content', content: 'Hello' }]);
    });

    it('should skip chunks with empty content', async () => {
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

    it('should yield tool_calls from stream', async () => {
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
    it('should return list of models', async () => {
      const models = await listModels();
      expect(models).toEqual(['codellama', 'llama2']);
    });
  });

  describe('pullModel', () => {
    it('should request a streamed pull', async () => {
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
    it('should delete a model', async () => {
      await deleteModel('codellama:7b');
      expect(mockDelete).toHaveBeenCalledWith({ model: 'codellama:7b' });
    });
  });
});
