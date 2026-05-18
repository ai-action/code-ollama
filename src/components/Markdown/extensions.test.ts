import { inlineMathExtension } from './extensions';

describe('extensions', () => {
  describe('inlineMathExtension', () => {
    it('has correct name and level', () => {
      expect(inlineMathExtension.name).toBe('inlineMath');
      expect(inlineMathExtension.level).toBe('inline');
    });

    describe('start', () => {
      it('returns index of $ in string', () => {
        expect(inlineMathExtension.start('hello $world')).toBe(6);
      });

      it('returns -1 when no $ found', () => {
        expect(inlineMathExtension.start('hello world')).toBe(-1);
      });
    });

    describe('tokenizer', () => {
      it('tokenizes inline math with $...$', () => {
        const result = inlineMathExtension.tokenizer('$x^2$');
        expect(result).toEqual({
          type: 'inlineMath',
          raw: '$x^2$',
          math: 'x^2',
        });
      });

      it('returns undefined for invalid math pattern', () => {
        expect(inlineMathExtension.tokenizer('$x^2')).toBeUndefined();
        expect(inlineMathExtension.tokenizer('$$')).toBeUndefined();
        expect(inlineMathExtension.tokenizer('plain text')).toBeUndefined();
      });

      it('does not tokenize multiline math', () => {
        expect(inlineMathExtension.tokenizer('$x\ny$')).toBeUndefined();
      });
    });

    describe('renderer', () => {
      it('renders simple math', () => {
        const token = { math: 'x' } as unknown as Parameters<
          typeof inlineMathExtension.renderer
        >[0];
        expect(inlineMathExtension.renderer(token)).toBe('x');
      });

      it('renders LaTeX commands as unicode', () => {
        const token = { math: '\\rightarrow' } as unknown as Parameters<
          typeof inlineMathExtension.renderer
        >[0];
        expect(inlineMathExtension.renderer(token)).toBe('→');
      });

      it('handles empty math', () => {
        const token = {} as Parameters<typeof inlineMathExtension.renderer>[0];
        expect(inlineMathExtension.renderer(token)).toBe('');
      });
    });
  });
});
