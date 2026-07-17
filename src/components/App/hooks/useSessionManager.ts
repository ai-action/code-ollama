import { useCallback, useEffect, useRef, useState } from 'react';

import { TURN_ABORTED_MESSAGE } from '@/components/Messages/constants';
import type { ThemeColorName } from '@/types';
import { ollama, screen, session, terminal } from '@/utils';

interface UseSessionManagerOptions {
  sessionId: string | undefined;
  model: string;
  commandColor: ThemeColorName;
}

export function useSessionManager({
  sessionId,
  model,
  commandColor,
}: UseSessionManagerOptions) {
  const [activeSession, setSession] = useState(() =>
    sessionId ? session.loadSession(sessionId) : session.createSession(model),
  );

  const sessionRef = useRef(activeSession);
  const commandColorRef = useRef(commandColor);
  const modelRef = useRef(model);

  useEffect(() => {
    sessionRef.current = activeSession;
  }, [activeSession]);

  useEffect(() => {
    commandColorRef.current = commandColor;
  }, [commandColor]);

  useEffect(() => {
    modelRef.current = model;
  }, [model]);

  useEffect(() => {
    return () => {
      const currentSession = sessionRef.current;
      const deleted = session.deleteSessionIfEmpty(currentSession.metadata.id);

      if (!deleted && currentSession.messages.length > 0) {
        const resumeCommand = `code-ollama resume ${currentSession.metadata.id}`;
        terminal.write(
          `Resume session: ${terminal.color(resumeCommand, commandColorRef.current)}\n`,
        );
      }
    };
  }, []);

  const setActiveSession = useCallback((nextSession: session.SessionRecord) => {
    setSession((current) => {
      session.deleteSessionIfEmpty(current.metadata.id);
      return nextSession;
    });
  }, []);

  const handleCreateSession = useCallback(() => {
    const nextSession = session.createSession(modelRef.current);
    setActiveSession(nextSession);
    screen.clear(nextSession.metadata.id);
    return nextSession;
  }, [setActiveSession]);

  const handleOpenSession = useCallback(
    (sessionId: string) => {
      if (sessionRef.current.metadata.id === sessionId) {
        return false;
      }

      setActiveSession(session.loadSession(sessionId));
      screen.clear(sessionId);
      return true;
    },
    [setActiveSession],
  );

  const handleDeleteSession = useCallback((sessionId: string) => {
    session.deleteSession(sessionId);

    setSession((current) => {
      if (current.metadata.id !== sessionId) {
        return current;
      }

      return session.createSession(modelRef.current);
    });
  }, []);

  const handleMessagesChange = useCallback((messages: ollama.Message[]) => {
    setSession((current) => {
      const persistedMessages = messages.filter(
        ({ content }) => content !== TURN_ABORTED_MESSAGE,
      );

      if (persistedMessages.length <= current.messages.length) {
        return current;
      }

      let metadata = current.metadata;
      for (const message of persistedMessages.slice(current.messages.length)) {
        metadata = session.appendMessage(
          metadata.id,
          message,
          modelRef.current,
        );
      }

      return {
        metadata,
        messages: persistedMessages,
        stats: current.stats,
      };
    });
  }, []);

  const handleMessagesReplace = useCallback((messages: ollama.Message[]) => {
    setSession((current) => {
      const persistedMessages = messages.filter(
        ({ content }) => content !== TURN_ABORTED_MESSAGE,
      );
      const metadata = session.replaceMessages(
        current.metadata.id,
        persistedMessages,
        modelRef.current,
      );

      return {
        metadata,
        messages: persistedMessages,
        stats: current.stats,
      };
    });
  }, []);

  const handleModelCall = useCallback((call: ollama.OllamaCallStats) => {
    setSession((current) => ({
      ...current,
      stats: session.recordModelCall(current.metadata.id, call),
    }));
  }, []);

  return {
    activeSession,
    setSession,
    handleCreateSession,
    handleOpenSession,
    handleDeleteSession,
    handleMessagesChange,
    handleMessagesReplace,
    handleModelCall,
  };
}
