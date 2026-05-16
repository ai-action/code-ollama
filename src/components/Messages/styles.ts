import { ROLE } from '../../constants';
import type { ThemeDefinition } from '../../types';

export function getMessageColor(
  role: string,
  theme: ThemeDefinition,
): string | undefined {
  switch (role) {
    case ROLE.USER:
      return undefined;
    case ROLE.ASSISTANT:
      return theme.colors.messageAssistant;
    case ROLE.SYSTEM:
      return theme.colors.messageSystem;
    default:
      return undefined;
  }
}
