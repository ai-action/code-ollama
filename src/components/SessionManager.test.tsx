import { Text } from 'ink';
import { render } from 'ink-testing-library';

const selectionState = vi.hoisted(() => ({
  onCancel: null as (() => void) | null,
  onChange: null as ((value: string) => void) | null,
  options: [] as { label: string; value: string }[],
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
    selectionState.onCancel = onCancel ?? null;
    selectionState.onChange = onChange ?? null;
    selectionState.options = options;
    return (
      <>
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

import { SessionManager } from './SessionManager';

const sessions = [
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
];

describe('SessionManager', () => {
  beforeEach(() => {
    selectionState.onCancel = null;
    selectionState.onChange = null;
    selectionState.options = [];
  });

  it('renders the current session, other sessions, and management actions', () => {
    const { lastFrame } = render(
      <SessionManager
        currentSessionId="session-1"
        sessions={sessions}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Sessions');
    expect(lastFrame()).toContain('Select session');
    expect(lastFrame()).toContain('Current: First session');
    expect(lastFrame()).toContain('Second session');
    expect(lastFrame()).toContain('Delete a saved session');
  });

  it('shows the provided error message', () => {
    const { lastFrame } = render(
      <SessionManager
        currentSessionId="session-1"
        error="Session not found"
        sessions={sessions}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain('Session not found');
  });

  it('opens the selected session', () => {
    const onOpen = vi.fn();
    render(
      <SessionManager
        currentSessionId="session-1"
        sessions={sessions}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={onOpen}
      />,
    );

    selectionState.onChange?.('open:session-2');

    expect(onOpen).toHaveBeenCalledWith('session-2');
  });

  it('creates a new session when requested', () => {
    const onNew = vi.fn();
    render(
      <SessionManager
        currentSessionId="session-1"
        sessions={sessions}
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
        sessions={sessions}
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

  it('includes the delete-menu option', () => {
    render(
      <SessionManager
        currentSessionId="session-1"
        sessions={sessions}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onNew={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(selectionState.options.map(({ value }) => value)).toContain(
      'delete-menu',
    );
  });

  it('deletes the selected session in delete mode', () => {
    const onDelete = vi.fn();
    render(
      <SessionManager
        currentSessionId="session-1"
        sessions={sessions}
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
});
