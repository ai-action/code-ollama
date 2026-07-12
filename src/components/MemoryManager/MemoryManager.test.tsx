import { Text } from 'ink';

import { KEY } from '@/constants';
import { time } from '@/utils';
import { renderWithTheme } from '@/utils/testing';

interface MockSelectPromptProps {
  children?: React.ReactNode;
  onCancel?: () => void;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
}

interface MockTextInputProps {
  allowMultilinePaste?: boolean;
  isDisabled?: boolean;
  multiline?: boolean;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  value: string;
  wrapIndent?: number;
}

const {
  deleteMemory,
  getMemoryDetails,
  mockSelectPrompt,
  mockTextInput,
  resetSystemMessage,
  saveMemory,
} = vi.hoisted(() => ({
  deleteMemory: vi.fn(),
  getMemoryDetails: vi.fn(),
  mockSelectPrompt: vi.fn<(props: MockSelectPromptProps) => void>(),
  mockTextInput: vi.fn<(props: MockTextInputProps) => void>(),
  resetSystemMessage: vi.fn(),
  saveMemory: vi.fn(),
}));

vi.mock('@inkjs/ui', () => ({
  Spinner: ({ label }: { label: string }) => <Text>{label}</Text>,
}));

vi.mock('@/utils', async () => ({
  ...(await vi.importActual('@/utils')),
  agents: { resetSystemMessage },
  memory: { deleteMemory, getMemoryDetails, saveMemory },
}));

vi.mock('../SelectPrompt', () => ({
  SelectPrompt: (props: MockSelectPromptProps) => {
    mockSelectPrompt(props);
    return (
      <>
        {props.children}
        {props.options.map(({ label, value }) => (
          <Text key={value}>{label}</Text>
        ))}
      </>
    );
  },
  SelectPromptHint: ({ message }: { message?: string }) => (
    <Text>{message}</Text>
  ),
}));

vi.mock('@/components/TextInput', () => ({
  MultilineTextInputHint: () => (
    <Text>Enter newline, Ctrl+S save, Esc/Ctrl+C cancel</Text>
  ),
  TextInput: (props: MockTextInputProps) => {
    mockTextInput(props);
    return <Text>{props.value || 'memory input'}</Text>;
  },
}));

import { MemoryManager } from './MemoryManager';

function details(scope: 'global' | 'project', exists: boolean) {
  return {
    content: exists ? `# ${scope}\n\n- Existing note` : null,
    exists,
    path: `/memory/${scope}/MEMORY.md`,
    scope,
  };
}

describe('MemoryManager', () => {
  beforeEach(() => {
    deleteMemory.mockReset();
    getMemoryDetails.mockReset();
    mockSelectPrompt.mockReset();
    mockTextInput.mockReset();
    resetSystemMessage.mockReset();
    getMemoryDetails.mockImplementation((scope: 'global' | 'project') =>
      details(scope, scope === 'project'),
    );
    saveMemory.mockReset();
    saveMemory.mockReturnValue({
      path: '/memory/project/MEMORY.md',
      status: 'saved',
    });
    deleteMemory.mockReturnValue(true);
  });

  it('shows scope actions and only available delete actions', () => {
    const { lastFrame } = renderWithTheme(<MemoryManager onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Edit project memory');
    expect(lastFrame()).toContain('Edit global memory');
    expect(lastFrame()).toContain('Delete project memory');
    expect(lastFrame()).not.toContain('Delete global memory');
  });

  it('hides delete actions when no memory files exist', () => {
    getMemoryDetails.mockImplementation((scope: 'global' | 'project') =>
      details(scope, false),
    );

    const { lastFrame } = renderWithTheme(<MemoryManager onClose={vi.fn()} />);

    expect(lastFrame()).toContain('Edit project memory');
    expect(lastFrame()).toContain('Edit global memory');
    expect(lastFrame()).not.toContain('Delete project memory');
    expect(lastFrame()).not.toContain('Delete global memory');
  });

  it('loads scoped memory content and shows its path', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    expect(lastFrame()).toContain('/memory/project/MEMORY.md');
    expect(lastFrame()).toContain('Existing note');
  });

  it('loads global memory content and shows its path', async () => {
    getMemoryDetails.mockImplementation((scope: 'global' | 'project') =>
      details(scope, true),
    );

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-global');
    rerender(manager);
    await time.tick();

    expect(lastFrame()).toContain('/memory/global/MEMORY.md');
  });

  it('starts with an empty draft when global memory does not exist', async () => {
    getMemoryDetails.mockImplementation((scope: 'global' | 'project') =>
      details(scope, scope === 'project'),
    );

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-global');
    rerender(manager);
    await time.tick();

    expect(lastFrame()).toContain('/memory/global/MEMORY.md');
    expect(mockTextInput.mock.calls.at(-1)?.[0]).toMatchObject({
      value: '',
    });
  });

  it('uses multiline input with a persistent save hint', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    expect(mockTextInput.mock.calls[0]?.[0]).toMatchObject({
      allowMultilinePaste: true,
      multiline: true,
      wrapIndent: 6,
    });
    expect(lastFrame()).toContain(
      'Enter newline, Ctrl+S save, Esc/Ctrl+C cancel',
    );
  });

  it('saves empty memory so an existing file can be deleted', async () => {
    saveMemory.mockReturnValue({
      path: '/memory/project/MEMORY.md',
      status: 'deleted',
    });
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();
    mockTextInput.mock.calls[0]?.[0].onSubmit('   ');
    await time.tick();

    expect(saveMemory).toHaveBeenCalledWith('   ', { scope: 'project' });
    expect(lastFrame()).toContain('Project memory deleted');
  });

  it('saves multiline memory and resets the system message', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();
    mockTextInput.mock.calls[0]?.[0].onSubmit('First line\nSecond line');
    await time.tick();

    expect(saveMemory).toHaveBeenCalledWith('First line\nSecond line', {
      scope: 'project',
    });
    expect(resetSystemMessage).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain('Project memory saved');
  });

  it('reports unchanged when saving empty memory and no file exists', async () => {
    saveMemory.mockReturnValue({
      path: '/memory/project/MEMORY.md',
      status: 'unchanged',
    });

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('   ');
    await time.tick();

    expect(saveMemory).toHaveBeenCalledWith('   ', { scope: 'project' });
    expect(lastFrame()).toContain('Project memory is already empty');
  });

  it('shows a spinner while saving', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('A note');
    rerender(manager);

    expect(lastFrame()).toContain('Saving memory...');
    await time.tick();
  });

  it('confirms and deletes a scoped memory file', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('delete-project');
    rerender(manager);
    await time.tick();

    expect(lastFrame()).toContain(
      'Delete project memory at /memory/project/MEMORY.md?',
    );
    mockSelectPrompt.mock.calls.at(-1)?.[0].onChange('delete');
    rerender(manager);
    await time.tick();

    expect(deleteMemory).toHaveBeenCalledWith('project');
    expect(resetSystemMessage).toHaveBeenCalledOnce();
    expect(lastFrame()).toContain('Project memory deleted');
  });

  it('shows an error notice when saving memory fails', async () => {
    saveMemory.mockImplementation(() => {
      throw new Error('disk full');
    });

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('A note');
    await time.tick();

    expect(saveMemory).toHaveBeenCalledWith('A note', { scope: 'project' });
    expect(lastFrame()).toContain('Could not save memory: disk full');
  });

  it('shows an error notice when saving memory throws a non-Error value', async () => {
    saveMemory.mockImplementation(() => {
      const error = new Error('disk full');
      Object.setPrototypeOf(error, null);
      Object.defineProperty(error, 'toString', {
        value: () => 'disk full',
      });
      throw error;
    });

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    mockTextInput.mock.calls[0]?.[0].onSubmit('A note');
    await time.tick();

    expect(lastFrame()).toContain('Could not save memory: disk full');
  });

  it('shows a notice when there is no memory to delete', async () => {
    deleteMemory.mockReturnValue(false);

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('delete-project');
    rerender(manager);
    await time.tick();

    mockSelectPrompt.mock.calls.at(-1)?.[0].onChange('delete');
    rerender(manager);
    await time.tick();

    expect(deleteMemory).toHaveBeenCalledWith('project');
    expect(lastFrame()).toContain('No project memory found');
  });

  it('does not crash when deleting memory fails', async () => {
    deleteMemory.mockImplementation(() => {
      throw new Error('permission denied');
    });

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('delete-project');
    rerender(manager);
    await time.tick();

    expect(() => {
      mockSelectPrompt.mock.calls.at(-1)?.[0].onChange('delete');
      rerender(manager);
    }).not.toThrow();

    expect(deleteMemory).toHaveBeenCalledWith('project');
  });

  it('does not crash when deleting memory throws a non-Error value', async () => {
    deleteMemory.mockImplementation(() => {
      const error = new Error('corrupted');
      Object.setPrototypeOf(error, null);
      Object.defineProperty(error, 'toString', {
        value: () => 'corrupted',
      });
      throw error;
    });

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('delete-project');
    rerender(manager);
    await time.tick();

    expect(() => {
      mockSelectPrompt.mock.calls.at(-1)?.[0].onChange('delete');
      rerender(manager);
    }).not.toThrow();

    expect(deleteMemory).toHaveBeenCalledWith('project');
  });

  it('confirms and deletes global memory', async () => {
    getMemoryDetails.mockImplementation((scope: 'global' | 'project') =>
      details(scope, true),
    );

    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('delete-global');
    rerender(manager);
    await time.tick();

    expect(lastFrame()).toContain(
      'Delete global memory at /memory/global/MEMORY.md?',
    );
    mockSelectPrompt.mock.calls.at(-1)?.[0].onChange('delete');
    rerender(manager);
    await time.tick();

    expect(deleteMemory).toHaveBeenCalledWith('global');
    expect(resetSystemMessage).toHaveBeenCalledOnce();
  });

  it('returns to the menu when delete is cancelled', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('delete-project');
    rerender(manager);
    await time.tick();

    mockSelectPrompt.mock.calls.at(-1)?.[0].onChange('cancel');
    rerender(manager);
    await time.tick();

    expect(deleteMemory).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Edit project memory');
  });

  it('closes when cancel is selected in the menu', async () => {
    const onClose = vi.fn();
    const manager = <MemoryManager onClose={onClose} />;
    const { rerender } = renderWithTheme(manager);

    mockSelectPrompt.mock.calls[0]?.[0].onChange('cancel');
    rerender(manager);
    await time.tick();

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('ignores Escape while the menu is visible', async () => {
    const onClose = vi.fn();
    const manager = <MemoryManager onClose={onClose} />;
    const { lastFrame, rerender, stdin } = renderWithTheme(manager);

    stdin.write(KEY.ESCAPE);
    rerender(manager);
    await time.tick();

    expect(onClose).not.toHaveBeenCalled();
    expect(lastFrame()).toContain('Edit project memory');
  });

  it('ignores regular keys in the edit view', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender, stdin } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    stdin.write('x');
    rerender(manager);
    await time.tick();

    expect(lastFrame()).toContain('/memory/project/MEMORY.md');
  });

  it('returns to the menu on Escape from the edit view', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender, stdin } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('edit-project');
    rerender(manager);
    await time.tick();

    stdin.write(KEY.ESCAPE);
    await time.tick();

    expect(lastFrame()).toContain('Edit project memory');
  });

  it('returns to the menu on Ctrl+C from the delete view', async () => {
    const manager = <MemoryManager onClose={vi.fn()} />;
    const { lastFrame, rerender, stdin } = renderWithTheme(manager);
    mockSelectPrompt.mock.calls[0]?.[0].onChange('delete-project');
    rerender(manager);
    await time.tick();

    stdin.write(KEY.CTRL_C);
    await time.tick();

    expect(lastFrame()).toContain('Edit project memory');
  });
});
