import { ROLE } from '@/constants';
import type { ThemeDefinition } from '@/types';

export function getMessageColor(
  role: string,
  theme: ThemeDefinition,
  content = '',
): string | undefined {
  switch (role) {
    case ROLE.USER:
      return undefined;
    case ROLE.ASSISTANT:
      return content.startsWith('Error:') ? theme.colors.error : undefined;
    case ROLE.SYSTEM:
      return theme.colors.messageSystem;
    default:
      return undefined;
  }
}
