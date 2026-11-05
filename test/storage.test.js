import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  completedGames,
  configDir,
  emptyStore,
  getGame,
  listGames,
  loadStore,
  putGame,
  removeGame,
  saveStore,
  storePath,
} from '../src/storage.js';

const previousHome = process.env.CATFISHING_HOME;
const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), 'catfishing-cli-test-'));

beforeEach(() => {
  process.env.CATFISHING_HOME = tempHome;
  fs.rmSync(path.join(tempHome, 'results.json'), { force: true });
});

after(() => {
  if (previousHome === undefined) delete process.env.CATFISHING_HOME;
  else process.env.CATFISHING_HOME = previousHome;
  fs.rmSync(tempHome, { recursive: true, force: true });
});

test('a missing store starts empty', () => {
  const store = loadStore();
  assert.equal(store.version, 1);
  assert.deepEqual(store.games, {});
});

test('games round-trip through the store', () => {
  const store = loadStore();
  const game = {
    day: 865,
    date: '2026-11-05',
    total: 10,
    answers: [{ result: 'correct', title: 'Gonzo (Muppet)' }],
    completed: true,
    corrects: 1,
    closes: 0,
    score: 1,
  };

  putGame(store, game);

  const reloaded = loadStore();
  assert.deepEqual(getGame(reloaded, 865), game);
  assert.equal(listGames(reloaded).length, 1);
  assert.equal(completedGames(reloaded).length, 1);
  assert.equal(storePath(), path.join(tempHome, 'results.json'));
  assert.equal(configDir(), tempHome);
});

test('the store file is created with private permissions', () => {
  const store = emptyStore();
  saveStore(store);
  const mode = fs.statSync(storePath()).mode & 0o777;
  assert.equal(mode, 0o600);
});

test('removing a game updates the store', () => {
  const store = loadStore();
  putGame(store, { day: 865, completed: true, answers: [], total: 10 });
  assert.equal(removeGame(store, 865), true);
  assert.equal(removeGame(store, 865), false);
  assert.equal(getGame(loadStore(), 865), null);
});

test('a corrupt store is reported instead of silently discarded', () => {
  fs.mkdirSync(tempHome, { recursive: true });
  fs.writeFileSync(storePath(), '{not json');
  assert.throws(() => loadStore(), /not valid JSON/);
});
