import { Text, useStdout } from 'ink';
import { render } from 'ink-testing-library';
import { useState } from 'react';

import { SessionManager } from './SessionManager';

const { mockColumns, selectionState } = vi.hoisted(() => ({
  mockColumns: {
    value: 100,
  },
  selectionState: {
    instanceId: '',
    mountCount: 0,
    onCancel: null as (() => void) | null,
    onChange: null as ((value: string) => void) | null,
    options: [] as { label: string; value: string }[],
  },
}));

const sessions = vi.hoisted(() => [
  {
    id: 'session-1',
    createdAt: '2026-05-11T00:00:00.000Z',
    updatedAt: '2026-05-11T00:00:00.000Z',
    title: 'First session',
    model: 'gemma4',
  },
  {
    id: 'session-2',
    createdAt: '2026-05-11T00:00:01.000Z',
    updatedAt: '2026-05-11T00:00:01.000Z',
    title: 'Second session',
    model: 'llama3',
  },
]);

vi.mock('ink', async () => ({
  ...(await vi.importActual('ink')),
  useStdout: vi.fn(() => ({
    stdout: {
      columns: mockColumns.value,
    },
  })),
}));

vi.mock('./SelectPrompt', () => ({
  SelectPrompt: ({
    onCancel,
    onChange,
    options,
  }: {
    onCancel?: () => void;
    onChange?: (value: string) => void;
    options: { label: string; value: string }[];
  }) => {
    const [instanceId] = useState(() => {
      selectionState.mountCount += 1;
      return `instance-${String(selectionState.mountCount)}`;
    });

    selectionState.instanceId = instanceId;
    selectionState.onCancel = onCancel ?? null;
    selectionState.onChange = onChange ?? null;
    selectionState.options = options;
    return (
      <>
        <Text>{instanceId}</Text>
        {options.map(({ label, value }) => (
          <Text key={value}>{label}</Text>
        ))}
      </>
    );
  },

  SelectPromptHint: ({ message }: { message?: string }) => (
    <Text>{message}</Text>
  ),
}));

vi.mock('@/utils/session', () => ({
  listSessions: () => sessions,
}));

describe('SessionManager', () => {
  beforeEach(() => {
    mockColumns.value = 100;
    vi.mocked(useStdout).mockClear();
    selectionState.instanceId = '';
    selectionState.mountCount = 0;
    selectionState.onCancel = null;
    selectionState.onChange = null;
    selectionState.options = [];
    sessions.splice(
      0,
      sessions.length,
      {
        id: 'session-1',
        createdAt: '2026-05-11T00:00:00.000Z',
        updatedAt: '2026-05-11T00:00:00.000Z',
        title: 'First session',
        model: 'gemma4',
      },
      {
        id: 'session-2',
        createdAt: '2026-05-11T00:00:01.000Z',
        updatedAt: '2026-05-11T00:00:01.000Z',
        title: 'Second session',
        model: 'llama3',
      },
    );
  });

  it('truncates long session labels to the available width', () => {
    mockColumns.value = 36;
    sessions[1] = {
      ...sessions[1],
      title:
        'testing a really long input with a lot of words, writing stuff just to fill space',
    };

    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { lastFrame, rerender } = render(sessionManager);

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);

    expect(lastFrame()).toContain('…');
    expect(lastFrame()).not.toContain('fill space');
  });

  it('handles extremely narrow terminal by truncating entire label', () => {
    mockColumns.value = 5;

    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { lastFrame, rerender } = render(sessionManager);

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);

    expect(lastFrame()).toContain('…');
  });

  it('renders the main session actions', () => {
    const { lastFrame } = render(
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Sessions');
    expect(lastFrame()).toContain('Select session');
    expect(lastFrame()).toContain('Open session');
    expect(lastFrame()).toContain('Delete session');
    expect(lastFrame()).not.toContain('Current: First session');
    expect(lastFrame()).not.toContain('Second session');
  });

  it('shows an error when onOpen throws', () => {
    const onOpen = vi.fn().mockImplementation(() => {
      throw new Error('Session not found');
    });
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={onOpen}
      />
    );
    const { lastFrame, rerender } = render(sessionManager);

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);
    selectionState.onChange?.('open:session-2');
    rerender(sessionManager);

    expect(lastFrame()).toContain('Session not found');
  });

  it('shows an error when onDelete throws', () => {
    const onDelete = vi.fn().mockImplementation(() => {
      throw new Error('Failed to delete');
    });
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={onDelete}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { lastFrame, rerender } = render(sessionManager);

    selectionState.onChange?.('delete-menu');
    rerender(sessionManager);
    selectionState.onChange?.('delete:session-2');
    rerender(sessionManager);

    expect(lastFrame()).toContain('Failed to delete');
  });

  it('falls back to a generic message when onOpen throws a non-Error', () => {
    const onOpen = vi.fn().mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'boom';
    });
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={onOpen}
      />
    );
    const { lastFrame, rerender } = render(sessionManager);

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);
    selectionState.onChange?.('open:session-2');
    rerender(sessionManager);

    expect(lastFrame()).toContain('Failed to open session');
  });

  it('falls back to a generic message when onDelete throws a non-Error', () => {
    const onDelete = vi.fn().mockImplementation(() => {
      // eslint-disable-next-line @typescript-eslint/only-throw-error
      throw 'boom';
    });
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={onDelete}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { lastFrame, rerender } = render(sessionManager);

    selectionState.onChange?.('delete-menu');
    rerender(sessionManager);
    selectionState.onChange?.('delete:session-2');
    rerender(sessionManager);

    expect(lastFrame()).toContain('Failed to delete session');
  });

  it('opens the selected session', () => {
    const onOpen = vi.fn();
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={onOpen}
      />
    );
    const { rerender } = render(sessionManager);

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);
    selectionState.onChange?.('open:session-2');

    expect(onOpen).toHaveBeenCalledWith('session-2');
  });

  it('creates a new session when requested', () => {
    const onNew = vi.fn();
    render(
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={onNew}
        onOpen={vi.fn()}
      />,
    );

    selectionState.onChange?.('new');

    expect(onNew).toHaveBeenCalledOnce();
  });

  it('closes when the close option or cancel is selected', () => {
    const onClose = vi.fn();
    render(
      <SessionManager
        currentSessionId="session-1"
        onClose={onClose}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    selectionState.onChange?.('close');
    selectionState.onCancel?.();

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('includes the open-menu and delete-menu options', () => {
    render(
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(selectionState.options.map(({ value }) => value)).toContain(
      'open-menu',
    );
    expect(selectionState.options.map(({ value }) => value)).toContain(
      'delete-menu',
    );
  });

  it('shows sessions in open mode', () => {
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { lastFrame, rerender } = render(sessionManager);

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);

    expect(lastFrame()).toContain('Open session');
    expect(lastFrame()).toContain('Second session');
    expect(lastFrame()).not.toContain('Current: First session');
    expect(selectionState.options.map(({ value }) => value)).toContain(
      'open:session-2',
    );
    expect(selectionState.options.map(({ value }) => value)).not.toContain(
      'open:session-1',
    );
    expect(selectionState.options.map(({ value }) => value)).toContain('back');
  });

  it('deletes the selected session in delete mode', () => {
    const onDelete = vi.fn();
    render(
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={onDelete}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    selectionState.onChange?.('delete-menu');
    selectionState.onChange?.('delete:session-2');

    expect(onDelete).toHaveBeenCalledWith('session-2');
  });

  it('removes a deleted session from the delete options', () => {
    const onDelete = vi.fn((sessionId: string) => {
      const index = sessions.findIndex(({ id }) => id === sessionId);
      if (index >= 0) {
        sessions.splice(index, 1);
      }
    });
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={onDelete}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { rerender } = render(sessionManager);

    selectionState.onChange?.('delete-menu');
    rerender(sessionManager);
    expect(selectionState.options.map(({ value }) => value)).toContain(
      'delete:session-2',
    );

    selectionState.onChange?.('delete:session-2');
    rerender(sessionManager);

    expect(selectionState.options.map(({ value }) => value)).not.toContain(
      'delete:session-2',
    );
  });

  it('returns to main view when back is selected in delete mode', () => {
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { rerender } = render(sessionManager);

    selectionState.onChange?.('delete-menu');
    rerender(sessionManager);
    expect(selectionState.options.map(({ value }) => value)).toContain('back');

    selectionState.onChange?.('back');
    rerender(sessionManager);
    expect(selectionState.options.map(({ value }) => value)).toContain(
      'delete-menu',
    );
  });

  it('returns to main view when back is selected in open mode', () => {
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { rerender } = render(sessionManager);

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);
    expect(selectionState.options.map(({ value }) => value)).toContain('back');

    selectionState.onChange?.('back');
    rerender(sessionManager);
    expect(selectionState.options.map(({ value }) => value)).toContain(
      'open-menu',
    );
  });

  it('remounts the select prompt when switching between main, open, and delete views', () => {
    const sessionManager = (
      <SessionManager
        currentSessionId="session-1"
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />
    );
    const { rerender } = render(sessionManager);

    const mainInstanceId = selectionState.instanceId;

    selectionState.onChange?.('open-menu');
    rerender(sessionManager);
    const openInstanceId = selectionState.instanceId;

    selectionState.onChange?.('back');
    rerender(sessionManager);
    const nextMainInstanceId = selectionState.instanceId;

    selectionState.onChange?.('delete-menu');
    rerender(sessionManager);
    const deleteInstanceId = selectionState.instanceId;

    expect(openInstanceId).not.toBe(mainInstanceId);
    expect(nextMainInstanceId).not.toBe(openInstanceId);
    expect(deleteInstanceId).not.toBe(mainInstanceId);
    expect(nextMainInstanceId).not.toBe(deleteInstanceId);
  });
});
