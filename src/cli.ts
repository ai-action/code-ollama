#!/usr/bin/env node

const name = 'code-ollama';

export function main(args: string[] = process.argv.slice(2)): void {
  if (args.includes('--version') || args.includes('-v')) {
    console.log(name); // eslint-disable-line no-console
  } else {
    console.log(`${name} – use --version to print the name`); // eslint-disable-line no-console
  }
}

// c8 ignore next 3
if (process.argv[1] === import.meta.filename) {
  main();
}
