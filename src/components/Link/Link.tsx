import { Text, type TextProps } from 'ink';

import { THEME } from '@/constants';
import type { ThemeDefinition } from '@/types';

interface Props extends Omit<TextProps, 'children'> {
  children?: string;
  href: string;
  theme?: ThemeDefinition;
}

function terminalLink(href: string, label: string): string {
  return `\u001B]8;;${href}\u0007${label}\u001B]8;;\u0007`;
}

export function Link({
  children,
  href,
  theme = THEME.getTheme(),
  ...textProps
}: Props) {
  const label = children ?? href;

  return (
    <Text color={theme.colors.command} {...textProps}>
      {terminalLink(href, label)}
    </Text>
  );
}
