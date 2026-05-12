import { Box, Text } from 'ink';
import { useMemo, useState } from 'react';

import type { SessionMetadata } from '../utils/session';
import { SelectPrompt, SelectPromptHint } from './SelectPrompt';

/* v8 ignore start */

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
            value: `delete:${session.id}`,
          })),
        { label: 'Back', value: 'back' },
      ];
    }

    return [
      { label: 'Start new session', value: 'new' },
      ...sessions.map((session) => ({
        label: `${session.id === currentSessionId ? 'Current: ' : ''}${formatSessionLabel(session)}`,
        value: `open:${session.id}`,
      })),
      { label: 'Delete a saved session', value: 'delete-menu' },
      { label: 'Close', value: 'close' },
    ];
  }, [currentSessionId, sessions, view]);

  const handleChange = (value: string) => {
    if (value === 'close') {
      onClose();
      return;
    }

    if (value === 'new') {
      onNew();
      return;
    }

    if (value === 'delete-menu') {
      setView(VIEW.DELETE);
      return;
    }

    if (value === 'back') {
      setView(VIEW.MAIN);
      return;
    }

    if (value.startsWith('delete:')) {
      onDelete(value.slice('delete:'.length));
      return;
    }

    if (value.startsWith('open:')) {
      onOpen(value.slice('open:'.length));
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
/* v8 ignore stop */
