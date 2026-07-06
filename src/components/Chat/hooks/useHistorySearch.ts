import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useState,
} from 'react';

interface HistorySearchState {
  isActive: boolean;
  query: string;
  matchIndex: number | null;
  draftInput: string;
  draftCursorPosition: number | undefined;
}

interface Options {
  cursorPosition: number | undefined;
  history: string[];
  input: string;
  setCursorPosition: Dispatch<SetStateAction<number | undefined>>;
  setHistoryIndex: Dispatch<SetStateAction<number | null>>;
  setInput: Dispatch<SetStateAction<string>>;
}

const inactiveHistorySearch: HistorySearchState = {
  isActive: false,
  query: '',
  matchIndex: null,
  draftInput: '',
  draftCursorPosition: undefined,
};

function findHistoryMatch(
  history: string[],
  query: string,
  startIndex = history.length - 1,
): number | null {
  const normalizedQuery = query.toLowerCase();

  for (let index = startIndex; index >= 0; index -= 1) {
    if (history[index].toLowerCase().includes(normalizedQuery)) {
      return index;
    }
  }

  return null;
}

function findNextOlderHistoryMatch(
  history: string[],
  query: string,
  currentIndex: number | null,
): number | null {
  if (currentIndex === null) {
    return findHistoryMatch(history, query);
  }

  return (
    findHistoryMatch(history, query, currentIndex - 1) ??
    findHistoryMatch(history, query)
  );
}

function findQueryMatchPosition(value: string, query: string): number {
  return value.toLowerCase().indexOf(query.toLowerCase());
}

export function useHistorySearch({
  cursorPosition,
  history,
  input,
  setCursorPosition,
  setHistoryIndex,
  setInput,
}: Options) {
  const [historySearch, setHistorySearch] = useState<HistorySearchState>(
    inactiveHistorySearch,
  );

  const resetHistorySearch = useCallback(() => {
    setHistorySearch(inactiveHistorySearch);
  }, []);

  const cancelHistorySearch = useCallback(() => {
    setInput(historySearch.draftInput);
    setCursorPosition(historySearch.draftCursorPosition);
    setHistoryIndex(null);
    setHistorySearch(inactiveHistorySearch);
  }, [
    historySearch.draftCursorPosition,
    historySearch.draftInput,
    setCursorPosition,
    setHistoryIndex,
    setInput,
  ]);

  const acceptHistorySearch = useCallback(() => {
    if (historySearch.matchIndex === null) {
      return;
    }

    setCursorPosition(input.length);
    setHistoryIndex(historySearch.matchIndex);
    setHistorySearch(inactiveHistorySearch);
  }, [
    historySearch.matchIndex,
    input.length,
    setCursorPosition,
    setHistoryIndex,
  ]);

  const startHistorySearch = useCallback(() => {
    setHistoryIndex(null);
    setInput(input);
    setCursorPosition(cursorPosition ?? input.length);
    setHistorySearch({
      isActive: true,
      query: '',
      matchIndex: null,
      draftInput: input,
      draftCursorPosition: cursorPosition,
    });
  }, [cursorPosition, input, setCursorPosition, setHistoryIndex, setInput]);

  const updateHistorySearchQuery = useCallback(
    (query: string) => {
      const matchIndex = findHistoryMatch(history, query);
      const nextInput =
        matchIndex === null ? historySearch.draftInput : history[matchIndex];
      const nextCursorPosition =
        matchIndex === null
          ? (historySearch.draftCursorPosition ??
            historySearch.draftInput.length)
          : findQueryMatchPosition(nextInput, query);

      setHistorySearch((currentSearch) => ({
        ...currentSearch,
        query,
        matchIndex,
      }));
      setInput(nextInput);
      setCursorPosition(nextCursorPosition);
    },
    [
      history,
      historySearch.draftCursorPosition,
      historySearch.draftInput,
      setCursorPosition,
      setInput,
    ],
  );

  const cycleHistorySearch = useCallback(() => {
    const matchIndex = findNextOlderHistoryMatch(
      history,
      historySearch.query,
      historySearch.matchIndex,
    );
    const nextInput =
      matchIndex === null ? historySearch.draftInput : history[matchIndex];
    const nextCursorPosition =
      matchIndex === null
        ? (historySearch.draftCursorPosition ?? historySearch.draftInput.length)
        : findQueryMatchPosition(nextInput, historySearch.query);

    setHistorySearch((currentSearch) => ({
      ...currentSearch,
      matchIndex,
    }));
    setInput(nextInput);
    setCursorPosition(nextCursorPosition);
  }, [
    history,
    historySearch.draftCursorPosition,
    historySearch.draftInput,
    historySearch.matchIndex,
    historySearch.query,
    setCursorPosition,
    setInput,
  ]);

  const ignoreHistorySearchTextInput = useCallback(() => undefined, []);

  return {
    acceptHistorySearch,
    cancelHistorySearch,
    cycleHistorySearch,
    historySearch,
    ignoreHistorySearchTextInput,
    resetHistorySearch,
    startHistorySearch,
    updateHistorySearchQuery,
  };
}
