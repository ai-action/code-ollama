import { splitStreamingInlineContent } from './streaming';

describe('splitStreamingInlineContent', () => {
  it('keeps complete inline code as markdown', () => {
    expect(splitStreamingInlineContent('Run `npm test` now')).toEqual([
      { type: 'markdown', content: 'Run `npm test` now' },
    ]);
  });

  it('hides the opening backtick for incomplete inline code', () => {
    expect(splitStreamingInlineContent('Run `npm test')).toEqual([
      { type: 'markdown', content: 'Run ' },
      { type: 'plain', content: 'npm test' },
    ]);
  });

  it('keeps complete bold as markdown', () => {
    expect(splitStreamingInlineContent('Use **bold** text')).toEqual([
      { type: 'markdown', content: 'Use **bold** text' },
    ]);
  });

  it('keeps complete inline latex as markdown', () => {
    expect(splitStreamingInlineContent('Math $x^2$ done')).toEqual([
      { type: 'markdown', content: 'Math $x^2$ done' },
    ]);
  });

  it('hides the opening strong delimiter for incomplete bold', () => {
    expect(splitStreamingInlineContent('Use **bold')).toEqual([
      { type: 'markdown', content: 'Use ' },
      { type: 'plain', content: 'bold' },
    ]);
  });

  it('hides the opening delimiter for incomplete italic', () => {
    expect(splitStreamingInlineContent('Use *italic')).toEqual([
      { type: 'markdown', content: 'Use ' },
      { type: 'plain', content: 'italic' },
    ]);
  });

  it('keeps complete italic as markdown', () => {
    expect(splitStreamingInlineContent('Use *italic* text')).toEqual([
      { type: 'markdown', content: 'Use *italic* text' },
    ]);
  });

  it('keeps underscores inside identifiers literal', () => {
    expect(
      splitStreamingInlineContent('def _private_python_fun() -> None:'),
    ).toEqual([
      { type: 'markdown', content: 'def _private_python_fun() -> None:' },
    ]);
  });

  it('does not treat underscore emphasis as a streaming delimiter', () => {
    expect(splitStreamingInlineContent('Use _italic')).toEqual([
      { type: 'markdown', content: 'Use _italic' },
    ]);
  });

  it('hides the opening delimiter for incomplete inline latex', () => {
    expect(splitStreamingInlineContent('Math $x^2 + y')).toEqual([
      { type: 'markdown', content: 'Math ' },
      { type: 'plain', content: 'x^2 + y' },
    ]);
  });

  it('preserves the stable prefix before an incomplete suffix', () => {
    expect(splitStreamingInlineContent('Done `code` then **bold')).toEqual([
      { type: 'markdown', content: 'Done `code` then ' },
      { type: 'plain', content: 'bold' },
    ]);
  });

  it('keeps later lines renderable after an incomplete inline delimiter', () => {
    expect(
      splitStreamingInlineContent('## Plan\n\n1. **Inspect\n2. Continue'),
    ).toEqual([
      { type: 'markdown', content: '## Plan\n\n1. ' },
      { type: 'plain', content: 'Inspect' },
      { type: 'markdown', content: '\n2. Continue' },
    ]);
  });

  it('keeps plain text unchanged when there are no delimiters', () => {
    expect(splitStreamingInlineContent('Just plain text')).toEqual([
      { type: 'markdown', content: 'Just plain text' },
    ]);
  });

  it('ignores a trailing emphasis opener without content', () => {
    expect(splitStreamingInlineContent('Wait *')).toEqual([
      { type: 'markdown', content: 'Wait *' },
    ]);
  });

  it('ignores escaped delimiters', () => {
    const content = 'Show \\`code';
    expect(splitStreamingInlineContent(content)).toEqual([
      { type: 'markdown', content },
    ]);
  });

  it('does not close emphasis when the previous character is whitespace', () => {
    expect(splitStreamingInlineContent('*a *')).toEqual([
      { type: 'plain', content: 'a *' },
    ]);
  });

  it('returns no visible suffix when only an opener has streamed', () => {
    expect(splitStreamingInlineContent('`')).toEqual([]);
  });
});
