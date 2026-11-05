#!/usr/bin/env node
import { main } from '../src/cli.js';
import { C, paint } from '../src/ui.js';

process.stdout.on('error', (error) => {
  if (error.code === 'EPIPE') process.exit(0);
  throw error;
});

main(process.argv).catch((error) => {
  if (error?.name === 'PromptAbort') {
    process.exitCode = 130;
    return;
  }
  console.error(
    error?.message
      ? `\n  ${paint(C.red, '✘')} ${error.message}\n`
      : error,
  );
  process.exitCode = 1;
});
