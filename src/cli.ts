#!/usr/bin/env node

import cac from 'cac';

const cli = cac('code-ollama');

cli.version('0.0.0');
cli.help();

export function main(args: string[] = process.argv.slice(2)): void {
  if (!args.length) {
    cli.outputHelp();
    return;
  }

  cli.parse(['node', 'code-ollama', ...args]);
}

// v8 ignore next 3
if (process.argv[1] === import.meta.filename) {
  main();
}
