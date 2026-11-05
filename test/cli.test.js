import test from 'node:test';
import assert from 'node:assert/strict';

import { parseArgs } from '../src/cli.js';

test('parse a plain day number', () => {
  const options = parseArgs(['node', 'catfishing', '865']);
  assert.equal(options.command, 'play');
  assert.equal(options.day, 865);
});

test('parse an ISO date', () => {
  const options = parseArgs(['node', 'catfishing', '2026-11-04']);
  assert.equal(options.command, 'play');
  assert.equal(options.date, '2026-11-04');
});

test('parse a command with a day', () => {
  const options = parseArgs(['node', 'catfishing', 'result', '865']);
  assert.equal(options.command, 'result');
  assert.equal(options.day, 865);
});

test('parse archive limit as a positional argument', () => {
  const options = parseArgs(['node', 'catfishing', 'archive', '30']);
  assert.equal(options.command, 'archive');
  assert.equal(options.limit, 30);
});

test('parse flags', () => {
  const options = parseArgs([
    'node',
    'catfishing',
    'play',
    '--day',
    '864',
    '--replay',
    '--flat',
    '--json',
  ]);
  assert.equal(options.command, 'play');
  assert.equal(options.day, 864);
  assert.equal(options.replay, true);
  assert.equal(options.flat, true);
  assert.equal(options.json, true);
});

test('unknown options are rejected', () => {
  assert.throws(
    () => parseArgs(['node', 'catfishing', '--wat']),
    /Unknown option/,
  );
});
