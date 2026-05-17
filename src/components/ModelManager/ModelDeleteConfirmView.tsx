import { Spinner } from '@inkjs/ui';
import { Text } from 'ink';

import { OPTION, UI } from '@/constants';
import type { ThemeDefinition } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { ConfirmDeleteAction, type Notice } from './types';
import { getNoticeColor } from './utils';

interface Props {
  deleteCandidate: string;
  isDeleting: boolean;
  notice: Notice | null;
  theme: ThemeDefinition;
  onCancel: () => void;
  onConfirm: (value: string) => Promise<void>;
}

export function ModelDeleteConfirmView({
  deleteCandidate,
  isDeleting,
  notice,
  theme,
  onCancel,
  onConfirm,
}: Props) {
  if (isDeleting) {
    return <Spinner label={`Deleting model ${deleteCandidate}...`} />;
  }

  const renderNotice = () =>
    notice ? (
      <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
    ) : null;

  return (
    <SelectPrompt
      options={[
        {
          label: `Yes, delete ${deleteCandidate}`,
          value: ConfirmDeleteAction.Delete,
        },
        { ...OPTION.BACK, label: 'No' },
      ]}
      onCancel={onCancel}
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      onChange={onConfirm}
    >
      <Text>
        {UI.WARNING} Delete model{' '}
        <Text color={theme.colors.model}>{deleteCandidate}</Text>?
      </Text>
      {renderNotice()}
      <SelectPromptHint message="This action cannot be undone" />
    </SelectPrompt>
  );
}
