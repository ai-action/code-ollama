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
      <Text bold underline>
        Session Stats
      </Text>

      <Text>
        <Text color={theme.colors.secondary}>Calls: </Text>
        <Text>{formatNumber(stats.modelCalls)}</Text>
        <Text color={theme.colors.secondary}> {UI.BULLET} Input: </Text>
        <Text>{formatNumber(stats.promptTokens)}</Text>
        <Text color={theme.colors.secondary}> {UI.BULLET} Output: </Text>
        <Text>{formatNumber(stats.outputTokens)}</Text>
        <Text color={theme.colors.secondary}> {UI.BULLET} Ollama time: </Text>
        <Text>{formatDuration(stats.totalDurationNs)}</Text>
      </Text>

      {models.length > 1 && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold underline>
            Models
          </Text>

          {models.map(([name, model]) => (
            <Text key={name}>
              <Text color={theme.colors.model}>{name}</Text>
              <Text color={theme.colors.secondary}>: </Text>
              <Text>{formatNumber(model.calls)}</Text>
              <Text color={theme.colors.secondary}>
                {' '}
                {model.calls === 1 ? 'call' : 'calls'} {UI.BULLET}{' '}
              </Text>
              <Text>{formatNumber(model.promptTokens)}</Text>
              <Text color={theme.colors.secondary}> in {UI.BULLET} </Text>
              <Text>{formatNumber(model.outputTokens)}</Text>
              <Text color={theme.colors.secondary}> out {UI.BULLET} </Text>
              <Text>{formatDuration(model.totalDurationNs)}</Text>
            </Text>
          ))}
        </Box>
      )}

      {lastCall && (
        <Box flexDirection="column" marginTop={1}>
          <Text>
            <Text bold underline>
              Last Call
            </Text>{' '}
            — <Text color={theme.colors.model}>{lastCall.model}</Text>
          </Text>

          <Text>
            <Text>{formatNumber(lastCall.promptTokens)}</Text>
            <Text color={theme.colors.secondary}> in {UI.BULLET} </Text>
            <Text>{formatNumber(lastCall.outputTokens)}</Text>
            <Text color={theme.colors.secondary}> out {UI.BULLET} </Text>
            <Text>{formatDuration(lastCall.totalDurationNs)}</Text>
            <Text color={theme.colors.secondary}> total</Text>
          </Text>

          <Text>
            <Text color={theme.colors.secondary}>Load </Text>
            <Text>{formatDuration(lastCall.loadDurationNs)}</Text>
            <Text color={theme.colors.secondary}> {UI.BULLET} Prompt </Text>
            <Text>{formatDuration(lastCall.promptEvalDurationNs)}</Text>
            <Text color={theme.colors.secondary}> (</Text>
            <Text color={theme.colors.command}>
              {formatRate(lastCall.promptTokens, lastCall.promptEvalDurationNs)}
            </Text>
            <Text color={theme.colors.secondary}>) {UI.BULLET} Generate </Text>
            <Text>{formatDuration(lastCall.evalDurationNs)}</Text>
            <Text color={theme.colors.secondary}> (</Text>
            <Text color={theme.colors.command}>
              {formatRate(lastCall.outputTokens, lastCall.evalDurationNs)}
            </Text>
            <Text color={theme.colors.secondary}>)</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
}
