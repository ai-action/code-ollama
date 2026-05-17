import { Box, Text } from 'ink';

import { UI } from '@/constants';
import type { ThemeDefinition } from '@/types';

import { TextInput } from '../TextInput';
import { ModelSuggestions } from './ModelSuggestions';
import type { Notice } from './types';
import { getNoticeColor } from './utils';

interface Props {
  downloadDraft: string;
  notice: Notice | null;
  theme: ThemeDefinition;
  onDraftChange: (value: string) => void;
  onHighlight: (value: string | null) => void;
  onSelectSuggestion: (value: string) => void;
  onSubmit: (value: string) => void;
}

export function ModelCustomDownloadView({
  downloadDraft,
  notice,
  theme,
  onDraftChange,
  onHighlight,
  onSelectSuggestion,
  onSubmit,
}: Props) {
  const renderNotice = () =>
    notice ? (
      <Text color={getNoticeColor(notice.tone, theme)}>{notice.text}</Text>
    ) : null;

  return (
    <Box flexDirection="column">
      <Text>Enter an Ollama model name to download.</Text>

      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>
        <TextInput
          value={downloadDraft}
          placeholder="gemma:latest"
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

      {renderNotice()}

      <Text color={theme.colors.secondary} dimColor>
        Press Enter to download, Esc or Ctrl+C to go back.
      </Text>
    </Box>
  );
}
