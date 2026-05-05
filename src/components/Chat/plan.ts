export function hasExecutablePlan(content: string): boolean {
  return content.split('\n').some((line) => {
    const trimmedLine = line.trim();
    return /^- \[ \] (write_file|edit_file|run_shell)\(/.test(trimmedLine);
  });
}
