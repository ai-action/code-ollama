import { Box, Text } from 'ink';

import { ExitHint } from '@/components';
import { UI } from '@/constants';
import { useTheme } from '@/contexts';

import { TextInput } from '../TextInput';
import { ModelSuggestions } from './ModelSuggestions';
import type { Notice } from './types';
import { getNoticeColor } from './utils';

interface Props {
  downloadDraft: string;
  notice: Notice | null;
  onDraftChange: (value: string) => void;
  onHighlight: (value: string | null) => void;
  onSelectSuggestion: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function ModelCustomDownloadView({
  downloadDraft,
  notice,
  onDraftChange,
  onHighlight,
  onSelectSuggestion,
  onSubmit,
}: Props) {
  const theme = useTheme();

  return (
    <Box flexDirection="column">
      <Text>Enter an Ollama model name to download.</Text>

      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>
        <TextInput
          value={downloadDraft}
          placeholder="name:tag"
          wrapIndent={UI.PROMPT_PREFIX.length}
          onChange={onDraftChange}
          onSubmit={onSubmit}
        />
      </Box>

      <ModelSuggestions
        catalog={[]}
        input={downloadDraft}
        onHighlight={onHighlight}
        onSelect={onSelectSuggestion}
      />

      {notice && (
        <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
      )}

      <Text>
        <Text color={theme.colors.secondary} dimColor>
          Press Enter to download.
        </Text>{' '}
        <ExitHint />
      </Text>
    </Box>
  );
}
