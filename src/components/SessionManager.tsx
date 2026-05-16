import { Box, Text, useStdout } from 'ink';
import { useCallback, useState } from 'react';

import { THEME, UI } from '@/constants';
import type { ThemeDefinition } from '@/types';
import { listSessions, type SessionMetadata } from '@/utils/session';

import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

interface Props {
  currentSessionId: string;
  onClose: () => void;
  onDelete: (sessionId: string) => void;
  onNew: () => void;
  onOpen: (sessionId: string) => void;
  theme?: ThemeDefinition;
}

enum VIEW {
  MAIN = 'main',
  OPEN = 'open',
  DELETE = 'delete',
}

const ACTION = {
  BACK: 'back',
  CLOSE: 'close',
  DELETE_MENU: 'delete-menu',
  DELETE_PREFIX: 'delete:',
  NEW: 'new',
  OPEN_MENU: 'open-menu',
  OPEN_PREFIX: 'open:',
} as const;

const SESSION_LABEL_PADDING = 4;

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 1).trimEnd()}${UI.ELLIPSIS}`
    : value;
}

function formatSessionLabel(
  session: SessionMetadata,
  maxWidth: number,
  prefix = '',
): string {
  const timestamp = new Date(session.updatedAt).toLocaleString();
  const suffix = ` (${timestamp})`;
  const availableTitleWidth = maxWidth - prefix.length - suffix.length;

  if (availableTitleWidth < 1) {
    return truncate(`${prefix}${session.title}${suffix}`, maxWidth);
  }

  return `${prefix}${truncate(session.title, availableTitleWidth)}${suffix}`;
}

export function SessionManager({
  currentSessionId,
  onClose,
  onDelete,
  onNew,
  onOpen,
  theme = THEME.getTheme(),
}: Props) {
  const [view, setView] = useState<VIEW>(VIEW.MAIN);
  const [error, setError] = useState<string>();
  const [, refreshSessionList] = useState(0);
  const { stdout } = useStdout();

  const sessions = listSessions();
  const maxLabelWidth = Math.max(1, stdout.columns - SESSION_LABEL_PADDING);
  const options =
    view === VIEW.OPEN
      ? [
          ...sessions
            .filter(({ id }) => id !== currentSessionId)
            .map((session) => ({
              label: formatSessionLabel(session, maxLabelWidth),
              value: `${ACTION.OPEN_PREFIX}${session.id}`,
            })),
          { label: 'Back', value: ACTION.BACK },
        ]
      : view === VIEW.DELETE
        ? [
            ...sessions
              .filter(({ id }) => id !== currentSessionId)
              .map((session) => ({
                label: formatSessionLabel(session, maxLabelWidth, 'Delete '),
                value: `${ACTION.DELETE_PREFIX}${session.id}`,
              })),
            { label: 'Back', value: ACTION.BACK },
          ]
        : [
            { label: 'New session', value: ACTION.NEW },
            { label: 'Open session', value: ACTION.OPEN_MENU },
            { label: 'Delete session', value: ACTION.DELETE_MENU },
            { label: 'Close', value: ACTION.CLOSE },
          ];

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
          setView(VIEW.DELETE);
          break;

        case value === ACTION.OPEN_MENU:
          setView(VIEW.OPEN);
          break;

        case value === ACTION.BACK:
          setView(VIEW.MAIN);
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
          view === VIEW.DELETE
            ? 'Delete session'
            : view === VIEW.OPEN
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
        key={`${view}:${String(sessions.length)}`}
        options={options}
        onCancel={onClose}
        onChange={handleChange}
      />
    </Box>
  );
}
