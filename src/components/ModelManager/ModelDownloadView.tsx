import { Text } from 'ink';

import type { ThemeDefinition } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import type { Notice } from './types';
import { buildDownloadOptions, getNoticeColor } from './utils';

interface Props {
  notice: Notice | null;
  theme: ThemeDefinition;
  onCancel: () => void;
  onChange: (value: string) => void;
}

export function ModelDownloadView({
  notice,
  theme,
  onCancel,
  onChange,
}: Props) {
  const renderNotice = () =>
    notice ? (
      <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
    ) : null;

  return (
    <SelectPrompt
      options={buildDownloadOptions()}
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
      {renderNotice()}
      <SelectPromptHint message="Download models" />
    </SelectPrompt>
  );
}
