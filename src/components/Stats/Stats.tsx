import { Box, Text } from 'ink';

import { UI } from '@/constants';
import { useTheme } from '@/contexts';
import type { SessionStats } from '@/utils/session';

interface Props {
  stats?: SessionStats;
}

const numberFormatter = new Intl.NumberFormat('en-US');
const rateFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatDuration(nanoseconds: number): string {
  const milliseconds = nanoseconds / 1_000_000;
  if (milliseconds < 1_000) {
    return `${String(Math.round(milliseconds))}ms`;
  }

  const seconds = milliseconds / 1_000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(seconds / 60);
  return `${String(minutes)}m ${(seconds % 60).toFixed(1)}s`;
}

function formatRate(tokens: number, nanoseconds: number): string {
  if (nanoseconds <= 0) {
    return '—';
  }

  return `${rateFormatter.format(tokens / (nanoseconds / 1_000_000_000))} tok/s`;
}

export function Stats({ stats }: Props) {
  const theme = useTheme();

  if (!stats?.modelCalls) {
    return (
      <Box marginBottom={1} marginX={UI.SCREEN_MARGIN_X}>
        <Text color={theme.colors.secondary} dimColor>
          No model usage recorded for this session.
        </Text>
      </Box>
    );
  }

  const models = Object.entries(stats.models).sort(
    ([firstName, first], [secondName, second]) =>
      second.calls - first.calls || firstName.localeCompare(secondName),
  );
  const lastCall = stats.lastCall;

  return (
    <Box
      borderColor={theme.colors.border}
      borderStyle="bold"
      flexDirection="column"
      marginBottom={1}
      marginX={UI.SCREEN_MARGIN_X}
      paddingX={1}
    >
      <Text bold>Session stats</Text>
      <Text color={theme.colors.secondary}>
        Calls: {formatNumber(stats.modelCalls)} · Input:{' '}
        {formatNumber(stats.promptTokens)} · Output:{' '}
        {formatNumber(stats.outputTokens)} · Ollama time:{' '}
        {formatDuration(stats.totalDurationNs)}
      </Text>

      <Box flexDirection="column" marginTop={1}>
        <Text bold>Models</Text>
        {models.map(([name, model]) => (
          <Text key={name} color={theme.colors.secondary}>
            <Text color={theme.colors.model}>{name}</Text>: {model.calls}{' '}
            {model.calls === 1 ? 'call' : 'calls'} ·{' '}
            {formatNumber(model.promptTokens)} in ·{' '}
            {formatNumber(model.outputTokens)} out ·{' '}
            {formatDuration(model.totalDurationNs)}
          </Text>
        ))}
      </Box>

      {lastCall && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            Last call — <Text color={theme.colors.model}>{lastCall.model}</Text>
          </Text>
          <Text color={theme.colors.secondary}>
            {formatNumber(lastCall.promptTokens)} in ·{' '}
            {formatNumber(lastCall.outputTokens)} out ·{' '}
            {formatDuration(lastCall.totalDurationNs)} total
          </Text>
          <Text color={theme.colors.secondary}>
            Load {formatDuration(lastCall.loadDurationNs)} · Prompt{' '}
            {formatDuration(lastCall.promptEvalDurationNs)} (
            {formatRate(lastCall.promptTokens, lastCall.promptEvalDurationNs)})
            · Generate {formatDuration(lastCall.evalDurationNs)} (
            {formatRate(lastCall.outputTokens, lastCall.evalDurationNs)})
          </Text>
        </Box>
      )}
    </Box>
  );
}
