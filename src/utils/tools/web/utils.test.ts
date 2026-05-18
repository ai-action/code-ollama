import { UI } from '@/constants';

import { cleanText, decodeHtml, stripTags, truncate } from './utils';

describe('utils', () => {
  describe('stripTags', () => {
    it('removes HTML tags from a string', () => {
      expect(stripTags('<p>Hello <b>world</b></p>')).toBe(' Hello  world  ');
    });

    it('replaces tags with spaces', () => {
      expect(stripTags('a<br>b')).toBe('a b');
    });

    it('handles empty strings', () => {
      expect(stripTags('')).toBe('');
    });

    it('handles strings without tags', () => {
      expect(stripTags('plain text')).toBe('plain text');
    });
  });

  describe('decodeHtml', () => {
    it('decodes HTML entities', () => {
      expect(decodeHtml('&lt;div&gt;')).toBe('<div>');
      expect(decodeHtml('&quot;test&quot;')).toBe('"test"');
      expect(decodeHtml('&#39;quote&#39;')).toBe("'quote'");
      expect(decodeHtml('&amp;amp;')).toBe('&amp;');
    });

    it('decodes multiple entities', () => {
      expect(decodeHtml('&lt;div class=&quot;test&quot;&gt;')).toBe(
        '<div class="test">',
      );
    });

    it('handles empty strings', () => {
      expect(decodeHtml('')).toBe('');
    });

    it('handles strings without entities', () => {
      expect(decodeHtml('plain text')).toBe('plain text');
    });
  });

  describe('cleanText', () => {
    it('collapses multiple whitespace characters', () => {
      expect(cleanText('hello   world\t\t\ntest')).toBe('hello world test');
    });

    it('trims leading and trailing whitespace', () => {
      expect(cleanText('  hello world  ')).toBe('hello world');
    });

    it('handles empty strings', () => {
      expect(cleanText('')).toBe('');
    });

    it('handles whitespace-only strings', () => {
      expect(cleanText('   \t\n  ')).toBe('');
    });
  });

  describe('truncate', () => {
    it('returns original string if under max length', () => {
      expect(truncate('hello', 10)).toBe('hello');
    });

    it('truncates string over max length', () => {
      expect(truncate('hello world', 8)).toBe(`hello w${UI.ELLIPSIS}`);
    });

    it('handles empty strings', () => {
      expect(truncate('', 10)).toBe('');
    });

    it('handles exact length strings', () => {
      expect(truncate('hello', 5)).toBe('hello');
    });
  });
});
