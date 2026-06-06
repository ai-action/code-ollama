import { Spinner } from '@inkjs/ui';
import { Text } from 'ink';

import { OPTION, UI } from '@/constants';
import { useTheme } from '@/contexts';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { ConfirmDeleteAction, type Notice } from './types';
import { getNoticeColor } from './utils';

interface Props {
  deleteCandidate: string;
  isDeleting: boolean;
  notice: Notice | null;
  onCancel: () => void;
  onConfirm: (value: string) => Promise<void>;
}

export function ModelDeleteConfirmView({
  deleteCandidate,
  isDeleting,
  notice,
  onCancel,
  onConfirm,
}: Props) {
  const theme = useTheme();
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
