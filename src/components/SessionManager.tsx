import { Box, Text } from 'ink';
import { useCallback, useState } from 'react';

import { listSessions, type SessionMetadata } from '../utils/session';
import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

interface Props {
  currentSessionId: string;
  onClose: () => void;
  onDelete: (sessionId: string) => void;
  onNew: () => void;
  onOpen: (sessionId: string) => void;
}

enum VIEW {
  MAIN = 'main',
  DELETE = 'delete',
}

const ACTION = {
  BACK: 'back',
  CLOSE: 'close',
  DELETE_MENU: 'delete-menu',
  DELETE_PREFIX: 'delete:',
  NEW: 'new',
  OPEN_PREFIX: 'open:',
} as const;

function formatSessionLabel(session: SessionMetadata): string {
  const timestamp = new Date(session.updatedAt).toLocaleString();
  return `${session.title} (${timestamp})`;
}

export function SessionManager({
  currentSessionId,
  onClose,
  onDelete,
  onNew,
  onOpen,
}: Props) {
  const [view, setView] = useState<VIEW>(VIEW.MAIN);
  const [error, setError] = useState<string>();
  const [, refreshSessionList] = useState(0);

  const sessions = listSessions();
  const options =
    view === VIEW.DELETE
      ? [
          ...sessions
            .filter(({ id }) => id !== currentSessionId)
            .map((session) => ({
              label: `Delete ${formatSessionLabel(session)}`,
              value: `${ACTION.DELETE_PREFIX}${session.id}`,
            })),
          { label: 'Back', value: ACTION.BACK },
        ]
      : [
          { label: 'Start new session', value: ACTION.NEW },
          ...sessions.map((session) => ({
            label: `${session.id === currentSessionId ? 'Current: ' : ''}${formatSessionLabel(session)}`,
            value: `${ACTION.OPEN_PREFIX}${session.id}`,
          })),
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
        message={view === VIEW.DELETE ? 'Delete session' : 'Select session'}
      />

      {error && (
        <Box marginBottom={1}>
          <Text color="red">{error}</Text>
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
