import { Box, Text, useApp, useInput } from 'ink';
import { useCallback, useEffect, useRef, useState } from 'react';

import { TextInput } from '@/components/TextInput';
import { KEY, UI } from '@/constants';
import { useTheme } from '@/contexts';
import { clipboard } from '@/utils';

import {
  type Attachment,
  extractImageAttachments,
  getAttachmentLabels,
} from './attachments';
import {
  CommandMenu,
  getMatchingCommands,
  isSubmittableCommand,
} from './CommandMenu';
import { FileSuggestions } from './FileSuggestions';
import { useHistorySearch } from './hooks';
import { Shortcuts } from './Shortcuts';

interface Props {
  history: string[];
  isActive?: boolean;
  isDisabled?: boolean;
  onInterrupt?: () => void;
  onRestoreQueuedMessage?: () => string | undefined;
  onSubmit: (value: SubmittedInput) => void;
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

function getInsertedText(previousInput: string, nextInput: string) {
  let prefixLength = 0;
  const maximumPrefixLength = Math.min(previousInput.length, nextInput.length);

  while (
    prefixLength < maximumPrefixLength &&
    previousInput[prefixLength] === nextInput[prefixLength]
  ) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  const maximumSuffixLength = previousInput.length - prefixLength;

  while (
    suffixLength < maximumSuffixLength &&
    previousInput[previousInput.length - suffixLength - 1] ===
      nextInput[nextInput.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return {
    insertedText: nextInput.slice(
      prefixLength,
      nextInput.length - suffixLength,
    ),
    prefix: nextInput.slice(0, prefixLength),
    suffix: suffixLength ? nextInput.slice(-suffixLength) : '',
  };
}

function toAttachment(path: string, index: number, isTemp = false): Attachment {
  return {
    id: `${path}-${String(index)}`,
    isTemp,
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
  isActive = false,
  isDisabled = false,
  onInterrupt,
  onRestoreQueuedMessage,
  onSubmit,
}: Props) {
  const theme = useTheme();
  const { exit } = useApp();
  const [history, setHistory] = useState(sessionHistory);
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const [input, setInput] = useState('');
  const [cursorPosition, setCursorPosition] = useState<number | undefined>(
    undefined,
  );
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const fileSuggestionRef = useRef<FileSuggestionRef | null>(null);
  const nextClipboardImageRef = useRef(1);
  const hasAttachments = attachments.length > 0;
  const {
    acceptHistorySearch,
    cancelHistorySearch,
    cycleHistorySearch,
    historySearch,
    ignoreHistorySearchTextInput,
    resetHistorySearch,
    startHistorySearch,
    updateHistorySearchQuery,
  } = useHistorySearch({
    cursorPosition,
    history,
    input,
    setCursorPosition,
    setHistoryIndex,
    setInput,
  });

  useEffect(() => {
    setHistory(sessionHistory);
    setHistoryIndex(null);
    setInput('');
    setCursorPosition(undefined);
    setError(null);
    setShowShortcuts(false);
    resetHistorySearch();
    fileSuggestionRef.current = null;
    nextClipboardImageRef.current = 1;
    setAttachments((previousAttachments) => {
      cleanupAttachments(previousAttachments);
      return [];
    });
  }, [resetHistorySearch, sessionHistory]);

  useEffect(() => {
    if (isActive || isDisabled) {
      setShowShortcuts(false);
    }
  }, [isActive, isDisabled]);

  const resetInput = useCallback(
    (deleteTempAttachments = false) => {
      setInput('');
      setCursorPosition(undefined);
      setHistoryIndex(null);
      setError(null);
      setShowShortcuts(false);
      resetHistorySearch();

      if (deleteTempAttachments) {
        setAttachments((previousAttachments) => {
          cleanupAttachments(previousAttachments);
          return [];
        });
        nextClipboardImageRef.current = 1;
        return;
      }

      setAttachments([]);
    },
    [resetHistorySearch],
  );

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
    if (isActive) {
      setError("Images can't be queued.");
      return;
    }

    try {
      const path = clipboard.saveClipboardImage(
        `image-${String(nextClipboardImageRef.current)}`,
      );
      nextClipboardImageRef.current += 1;
      stageAttachments([path], true);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }, [isActive, stageAttachments]);

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
      if (
        !showShortcuts &&
        !input &&
        !hasAttachments &&
        !isActive &&
        !isDisabled &&
        nextInput === '?'
      ) {
        setShowShortcuts(true);
        setCursorPosition(0);
        setError(null);
        return;
      }

      if (showShortcuts) {
        setShowShortcuts(false);
        if (nextInput.includes('\x1B')) {
          return;
        }
      }

      const didPaste = nextInput.length - input.length > 1;

      if (didPaste) {
        const { insertedText, prefix, suffix } = getInsertedText(
          input,
          nextInput,
        );
        const { attachments: nextAttachments, remainingInput } =
          extractImageAttachments(insertedText);

        if (nextAttachments.length) {
          if (isActive) {
            setError("Images can't be queued.");
            return;
          }

          stageAttachments(nextAttachments);
          const inputWithoutAttachments = `${prefix}${remainingInput}${suffix}`;
          setInput(inputWithoutAttachments);
          setCursorPosition(prefix.length + remainingInput.length);
          setHistoryIndex(null);
          resetHistorySearch();
          return;
        }
      }

      setInput(nextInput);
      setHistoryIndex(null);
      resetHistorySearch();
      setError(null);
    },
    [
      hasAttachments,
      input,
      isActive,
      isDisabled,
      resetHistorySearch,
      showShortcuts,
      stageAttachments,
    ],
  );

  const submitAndReset = useCallback(
    (input: string) => {
      const trimmedInput = input.trim();
      const imagePaths = attachments.map(({ path }) => path);

      if (!trimmedInput && !imagePaths.length) {
        return;
      }

      if (
        isActive &&
        (imagePaths.length > 0 ||
          trimmedInput.startsWith('/') ||
          trimmedInput.startsWith('!'))
      ) {
        setError("Commands and images can't be queued.");
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
    [attachments, isActive, onSubmit, resetInput],
  );

  const isMultilineInput = input.includes('\n');
  const showCommandMenu = input.startsWith('/') && !isMultilineInput;
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
      if (value.startsWith('/') && !value.includes('\n')) {
        if (getMatchingCommands(value).length) {
          return;
        }

        if (isSubmittableCommand(value)) {
          submitAndReset(value);
        }

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
      if (isSubmittableCommand(value)) {
        submitAndReset(value);
      }
    },
    [submitAndReset],
  );

  const handleCompleteCommand = useCallback((value: string) => {
    setInput(value);
    setCursorPosition(value.length);
  }, []);

  useInput((inputKey, key) => {
    const isEscape =
      key.escape || inputKey === KEY.ESCAPE || inputKey === '\x1B';
    const isCtrlC = key.ctrl && inputKey === 'c';
    const isCtrlR = key.ctrl && inputKey === 'r';

    if (
      showShortcuts &&
      (isEscape || key.backspace || inputKey === KEY.BACKSPACE)
    ) {
      setShowShortcuts(false);
      return;
    }

    if (isDisabled) {
      if (isEscape || isCtrlC) {
        onInterrupt?.();
      }
      return;
    }

    if (isActive && (isEscape || isCtrlC)) {
      onInterrupt?.();
      return;
    }

    if (historySearch.isActive) {
      if (isEscape || isCtrlC) {
        cancelHistorySearch();
        return;
      }

      if (key.return) {
        acceptHistorySearch();
        return;
      }

      if (isCtrlR) {
        cycleHistorySearch();
        return;
      }

      if (key.backspace || key.delete || inputKey === KEY.BACKSPACE) {
        updateHistorySearchQuery(historySearch.query.slice(0, -1));
        return;
      }

      if (!key.ctrl && inputKey) {
        updateHistorySearchQuery(historySearch.query + inputKey);
      }

      return;
    }

    if (isCtrlR) {
      if (!showFileSuggestions && !hasAttachments) {
        startHistorySearch();
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
      if (isActive && !input && !hasAttachments) {
        const queuedMessage = onRestoreQueuedMessage?.();
        if (queuedMessage !== undefined) {
          setInput(queuedMessage);
          setCursorPosition(queuedMessage.length);
          setError(null);
          return;
        }
      }

      handleHistoryNavigation('up');
      return;
    }

    if (key.downArrow) {
      handleHistoryNavigation('down');
    }
  });

  const attachmentPrefix = getAttachmentLabels(
    attachments.map(({ path }) => path),
  )
    .map((label) => `[${label}]`)
    .join(' ');

  const wrapIndent =
    UI.PROMPT_PREFIX.length +
    (attachmentPrefix ? attachmentPrefix.length + 1 : 0);

  return (
    <Box flexDirection="column">
      {error && (
        <Box marginBottom={1} marginX={UI.SCREEN_MARGIN_X}>
          <Text color={theme.colors.error}>{error}</Text>
        </Box>
      )}

      {showShortcuts && <Shortcuts />}

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
          allowMultilinePaste
          wrapIndent={wrapIndent}
          onChange={
            historySearch.isActive
              ? ignoreHistorySearchTextInput
              : handleInputChange
          }
          onSubmit={
            historySearch.isActive
              ? ignoreHistorySearchTextInput
              : handleSubmitText
          }
          placeholder={
            hasAttachments
              ? undefined
              : 'Ask anything... (/ commands, @ files, ! shell, Ctrl+V images)'
          }
        />
      </Box>

      {historySearch.isActive && (
        <Box marginLeft={UI.PROMPT_PREFIX.length}>
          <Text dimColor>bck-i-search: {historySearch.query}_</Text>
        </Box>
      )}

      {!historySearch.isActive && showCommandMenu && (
        <CommandMenu
          input={input}
          onComplete={handleCompleteCommand}
          onSubmit={handleSubmitCommand}
        />
      )}

      {!historySearch.isActive && showFileSuggestions && (
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
