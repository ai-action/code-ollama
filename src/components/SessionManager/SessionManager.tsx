import { Box, Text, useStdout } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import { OPTION, UI } from '@/constants';
import { useTheme } from '@/contexts';
import { listSessions, type SessionMetadata } from '@/utils/session';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';

interface Props {
  currentSessionId: string;
  onClose: () => void;
  onDelete: (sessionId: string) => void;
  onNew: () => void;
  onOpen: (sessionId: string) => void;
}

enum View {
  Main = 'main',
  Open = 'open',
  Delete = 'delete',
}

const ACTION = {
  CLOSE: 'close',
  DELETE_MENU: 'delete-menu',
  DELETE_PREFIX: 'delete:',
  NEW: 'new',
  OPEN_MENU: 'open-menu',
  OPEN_PREFIX: 'open:',
} as const;

const SESSION_OPTION_CHROME =
  UI.SCREEN_MARGIN_X * 2 + // marginX on both sides
  4; // select pointer and spacing
const MAIN_OPTIONS = [
  { label: 'New session', value: ACTION.NEW },
  { label: 'Open session', value: ACTION.OPEN_MENU },
  { label: 'Delete session', value: ACTION.DELETE_MENU },
  { label: 'Close', value: ACTION.CLOSE },
];

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trimEnd()}${UI.ELLIPSIS}`
    : value;
}

function formatSessionLabel(
  session: SessionMetadata,
  maxWidth: number,
): string {
  const timestamp = new Date(session.updatedAt).toLocaleString();
  const suffix = ` (${timestamp})`;
  const availableTitleWidth = maxWidth - suffix.length;

  if (availableTitleWidth < 1) {
    return truncate(`${session.title}${suffix}`, maxWidth);
  }

  return `${truncate(session.title, availableTitleWidth)}${suffix}`;
}

export function SessionManager({
  currentSessionId,
  onClose,
  onDelete,
  onNew,
  onOpen,
}: Props) {
  const theme = useTheme();
  const [view, setView] = useState<View>(View.Main);
  const [error, setError] = useState<string>();
  const [sessionListVersion, refreshSessionList] = useState(0);
  const { stdout } = useStdout();

  const sessions = listSessions();
  const maxLabelWidth = Math.max(1, stdout.columns - SESSION_OPTION_CHROME);
  const options = useMemo(() => {
    switch (view) {
      case View.Open:
        return [
          ...sessions
            .filter(({ id }) => id !== currentSessionId)
            .map((session) => ({
              label: formatSessionLabel(session, maxLabelWidth),
              value: `${ACTION.OPEN_PREFIX}${session.id}`,
            })),
          OPTION.BACK,
        ];

      case View.Delete:
        return [
          ...sessions
            .filter(({ id }) => id !== currentSessionId)
            .map((session) => ({
              label: formatSessionLabel(session, maxLabelWidth),
              value: `${ACTION.DELETE_PREFIX}${session.id}`,
            })),
          OPTION.BACK,
        ];

      case View.Main:
      default:
        return MAIN_OPTIONS;
    }
  }, [currentSessionId, maxLabelWidth, sessionListVersion, sessions, view]);

  const handleChange = useCallback(
    (value: string) => {
      switch (true) {
        case value === ACTION.CLOSE:
          onClose();
          break;

        case value === ACTION.NEW:
          onNew();
          break;

        case value === ACTION.DELETE_MENU:
          setView(View.Delete);
          break;

        case value === ACTION.OPEN_MENU:
          setView(View.Open);
          break;

        case value === OPTION.BACK.value:
          setView(View.Main);
          break;

        case value.startsWith(ACTION.DELETE_PREFIX): {
          try {
            onDelete(value.slice(ACTION.DELETE_PREFIX.length));
            setError(undefined);
            refreshSessionList((key) => key + 1);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : 'Failed to delete session',
            );
          }
          break;
        }

        case value.startsWith(ACTION.OPEN_PREFIX): {
          try {
            onOpen(value.slice(ACTION.OPEN_PREFIX.length));
            setError(undefined);
          } catch (error) {
            setError(
              error instanceof Error ? error.message : 'Failed to open session',
            );
          }
          break;
        }
      }
    },
    [onClose, onDelete, onNew, onOpen],
  );

  return (
    <Box flexDirection="column">
      <Text>Sessions</Text>
      <SelectPromptHint
        message={
          view === View.Delete
            ? 'Delete session'
            : view === View.Open
              ? 'Open session'
              : 'Select session'
        }
      />

      {error && (
        <Box marginBottom={1}>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}

      <SelectPrompt
        options={options}
        onCancel={onClose}
        onChange={handleChange}
      />
    </Box>
  );
}
