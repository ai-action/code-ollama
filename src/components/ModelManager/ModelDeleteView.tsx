import { Spinner } from '@inkjs/ui';
import { Text } from 'ink';

import { OPTION } from '@/constants';
import { useTheme } from '@/contexts';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { type Notice } from './types';
import { buildInstalledModelOptions, getNoticeColor } from './utils';

interface Props {
  currentModel: string;
  installedModels: string[];
  isLoading: boolean;
  notice: Notice | null;
  onCancel: () => void;
  onSelect: (model: string) => void;
}

export function ModelDeleteView({
  currentModel,
  installedModels,
  isLoading,
  notice,
  onCancel,
  onSelect,
}: Props) {
  const theme = useTheme();

  // v8 ignore next
  if (isLoading) {
    return <Spinner label="Loading models..." />;
  }

  const deletableModels = installedModels.filter(
    (model) => model !== currentModel,
  );
  const options = [
    ...buildInstalledModelOptions(deletableModels, currentModel),
    OPTION.BACK,
  ];

  return (
    <SelectPrompt
      options={options}
      onCancel={onCancel}
      onChange={(value) => {
        if (value === OPTION.BACK.value) {
          onCancel();
        } else {
          onSelect(value);
        }
      }}
    >
      {notice && (
        <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
      )}

      <SelectPromptHint message="Delete a model" />
    </SelectPrompt>
  );
}
