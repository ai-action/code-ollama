const { mockChat, mockList } = vi.hoisted(() => ({
  mockChat: vi.fn(),
  mockList: vi.fn(),
}));

vi.mock('ollama', () => ({
  Ollama: class MockOllama {
    chat(...args: unknown[]) {
      return mockChat(...args) as Promise<AsyncIterable<unknown>>;
    }

    list(...args: unknown[]) {
      return mockList(...args) as Promise<unknown>;
    }
  },
}));

import { listModels, streamChat } from './ollama';

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
  });

  describe('streamChat', () => {
    it('should yield content from stream', async () => {
      const messages = [{ role: 'user' as const, content: 'hello' }];
      const results: string[] = [];

      for await (const chunk of streamChat(messages, 'codellama')) {
        results.push(chunk);
      }

      expect(results).toEqual(['Hello']);
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
      const results: string[] = [];

      for await (const chunk of streamChatWithEmpty(messages, 'codellama')) {
        results.push(chunk);
      }

      expect(results).toEqual(['Non-empty']);
    });
  });

  describe('listModels', () => {
    it('should return list of models', async () => {
      const models = await listModels();
      expect(models).toEqual(['codellama', 'llama2']);
    });
  });
});
