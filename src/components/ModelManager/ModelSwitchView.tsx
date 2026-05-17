import { Spinner } from '@inkjs/ui';

import { OPTION } from '@/constants';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { buildInstalledModelOptions } from './utils';

interface Props {
  currentModel: string;
  installedModels: string[];
  isLoading: boolean;
  onCancel: () => void;
  onSelect: (model: string) => void;
}

export function ModelSwitchView({
  currentModel,
  installedModels,
  isLoading,
  onCancel,
  onSelect,
}: Props) {
  if (isLoading) {
    return <Spinner label="Loading models..." />;
  }

  const options = buildInstalledModelOptions(installedModels, currentModel);

  return (
    <SelectPrompt
      options={[...options, OPTION.BACK]}
      onCancel={onCancel}
      onChange={(value) => {
        if (value === OPTION.BACK.value) {
          onCancel();
        } else {
          onSelect(value);
        }
      }}
    >
      <SelectPromptHint message="Switch models" />
    </SelectPrompt>
  );
}
