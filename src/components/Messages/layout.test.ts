import {
  countWrappedLines,
  getAssistantContentWidth,
  getCodeBlockHeight,
  getStreamingTextHeight,
  stripAnsi,
} from './layout';

describe('message layout utilities', () => {
  it('strips ANSI escape sequences', () => {
    expect(stripAnsi('\u001B[36mhello\u001B[39m')).toBe('hello');
  });

  it('counts wrapped lines for plain text', () => {
    expect(countWrappedLines('abcdefghij', 4)).toBe(3);
  });

  it('counts explicit blank lines', () => {
    expect(countWrappedLines('top\n\nbottom', 10)).toBe(3);
  });

  it('counts wrapped lines after ANSI is removed', () => {
    expect(countWrappedLines('\u001B[36mabcdef\u001B[39m', 3)).toBe(2);
  });

  it('counts streaming text height across markdown and plain parts', () => {
    expect(
      getStreamingTextHeight(
        [
          { type: 'markdown', content: 'Use **bold**' },
          { type: 'plain', content: 'tail' },
        ],
        20,
      ),
    ).toBe(2);
  });

  it('accounts for code block chrome in height', () => {
    expect(getCodeBlockHeight('const x = 1;', 20)).toBe(5);
  });

  it('derives assistant content width from terminal columns', () => {
    expect(getAssistantContentWidth(40)).toBe(36);
  });
});
