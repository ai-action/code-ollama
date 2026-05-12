import { Box, Text } from 'ink';
import { useMemo, useState } from 'react';

import type { SessionMetadata } from '../utils/session';
import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

interface Props {
  currentSessionId: string;
  error?: string;
  sessions: SessionMetadata[];
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
  error,
  sessions,
  onClose,
  onDelete,
  onNew,
  onOpen,
}: Props) {
  const [view, setView] = useState<VIEW>(VIEW.MAIN);

  const options = useMemo(() => {
    if (view === VIEW.DELETE) {
      return [
        ...sessions
          .filter(({ id }) => id !== currentSessionId)
          .map((session) => ({
            label: `Delete ${formatSessionLabel(session)}`,
            value: `${ACTION.DELETE_PREFIX}${session.id}`,
          })),
        { label: 'Back', value: ACTION.BACK },
      ];
    }

    return [
      { label: 'Start new session', value: ACTION.NEW },
      ...sessions.map((session) => ({
        label: `${session.id === currentSessionId ? 'Current: ' : ''}${formatSessionLabel(session)}`,
        value: `${ACTION.OPEN_PREFIX}${session.id}`,
      })),
      { label: 'Delete a session', value: ACTION.DELETE_MENU },
      { label: 'Close', value: ACTION.CLOSE },
    ];
  }, [currentSessionId, sessions, view]);

  const handleChange = (value: string) => {
    if (value === ACTION.CLOSE) {
      onClose();
      return;
    }

    if (value === ACTION.NEW) {
      onNew();
      return;
    }

    if (value === ACTION.DELETE_MENU) {
      setView(VIEW.DELETE);
      return;
    }

    if (value === ACTION.BACK) {
      setView(VIEW.MAIN);
      return;
    }

    if (value.startsWith(ACTION.DELETE_PREFIX)) {
      onDelete(value.slice(ACTION.DELETE_PREFIX.length));
      return;
    }

    // v8 ignore next
    if (value.startsWith(ACTION.OPEN_PREFIX)) {
      onOpen(value.slice(ACTION.OPEN_PREFIX.length));
    }
  };

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
        options={options}
        onCancel={onClose}
        onChange={handleChange}
      />
    </Box>
  );
}
