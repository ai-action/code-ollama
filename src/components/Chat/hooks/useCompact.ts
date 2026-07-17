import { useCallback } from 'react';

import { prewarmCodeBlocks } from '@/components/CodeBlock';
import { PROMPT, ROLE } from '@/constants';
import type { ThemeDefinition } from '@/types';
import { ollama, screen } from '@/utils';

import { ChatActionType } from '../constants';
import type { ChatAction, ChatState } from '../types';

function getLatestTurn(messages: ollama.Message[]): ollama.Message[] {
  const latestAssistantIndex = messages.findLastIndex(
    ({ role }) => role === ROLE.ASSISTANT,
  );

  if (latestAssistantIndex >= 0) {
    const latestUserIndex = messages
      .slice(0, latestAssistantIndex)
      .findLastIndex(({ role }) => role === ROLE.USER);

    return [
      // v8 ignore start
      ...(latestUserIndex >= 0 ? [messages[latestUserIndex]] : []),
      // v8 ignore stop
      messages[latestAssistantIndex],
    ];
  }

  const latestUser = messages.findLast(({ role }) => role === ROLE.USER);
  // v8 ignore next
  return latestUser ? [latestUser] : [];
}

interface UseCompactOptions {
  abortControllerRef: React.RefObject<AbortController | null>;
  dispatch: React.Dispatch<ChatAction>;
  model: string | undefined;
  onMessagesReplace: ((messages: ollama.Message[]) => void) | undefined;
  onModelCall?: (stats: ollama.OllamaCallStats) => void;
  persistedSnapshotRef: React.RefObject<string>;
  sessionId: string;
  state: Pick<
    ChatState,
    'isLoading' | 'messages' | 'pendingPlan' | 'pendingToolCall'
  >;
  theme: ThemeDefinition;
}

/**
 * Hook to handle the `/compact` command.
 * It summarizes the conversation history into a single context message to reduce token usage.
 */
export function useCompact({
  abortControllerRef,
  dispatch,
  model,
  onMessagesReplace,
  onModelCall,
  persistedSnapshotRef,
  sessionId,
  state,
  theme,
}: UseCompactOptions) {
  return useCallback(async () => {
    const { isLoading, messages, pendingPlan, pendingToolCall } = state;

    // v8 ignore start
    if (isLoading || pendingPlan || pendingToolCall) {
      return 'Cannot compact while another action is pending.';
    }
    // v8 ignore stop

    if (!messages.length) {
      return 'Nothing to compact yet.';
    }

    const modelName = model;
    // v8 ignore next
    if (!modelName) {
      return 'Model is required.';
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    let summary = '';

    dispatch({
      type: ChatActionType.SetLoading,
      isLoading: true,
    });
    dispatch({
      type: ChatActionType.SetStreamingMessage,
      message: { role: ROLE.ASSISTANT, content: '' },
    });

    try {
      const compactionMessages: ollama.Message[] = [
        ...messages,
        {
          role: ROLE.USER,
          content: PROMPT.COMPACT_MESSAGES_INSTRUCTION,
        },
      ];

      for await (const chunk of ollama.streamChat(
        compactionMessages,
        modelName,
        [],
        controller.signal,
      )) {
        // v8 ignore next 3
        if (chunk.type === 'content') {
          summary = ollama.sanitizeAssistantContent(summary + chunk.content);
        } else if (chunk.type === 'stats') {
          onModelCall?.(chunk.stats);
        }
      }

      summary = summary.trim();
      if (!summary) {
        throw new Error('Compaction summary was empty');
      }

      await prewarmCodeBlocks(summary, theme);

      const compactedMessages: ollama.Message[] = [
        {
          role: ROLE.SYSTEM,
          content: `Compacted conversation context:\n\n${summary}`,
        },
        ...getLatestTurn(messages),
      ];

      onMessagesReplace?.(compactedMessages);
      persistedSnapshotRef.current = JSON.stringify(compactedMessages);
      dispatch({
        type: ChatActionType.CommitMessages,
        messages: compactedMessages,
      });
      screen.clear(sessionId);
    } catch (error) {
      // v8 ignore start
      if (!controller.signal.aborted) {
        return `Compaction failed: ${error instanceof Error ? error.message : String(error)}`;
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      // v8 ignore stop

      dispatch({
        type: ChatActionType.SetLoading,
        isLoading: false,
      });

      dispatch({
        type: ChatActionType.SetStreamingMessage,
        message: null,
      });
    }
  }, [
    abortControllerRef,
    dispatch,
    model,
    onMessagesReplace,
    onModelCall,
    persistedSnapshotRef,
    sessionId,
    state,
    theme,
  ]);
}
