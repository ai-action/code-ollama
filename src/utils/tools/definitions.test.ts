import { READ_TOOLS, TOOLS, WRITE_TOOLS } from './definitions';

describe('definitions', () => {
  describe('TOOLS', () => {
    it('exports tool definitions', () => {
      expect(TOOLS).toHaveLength(8);
      expect(TOOLS.map((t) => t.function.name)).toContain('read_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('write_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('edit_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('run_shell');
      expect(TOOLS.map((t) => t.function.name)).toContain('list_dir');
      expect(TOOLS.map((t) => t.function.name)).toContain('grep_search');
      expect(TOOLS.map((t) => t.function.name)).toContain('view_range');
      expect(TOOLS.map((t) => t.function.name)).toContain('web_search');
    });
  });

  describe('WRITE_TOOLS', () => {
    it('contains write_file, edit_file, and run_shell', () => {
      expect(WRITE_TOOLS.has('write_file')).toBe(true);
      expect(WRITE_TOOLS.has('edit_file')).toBe(true);
      expect(WRITE_TOOLS.has('run_shell')).toBe(true);
      expect(WRITE_TOOLS.has('read_file')).toBe(false);
    });
  });

  describe('READ_TOOLS', () => {
    it('contains web_search', () => {
      expect(READ_TOOLS.has('web_search')).toBe(true);
      expect(READ_TOOLS.has('write_file')).toBe(false);
    });
  });
});
