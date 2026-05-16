import { ROLE } from '@/constants';
import type { ThemeDefinition } from '@/types';

export function getMessageColor(
  role: string,
  theme: ThemeDefinition,
): string | undefined {
  switch (role) {
    case ROLE.USER:
    case ROLE.ASSISTANT:
      return undefined;
    case ROLE.SYSTEM:
      return theme.colors.messageSystem;
    default:
      return undefined;
  }
}
