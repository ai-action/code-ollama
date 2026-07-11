import { useCallback, useEffect, useRef, useState } from 'react';

import type { SubmittedInput } from '../ChatInput';

interface UseMessageQueueOptions {
  isPaused: boolean;
  onRunMessage: (message: SubmittedInput) => Promise<void>;
  resetKey: string;
}

interface MessageQueue {
  enqueueMessage: (message: SubmittedInput) => void;
  queuedMessages: SubmittedInput[];
  restoreLatestMessage: () => SubmittedInput | undefined;
}

export function useMessageQueue({
  isPaused,
  onRunMessage,
  resetKey,
}: UseMessageQueueOptions): MessageQueue {
  const isDrainingRef = useRef(false);
  const [isDraining, setIsDraining] = useState(false);
  const [queuedMessages, setQueuedMessages] = useState<SubmittedInput[]>([]);

  useEffect(() => {
    isDrainingRef.current = false;
    setIsDraining(false);
    setQueuedMessages([]);
  }, [resetKey]);

  useEffect(() => {
    if (
      isPaused ||
      !queuedMessages.length ||
      isDraining ||
      isDrainingRef.current
    ) {
      return;
    }

    const [nextMessage] = queuedMessages;
    isDrainingRef.current = true;
    setIsDraining(true);
    setQueuedMessages((current) => current.slice(1));
    void onRunMessage(nextMessage).finally(() => {
      isDrainingRef.current = false;
      setIsDraining(false);
    });
  }, [isDraining, isPaused, onRunMessage, queuedMessages]);

  const enqueueMessage = useCallback((message: SubmittedInput) => {
    setQueuedMessages((current) => [...current, message]);
  }, []);

  const restoreLatestMessage = useCallback(() => {
    const latestMessage = queuedMessages.at(-1);
    if (!latestMessage) {
      return undefined;
    }

    setQueuedMessages((current) => current.slice(0, -1));
    return latestMessage;
  }, [queuedMessages]);

  return { enqueueMessage, queuedMessages, restoreLatestMessage };
}
