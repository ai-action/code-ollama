import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TextInput } from '@/components/TextInput';
import { COMMAND, KEY, THEME, UI } from '@/constants';
import type { ThemeDefinition } from '@/types';
import { clipboard } from '@/utils';

import {
  type Attachment,
  extractImageAttachments,
  getAttachmentLabel,
} from './attachments';
import { CommandMenu } from './CommandMenu';
import { FileSuggestions } from './FileSuggestions';

interface Props {
  history: string[];
  isDisabled?: boolean;
  onInterrupt?: () => void;
  onSubmit: (value: SubmittedInput) => void;
  theme?: ThemeDefinition;
}

export interface SubmittedInput {
  content: string;
  images?: string[];
}

interface FileSuggestionRef {
  value: string;
  cursorPosition: number;
}

function hasFileSuggestionQuery(input: string): boolean {
  // e.g.: `@file`, `see @file`, `see@file`, or `@file see`
  return /(^|.)@\S+/.test(input);
}

function toAttachment(path: string, index: number, isTemp = false): Attachment {
  return {
    id: `${path}-${String(index)}`,
    isTemp,
    label: getAttachmentLabel(path),
    path,
  };
}

function cleanupAttachments(attachments: Attachment[]) {
  for (const attachment of attachments) {
    if (attachment.isTemp) {
      clipboard.removeClipboardImage(attachment.path);
    }
  }
}

export function ChatInput({
  history: sessionHistory,
  isDisabled = false,
  onInterrupt,
  onSubmit,
  theme = THEME.getTheme(),
}: Props) {
  const { exit } = useApp();
  const [history, setHistory] = useState(sessionHistory);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState<number | undefined>(
    undefined,
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileSuggestionRef = useRef<FileSuggestionRef | null>(null);
  const nextClipboardImageRef = useRef(1);
  const hasAttachments = attachments.length > 0;

  useEffect(() => {
    setHistory(sessionHistory);
    setHistoryIndex(null);
    setInput('');
    setCursorPosition(undefined);
    setError(null);
    fileSuggestionRef.current = null;
    nextClipboardImageRef.current = 1;
    setAttachments((previousAttachments) => {
      cleanupAttachments(previousAttachments);
      return [];
    });
  }, [sessionHistory]);

  const resetInput = useCallback((deleteTempAttachments = false) => {
    setInput('');
    setCursorPosition(undefined);
    setHistoryIndex(null);
    setError(null);

    if (deleteTempAttachments) {
      setAttachments((previousAttachments) => {
        cleanupAttachments(previousAttachments);
        return [];
      });
      nextClipboardImageRef.current = 1;
      return;
    }

    setAttachments([]);
  }, []);

  const removeLastAttachment = useCallback(() => {
    setAttachments((previousAttachments) => {
      const removedAttachment = previousAttachments.at(-1);
      if (removedAttachment?.isTemp) {
        clipboard.removeClipboardImage(removedAttachment.path);
      }

      return previousAttachments.slice(0, -1);
    });
    setError(null);
  }, []);

  const stageAttachments = useCallback((paths: string[], isTemp = false) => {
    setAttachments((previousAttachments) => [
      ...previousAttachments,
      ...paths.map((path, index) =>
        toAttachment(path, previousAttachments.length + index, isTemp),
      ),
    ]);
    setError(null);
  }, []);

  const attachClipboardImage = useCallback(() => {
    try {
      const path = clipboard.saveClipboardImage(
        `image-${String(nextClipboardImageRef.current)}`,
      );
      nextClipboardImageRef.current += 1;
      stageAttachments([path], true);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [stageAttachments]);

  const handleSelectFileSuggestion = useCallback(
    (nextInput: FileSuggestionRef) => {
      setInput(nextInput.value);
      setCursorPosition(nextInput.cursorPosition);
      setError(null);
    },
    [],
  );

  const handleFileSuggestionChange = useCallback(
    (nextInput: string | null) => {
      if (nextInput) {
        const mentionMatch = /(^|.)@(\S+)/.exec(input);

        // v8 ignore start
        if (mentionMatch) {
          const prefixLength = mentionMatch.index + mentionMatch[1].length;
          const queryLength = mentionMatch[2].length;
          const suffix = input.slice(prefixLength + 1 + queryLength);
          const nextCursorPosition = nextInput.length - suffix.length;
          fileSuggestionRef.current = {
            value: nextInput,
            cursorPosition: nextCursorPosition,
          };
        } else {
          fileSuggestionRef.current = {
            value: nextInput,
            cursorPosition: nextInput.length,
          };
        }
        // v8 ignore stop
      } else {
        fileSuggestionRef.current = null;
      }
    },
    [input],
  );

  const handleInputChange = useCallback(
    (nextInput: string) => {
      const didPaste = nextInput.length - input.length > 1;

      if (didPaste) {
        const { attachments: nextAttachments, remainingInput } =
          extractImageAttachments(nextInput);

        if (nextAttachments.length) {
          stageAttachments(nextAttachments);
          setInput(remainingInput);
          setCursorPosition(remainingInput.length);
          setHistoryIndex(null);
          return;
        }
      }

      setInput(nextInput);
      setHistoryIndex(null);
      setError(null);
    },
    [input, stageAttachments],
  );

  const submitAndReset = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      const imagePaths = attachments.map(({ path }) => path);

      if (!trimmedInput && !imagePaths.length) {
        return;
      }

      onSubmit({
        content: trimmedInput,
        ...(imagePaths.length ? { images: imagePaths } : {}),
      });
      if (trimmedInput && !trimmedInput.startsWith('/')) {
        setHistory((previousHistory) => [...previousHistory, trimmedInput]);
      }
      resetInput(trimmedInput.startsWith('/'));
      fileSuggestionRef.current = null;
    },
    [attachments, onSubmit, resetInput],
  );

  const showCommandMenu = input.startsWith('/');
  const showFileSuggestions = !showCommandMenu && hasFileSuggestionQuery(input);

  const handleHistoryNavigation = useCallback(
    (direction: 'up' | 'down') => {
      if (!history.length || showFileSuggestions || hasAttachments) {
        return;
      }

      if (direction === 'up') {
        if (historyIndex === null) {
          if (input) {
            return;
          }

          const nextIndex = history.length - 1;
          const nextInput = history[nextIndex];
          setHistoryIndex(nextIndex);
          setInput(nextInput);
          setCursorPosition(nextInput.length);
          return;
        }

        if (historyIndex === 0) {
          return;
        }

        const nextIndex = historyIndex - 1;
        const nextInput = history[nextIndex];
        setHistoryIndex(nextIndex);
        setInput(nextInput);
        setCursorPosition(nextInput.length);
        return;
      }

      if (historyIndex === null) {
        return;
      }

      if (historyIndex === history.length - 1) {
        setHistoryIndex(null);
        setInput('');
        setCursorPosition(0);
        return;
      }

      const nextIndex = historyIndex + 1;
      const nextInput = history[nextIndex];
      setHistoryIndex(nextIndex);
      setInput(nextInput);
      setCursorPosition(nextInput.length);
    },
    [hasAttachments, history, historyIndex, input, showFileSuggestions],
  );

  const handleSubmitText = useCallback(
    (value: string) => {
      if (value.startsWith('/')) {
        return;
      }

      if (hasFileSuggestionQuery(value)) {
        if (fileSuggestionRef.current) {
          handleSelectFileSuggestion(fileSuggestionRef.current);
        }

        return;
      }

      submitAndReset(value);
    },
    [handleSelectFileSuggestion, submitAndReset],
  );

  const handleSubmitCommand = useCallback(
    (value: string) => {
      if (COMMAND.LIST.find(({ name }) => name === value)) {
        submitAndReset(value);
      }
    },
    [submitAndReset],
  );

  useInput((inputKey, key) => {
    const isCtrlC = key.ctrl && inputKey === 'c';

    if (isDisabled) {
      if (key.escape || isCtrlC) {
        onInterrupt?.();
      }
      return;
    }

    if (key.ctrl && inputKey === 'v') {
      attachClipboardImage();
      return;
    }

    if ((key.backspace || key.delete || inputKey === KEY.BACKSPACE) && !input) {
      if (hasAttachments) {
        removeLastAttachment();
      }
      return;
    }

    if (isCtrlC) {
      if (input) {
        resetInput();
        return;
      }

      exit();
    }

    if (key.upArrow) {
      handleHistoryNavigation('up');
      return;
    }

    if (key.downArrow) {
      handleHistoryNavigation('down');
    }
  });

  const attachmentPrefix = attachments
    .map(({ label }) => `[${label}]`)
    .join(' ');

  const wrapIndent =
    UI.PROMPT_PREFIX.length +
    (attachmentPrefix ? attachmentPrefix.length + 1 : 0);

  return (
    <Box flexDirection="column">
      {error && (
        <Box marginBottom={1} marginX={UI.AGENT_MARGIN_X}>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}

      <Box>
        <Text>{UI.PROMPT_PREFIX}</Text>

        {hasAttachments && (
          <>
            <Text color={theme.colors.accent}>{attachmentPrefix}</Text>
            <Text> </Text>
          </>
        )}

        <TextInput
          value={input}
          isDisabled={isDisabled}
          cursorPosition={cursorPosition}
          wrapIndent={wrapIndent}
          onChange={handleInputChange}
          onSubmit={handleSubmitText}
          placeholder={
            hasAttachments
              ? undefined
              : 'Ask anything... (/ commands, @ files, Ctrl+V images)'
          }
        />
      </Box>

      {showCommandMenu && (
        <CommandMenu input={input} onSubmit={handleSubmitCommand} />
      )}

      {showFileSuggestions && (
        <FileSuggestions
          input={input}
          isDisabled={isDisabled}
          onChange={handleFileSuggestionChange}
          onSelect={handleSelectFileSuggestion}
        />
      )}
    </Box>
  );
}
