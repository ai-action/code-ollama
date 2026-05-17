import { Spinner } from '@inkjs/ui';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { buildInstalledModelOptions } from './utils';

const BACK_OPTION = { label: 'Back', value: 'back' };

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
      defaultValue={currentModel}
      options={[...options, BACK_OPTION]}
      onCancel={onCancel}
      onChange={(value) => {
        if (value === BACK_OPTION.value) {
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
