import { ROLE } from '../../constants';

export function getMessageColor(role: string): string | undefined {
  switch (role) {
    case ROLE.USER:
      return 'black';
    case ROLE.ASSISTANT:
      return 'cyan';
    case ROLE.SYSTEM:
      return 'gray';
    default:
      return undefined;
  }
}
