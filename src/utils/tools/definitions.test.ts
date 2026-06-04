import { READ_TOOLS, TOOLS, WRITE_TOOLS } from './definitions';

describe('definitions', () => {
  describe('TOOLS', () => {
    it('exports tool definitions', () => {
      expect(TOOLS).toHaveLength(12);
      expect(TOOLS.map((t) => t.function.name)).toContain('read_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('write_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('edit_file');
      expect(TOOLS.map((t) => t.function.name)).toContain('create_directory');
      expect(TOOLS.map((t) => t.function.name)).toContain('rename_path');
      expect(TOOLS.map((t) => t.function.name)).toContain('delete_path');
      expect(TOOLS.map((t) => t.function.name)).toContain('run_shell');
      expect(TOOLS.map((t) => t.function.name)).toContain('list_dir');
      expect(TOOLS.map((t) => t.function.name)).toContain('find_files');
      expect(TOOLS.map((t) => t.function.name)).toContain('grep_search');
      expect(TOOLS.map((t) => t.function.name)).toContain('web_search');
      expect(TOOLS.map((t) => t.function.name)).toContain('web_fetch');
    });
  });

  describe('WRITE_TOOLS', () => {
    it('contains write_file, edit_file, create_directory, rename_path, delete_path, and run_shell', () => {
      expect(WRITE_TOOLS.has('write_file')).toBe(true);
      expect(WRITE_TOOLS.has('edit_file')).toBe(true);
      expect(WRITE_TOOLS.has('create_directory')).toBe(true);
      expect(WRITE_TOOLS.has('rename_path')).toBe(true);
      expect(WRITE_TOOLS.has('delete_path')).toBe(true);
      expect(WRITE_TOOLS.has('run_shell')).toBe(true);
      expect(WRITE_TOOLS.has('read_file')).toBe(false);
    });
  });

  describe('READ_TOOLS', () => {
    it('contains find_files and web_search', () => {
      expect(READ_TOOLS.has('find_files')).toBe(true);
      expect(READ_TOOLS.has('web_search')).toBe(true);
      expect(READ_TOOLS.has('write_file')).toBe(false);
    });
  });
});
