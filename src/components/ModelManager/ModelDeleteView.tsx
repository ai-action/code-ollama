import { Spinner } from '@inkjs/ui';
import { Text } from 'ink';

import type { ThemeDefinition } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { DeleteAction, type Notice } from './types';
import { buildInstalledModelOptions, getNoticeColor } from './utils';

interface Props {
  currentModel: string;
  installedModels: string[];
  isLoading: boolean;
  notice: Notice | null;
  theme: ThemeDefinition;
  onCancel: () => void;
  onSelect: (model: string) => void;
}

export function ModelDeleteView({
  currentModel,
  installedModels,
  isLoading,
  notice,
  theme,
  onCancel,
  onSelect,
}: Props) {
  if (isLoading) {
    return <Spinner label="Loading models..." />;
  }

  const renderNotice = () =>
    notice ? (
      <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
    ) : null;

  const options = [
    ...buildInstalledModelOptions(installedModels, currentModel, true),
    { label: 'Back', value: DeleteAction.Back },
  ];

  return (
    <SelectPrompt
      options={options}
      onCancel={onCancel}
      onChange={(value) => {
        if (value === 'back') {
          onCancel();
          return;
        }
        onSelect(value);
      }}
    >
      <Text>Delete an installed Ollama model.</Text>
      {renderNotice()}
      <SelectPromptHint message="Delete models" />
    </SelectPrompt>
  );
}
