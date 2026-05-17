import { Spinner } from '@inkjs/ui';

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
      defaultValue={currentModel}
      options={[...options, { label: 'Back', value: 'back' }]}
      onCancel={onCancel}
      onChange={(value) => {
        if (value === 'back') {
          onCancel();
          return;
        }
        onSelect(value);
      }}
    >
      <SelectPromptHint message="Switch models" />
    </SelectPrompt>
  );
}
