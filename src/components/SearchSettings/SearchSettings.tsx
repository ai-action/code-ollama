import { Box, Text, useInput } from 'ink';
import { useCallback, useMemo, useState } from 'react';

import { ExitHint } from '@/components';
import { UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { Config } from '@/types';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { TextInput } from '../TextInput';

interface Props {
  currentUrl?: string;
  onClose: () => void;
  onSave: (update: Pick<Config, 'searxngBaseUrl'>) => void;
}

enum View {
  Menu = 'menu',
  Edit = 'edit',
}

enum Action {
  Set = 'set',
  Clear = 'clear',
  Cancel = 'cancel',
}

export function SearchSettings({ currentUrl, onClose, onSave }: Props) {
  const theme = useTheme();
  const [view, setView] = useState<View>(View.Menu);
  const [draftUrl, setDraftUrl] = useState(currentUrl ?? '');
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const nextOptions = [
      {
        label: currentUrl
          ? `Update SearXNG URL (${currentUrl})`
          : 'Set SearXNG URL',
        value: Action.Set,
      },
    ];

    if (currentUrl) {
      nextOptions.push({
        label: 'Clear SearXNG URL',
        value: Action.Clear,
      });
    }

    nextOptions.push({
      label: 'Cancel',
      value: Action.Cancel,
    });

    return nextOptions;
  }, [currentUrl]);

  const handleChange = useCallback(
    (value: string) => {
      setError(null);

      switch (value as Action) {
        case Action.Set:
          setDraftUrl(currentUrl ?? '');
          setView(View.Edit);
          break;

        case Action.Clear:
          onSave({ searxngBaseUrl: undefined });
          break;

        case Action.Cancel:
        default:
          onClose();
      }
    },
    [currentUrl, onClose, onSave],
  );

  const handleSubmit = useCallback(
    (value: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        setError('Enter a URL or press Esc to cancel.');
        return;
      }

      try {
        const url = new URL(trimmedValue);
        if (!['http:', 'https:'].includes(url.protocol)) {
          setError('URL must use http or https.');
          return;
        }

        onSave({ searxngBaseUrl: url.toString() });
      } catch {
        setError('Enter a valid URL.');
      }
    },
    [onSave],
  );

  useInput((input, key) => {
    if (view === View.Edit && (key.escape || (key.ctrl && input === 'c'))) {
      setDraftUrl(currentUrl ?? '');
      setError(null);
      setView(View.Menu);
    }
  });

  if (view === View.Edit) {
    return (
      <Box flexDirection="column">
        <Text dimColor>
          Set the SearXNG URL. DuckDuckGo remains the fallback.
        </Text>

        <Box>
          <Text>{UI.PROMPT_PREFIX}</Text>
          <TextInput
            value={draftUrl}
            wrapIndent={UI.PROMPT_PREFIX.length}
            onChange={setDraftUrl}
            onSubmit={handleSubmit}
            placeholder="http://localhost:8080"
          />
        </Box>

        {error && <Text color={theme.colors.error}>{error}</Text>}

        <Text>
          <Text color={theme.colors.secondary} dimColor>
            Press Enter to save.
          </Text>{' '}
          <ExitHint />
        </Text>
      </Box>
    );
  }

  return (
    <SelectPrompt options={options} onChange={handleChange} onCancel={onClose}>
      <Text bold underline>
        Manage Web Search
      </Text>

      <SelectPromptHint message="Select action" />
    </SelectPrompt>
  );
}
