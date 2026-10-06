import { useStdout } from 'ink';

const DEFAULT_COLUMNS = 80;

interface StreamWithColumns {
  columns?: number;
}

/**
 * Returns the terminal width, falling back to 80 columns when the stream does
 * not report a usable width (for example when stdout is piped).
 *
 * `useStdout().stdout` is typed as `NodeJS.WritableStream`, which does not
 * declare `columns`, so the stream is narrowed to read the property.
 */
export function useTerminalColumns(): number {
  const { stdout } = useStdout();
  const { columns } = stdout as StreamWithColumns;

  return typeof columns === 'number' && columns > 0 ? columns : DEFAULT_COLUMNS;
}
