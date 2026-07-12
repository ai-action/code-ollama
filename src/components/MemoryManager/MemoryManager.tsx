import { Spinner } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import { MultilineTextInputHint, TextInput } from '@/components/TextInput';
import { UI } from '@/constants';
import { useTheme } from '@/contexts';
import { agents, memory } from '@/utils';
import type { MemoryScope } from '@/utils/memory';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';

interface Props {
  onClose: () => void;
}

interface Notice {
  text: string;
  tone: 'error' | 'success';
}

enum View {
  Menu = 'menu',
  EditProject = 'edit-project',
  EditGlobal = 'edit-global',
  DeleteProject = 'delete-project',
  DeleteGlobal = 'delete-global',
}

function getScope(view: View): MemoryScope {
  return view.endsWith('global') ? 'global' : 'project';
}

function getScopeLabel(scope: MemoryScope): string {
  return scope === 'global' ? 'global' : 'project';
}

function getCapitalizedScopeLabel(scope: MemoryScope): string {
  return scope === 'global' ? 'Global' : 'Project';
}

export function MemoryManager({ onClose }: Props) {
  const theme = useTheme();
  const [view, setView] = useState(View.Menu);
  const [draft, setDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [revision, setRevision] = useState(0);

  const projectMemory = useMemo(
    () => memory.getMemoryDetails('project'),
    [revision],
  );
  const globalMemory = useMemo(
    () => memory.getMemoryDetails('global'),
    [revision],
  );

  const returnToMenu = useCallback(() => {
    setDraft('');
    setIsSaving(false);
    setView(View.Menu);
  }, []);

  useInput((input, key) => {
    if (view !== View.Menu && (key.escape || (key.ctrl && input === 'c'))) {
      returnToMenu();
    }
  });

  const menuOptions = useMemo(
    () => [
      { label: 'Edit project memory', value: View.EditProject },
      { label: 'Edit global memory', value: View.EditGlobal },
      ...(projectMemory.exists
        ? [{ label: 'Delete project memory', value: View.DeleteProject }]
        : []),
      ...(globalMemory.exists
        ? [{ label: 'Delete global memory', value: View.DeleteGlobal }]
        : []),
      { label: 'Cancel', value: 'cancel' },
    ],
    [globalMemory.exists, projectMemory.exists],
  );

  const handleMenuChange = useCallback(
    (value: string) => {
      setNotice(null);
      if (value === 'cancel') {
        onClose();
        return;
      }
      const nextView = value as View;
      if (nextView === View.EditProject || nextView === View.EditGlobal) {
        const scope = getScope(nextView);
        const details = scope === 'global' ? globalMemory : projectMemory;
        setDraft(details.content ?? '');
      }
      setView(nextView);
    },
    [globalMemory, onClose, projectMemory],
  );

  const handleSave = useCallback(
    async (value: string) => {
      setIsSaving(true);
      setNotice(null);
      await Promise.resolve();

      const scope = getScope(view);
      try {
        const result = memory.saveMemory(value, { scope });
        if (result.status !== 'unchanged') {
          agents.resetSystemMessage();
        }
        setRevision((current) => current + 1);
        setNotice({
          text:
            result.status === 'saved'
              ? `${UI.CHECKMARK} ${getCapitalizedScopeLabel(scope)} memory saved to ${result.path}`
              : result.status === 'deleted'
                ? `${UI.CHECKMARK} ${getCapitalizedScopeLabel(scope)} memory deleted.`
                : `${UI.CHECKMARK} ${getCapitalizedScopeLabel(scope)} memory is already empty.`,
          tone: 'success',
        });
        returnToMenu();
      } catch (error) {
        setNotice({
          text: `${UI.EXCLAMATION} Could not save memory: ${error instanceof Error ? error.message : String(error)}`,
          tone: 'error',
        });
        setIsSaving(false);
      }
    },
    [returnToMenu, view],
  );

  const handleDelete = useCallback(
    (scope: MemoryScope) => {
      try {
        const deleted = memory.deleteMemory(scope);
        if (!deleted) {
          setNotice({
            text: `${UI.EXCLAMATION} No ${getScopeLabel(scope)} memory found.`,
            tone: 'error',
          });
        } else {
          agents.resetSystemMessage();
          setRevision((current) => current + 1);
          setNotice({
            text: `${UI.CHECKMARK} ${getCapitalizedScopeLabel(scope)} memory deleted.`,
            tone: 'success',
          });
        }
        returnToMenu();
      } catch (error) {
        setNotice({
          text: `${UI.EXCLAMATION} Could not delete memory: ${error instanceof Error ? error.message : String(error)}`,
          tone: 'error',
        });
      }
    },
    [returnToMenu],
  );

  const renderNotice = () =>
    notice ? (
      <Text
        color={
          notice.tone === 'error' ? theme.colors.error : theme.colors.status
        }
      >
        {notice.text}
      </Text>
    ) : null;

  const renderContent = () => {
    if (view === View.Menu) {
      return (
        <SelectPrompt
          options={menuOptions}
          onChange={handleMenuChange}
          onCancel={onClose}
        >
          {renderNotice()}
          <SelectPromptHint message="Select action" />
        </SelectPrompt>
      );
    }

    if (view === View.EditProject || view === View.EditGlobal) {
      const scope = getScope(view);
      const details = scope === 'global' ? globalMemory : projectMemory;
      return (
        <Box flexDirection="column">
          <Text>Edit {getScopeLabel(scope)} memory</Text>
          <Text dimColor>{details.path}</Text>
          <Box>
            <Text>{UI.PROMPT_PREFIX}</Text>
            <TextInput
              allowMultilinePaste
              isDisabled={isSaving}
              multiline
              value={draft}
              wrapIndent={UI.SCREEN_INPUT_WRAP_INDENT}
              onChange={setDraft}
              onSubmit={(value) => void handleSave(value)}
              placeholder="Enter memory..."
            />
          </Box>
          {renderNotice()}
          {isSaving ? (
            <Spinner label="Saving memory..." />
          ) : (
            <MultilineTextInputHint />
          )}
        </Box>
      );
    }

    const scope = getScope(view);
    const details = scope === 'global' ? globalMemory : projectMemory;
    return (
      <SelectPrompt
        options={[
          {
            label: `Yes, delete ${getScopeLabel(scope)} memory`,
            value: 'delete',
          },
          { label: 'No', value: 'cancel' },
        ]}
        onCancel={returnToMenu}
        onChange={(value) => {
          if (value === 'delete') {
            handleDelete(scope);
          } else {
            returnToMenu();
          }
        }}
      >
        <Text color={theme.colors.warning}>
          {UI.WARNING} Delete {getScopeLabel(scope)} memory at {details.path}?
        </Text>
        <SelectPromptHint message="This action cannot be undone" />
      </SelectPrompt>
    );
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold underline>
          Manage Memory
        </Text>
      </Box>
      {renderContent()}
    </Box>
  );
}
