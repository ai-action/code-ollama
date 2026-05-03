#!/usr/bin/env node

import cac from 'cac';
import { render } from 'ink';

import { App } from './components';
import { PACKAGE } from './constants';
import { screen } from './utils';

const cli = cac('code-ollama');

cli.version(PACKAGE.VERSION);
cli.help();

export function main(args: string[] = process.argv.slice(2)): void {
  if (!args.length) {
    screen.clear();
    render(<App />);
    return;
  }

  cli.parse(['node', 'code-ollama', ...args]);
}

// v8 ignore next 3
if (process.argv[1] === import.meta.filename) {
  main();
}
