import { homedir } from 'node:os';
import { join } from 'node:path';

import { NAME } from './package';

export const DIRECTORY = join(homedir(), `.${NAME}`);
