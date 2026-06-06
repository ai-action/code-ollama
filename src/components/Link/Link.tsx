import { Text, type TextProps } from 'ink';

import { useTheme } from '@/contexts';

interface Props extends Omit<TextProps, 'children'> {
  children?: string;
  href: string;
}

function terminalLink(href: string, label: string): string {
  return `\u001B]8;;${href}\u0007${label}\u001B]8;;\u0007`;
}

export function Link({ children, href, ...textProps }: Props) {
  const theme = useTheme();
  const label = children ?? href;

  return (
    <Text color={theme.colors.command} {...textProps}>
      {terminalLink(href, label)}
    </Text>
  );
}
