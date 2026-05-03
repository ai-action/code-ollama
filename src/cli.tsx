#!/usr/bin/env node

import cac from 'cac';
import { render } from 'ink';

import pkg from '../package.json' with { type: 'json' };
import { App } from './components';
import { clear } from './utils';

const cli = cac('code-ollama');

cli.version(pkg.version);
cli.help();

export function main(args: string[] = process.argv.slice(2)): void {
  if (!args.length) {
    clear();
    render(<App />);
    return;
  }

  cli.parse(['node', 'code-ollama', ...args]);
}

// v8 ignore next 3
if (process.argv[1] === import.meta.filename) {
  main();
}
