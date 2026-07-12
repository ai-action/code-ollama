import { Spinner } from '@inkjs/ui';
import { Box, Text, useInput } from 'ink';
import { useCallback, useMemo, useRef, useState } from 'react';

import { ExitHint } from '@/components';
import { UI } from '@/constants';
import { useTheme } from '@/contexts';
import { ollama } from '@/utils';
import type { HostConfig } from '@/utils/config';

import { SelectPrompt, SelectPromptHint } from '../SelectPrompt';
import { TextInput } from '../TextInput';

interface Props extends HostConfig {
  onClose: () => void;
  onSave: (host?: string) => void;
}

enum View {
  Menu = 'menu',
  Edit = 'edit',
  Checking = 'checking',
}

enum Action {
  Set = 'set',
  Reset = 'reset',
  Cancel = 'cancel',
}

export function HostSettings({
  configuredHost,
  effectiveHost,
  source,
  onClose,
  onSave,
}: Props) {
  const theme = useTheme();
  const [view, setView] = useState<View>(View.Menu);
  const [draftHost, setDraftHost] = useState(configuredHost ?? effectiveHost);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const options = useMemo(
    () => [
      {
        label: configuredHost
          ? `Update Ollama host (${configuredHost})`
          : 'Set Ollama host',
        value: Action.Set,
      },
      ...(configuredHost
        ? [{ label: 'Reset Ollama host', value: Action.Reset }]
        : []),
      { label: 'Cancel', value: Action.Cancel },
    ],
    [configuredHost],
  );

  const handleChange = useCallback(
    (value: string) => {
      switch (value as Action) {
        case Action.Set:
          setError(null);
          setDraftHost(configuredHost ?? effectiveHost);
          setView(View.Edit);
          break;
        case Action.Reset:
          onSave(undefined);
          break;
        case Action.Cancel:
        default:
          onClose();
      }
    },
    [configuredHost, effectiveHost, onClose, onSave],
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        setError(`${UI.EXCLAMATION} Enter a URL or press Esc to cancel.`);
        return;
      }

      let normalizedHost: string;
      try {
        const url = new URL(trimmedValue);
        if (!['http:', 'https:'].includes(url.protocol)) {
          setError(`${UI.EXCLAMATION} URL must use http or https.`);
          return;
        }
        normalizedHost = url.toString().replace(/\/$/, '');
      } catch {
        setError(`${UI.EXCLAMATION} Enter a valid URL.`);
        return;
      }

      setError(null);
      setView(View.Checking);
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        if (!(await ollama.checkHealth(normalizedHost, controller.signal))) {
          setError(`${UI.EXCLAMATION} Could not connect to the Ollama host.`);
          setView(View.Edit);
          return;
        }

        onSave(normalizedHost);
      } catch {
        if (!controller.signal.aborted) {
          setError(`${UI.EXCLAMATION} Could not connect to the Ollama host.`);
        }
        setView(View.Edit);
      } finally {
        abortControllerRef.current = null;
      }
    },
    [onSave],
  );

  useInput((input, key) => {
    if (!(key.escape || (key.ctrl && input === 'c'))) {
      return;
    }

    if (view === View.Checking) {
      abortControllerRef.current?.abort();
      setView(View.Edit);
      return;
    }

    if (view === View.Edit) {
      setError(null);
      setView(View.Menu);
    }
  });

  const renderContent = () => {
    if (view === View.Checking) {
      return <Spinner label="Checking Ollama connection..." />;
    }

    if (view === View.Edit) {
      return (
        <Box flexDirection="column">
          <Text>Enter the URL of the Ollama server.</Text>
          <Box>
            <Text>{UI.PROMPT_PREFIX}</Text>
            <TextInput
              value={draftHost}
              wrapIndent={UI.PROMPT_PREFIX.length}
              onChange={setDraftHost}
              onSubmit={(value) => void handleSubmit(value)}
              placeholder="http://localhost:11434"
            />
          </Box>
          {error && <Text color={theme.colors.error}>{error}</Text>}
          <Text>
            <Text color={theme.colors.secondary} dimColor>
              Press Enter to check and save.
            </Text>{' '}
            <ExitHint />
          </Text>
        </Box>
      );
    }

    return (
      <Box flexDirection="column">
        <Text>
          Current Ollama host:{' '}
          <Text color={theme.colors.status}>{effectiveHost}</Text>
        </Text>
        {source === 'environment' && (
          <Text color={theme.colors.warning}>
            {UI.WARNING} OLLAMA_HOST overrides the saved host. Changes will
            apply after the environment variable is removed.
          </Text>
        )}
        <SelectPrompt
          options={options}
          onChange={handleChange}
          onCancel={onClose}
        >
          <SelectPromptHint message="Select action" />
        </SelectPrompt>
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold underline>
          Manage Ollama Host
        </Text>
      </Box>
      {renderContent()}
    </Box>
  );
}
