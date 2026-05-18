import { parseContent, unwrapRawMarkdownFence } from './parsing';

describe('parsing', () => {
  describe('parseContent', () => {
    it('parses plain text without code blocks', () => {
      const result = parseContent('Hello world');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ type: 'text', content: 'Hello world' });
    });

    it('parses code block with language', () => {
      const result = parseContent('```typescript\nconst x = 1;\n```');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'code',
        content: 'const x = 1;',
        language: 'typescript',
      });
    });

    it('parses code block without language', () => {
      const result = parseContent('```\nsome code\n```');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'code',
        content: 'some code',
        language: undefined,
      });
    });

    it('parses mixed content with text and code', () => {
      const result = parseContent('Hello\n```js\ncode\n```\nWorld');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'text', content: 'Hello' });
      expect(result[1]).toEqual({
        type: 'code',
        content: 'code',
        language: 'js',
      });
      expect(result[2]).toEqual({ type: 'text', content: 'World' });
    });

    it('parses indented code blocks', () => {
      const result = parseContent('  ```js\n  code\n  ```');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'code',
        content: 'code',
        language: 'js',
      });
    });

    it('handles unclosed code fence', () => {
      const result = parseContent('```js\nunclosed code');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'text',
        content: '```js\nunclosed code',
      });
    });

    it('handles ambiguous nested fences', () => {
      const result = parseContent('```\n```js\nnested\n```\n```');
      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('raw');
    });

    it('handles empty content', () => {
      const result = parseContent('');
      expect(result).toHaveLength(0);
    });

    it('handles whitespace-only content', () => {
      const result = parseContent('   \n  ');
      expect(result).toHaveLength(0);
    });

    it('preserves text around code blocks', () => {
      const result = parseContent('Before\n```\ncode\n```\nAfter');
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ type: 'text', content: 'Before' });
      expect(result[1]).toEqual({
        type: 'code',
        content: 'code',
        language: undefined,
      });
      expect(result[2]).toEqual({ type: 'text', content: 'After' });
    });

    it('handles backticks within code blocks', () => {
      const result = parseContent('```\n`inline`\n```');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'code',
        content: '`inline`',
        language: undefined,
      });
    });

    it('handles deeply indented code blocks', () => {
      const result = parseContent('    ```js\n    const x = 1;\n    ```');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'code',
        content: 'const x = 1;',
        language: 'js',
      });
    });
  });

  describe('unwrapRawMarkdownFence', () => {
    it('unwraps markdown fence', () => {
      const result = unwrapRawMarkdownFence('```markdown\ncontent\n```');
      expect(result).toBe('content');
    });

    it('returns null for non-markdown fence', () => {
      const result = unwrapRawMarkdownFence('```js\ncontent\n```');
      expect(result).toBeNull();
    });

    it('returns null for missing end fence', () => {
      const result = unwrapRawMarkdownFence('```markdown\ncontent');
      expect(result).toBeNull();
    });

    it('returns null for missing start fence', () => {
      const result = unwrapRawMarkdownFence('content\n```');
      expect(result).toBeNull();
    });

    it('handles empty content', () => {
      const result = unwrapRawMarkdownFence('```markdown\n```');
      expect(result).toBe('');
    });
  });
});
