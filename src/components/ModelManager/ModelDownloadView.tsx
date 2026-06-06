import { Text } from 'ink';

import { useTheme } from '@/contexts';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import type { Notice } from './types';
import { buildDownloadOptions, getNoticeColor } from './utils';

interface Props {
  installedModels: string[];
  notice: Notice | null;
  onCancel: () => void;
  onChange: (value: string) => void;
}

export function ModelDownloadView({
  installedModels,
  notice,
  onCancel,
  onChange,
}: Props) {
  const theme = useTheme();

  return (
    <SelectPrompt
      options={buildDownloadOptions(installedModels)}
      onCancel={onCancel}
      onChange={(value) => {
        switch (value) {
          case 'custom':
            onChange('custom');
            break;

          case 'back':
            onCancel();
            break;

          default:
            onChange(value);
            break;
        }
      }}
    >
      <Text>Choose a model to download or use a custom model name.</Text>

      {notice && (
        <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
      )}

      <SelectPromptHint message="Download models" />
    </SelectPrompt>
  );
}
