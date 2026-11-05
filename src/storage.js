import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const STORE_VERSION = 1;

export class StoreError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StoreError';
  }
}

export function configDir() {
  if (process.env.CATFISHING_HOME) return process.env.CATFISHING_HOME;

  if (process.platform === 'win32') {
    const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, 'catfishing-cli');
  }

  const configHome =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'catfishing-cli');
}

export function storePath() {
  return path.join(configDir(), 'results.json');
}

export function emptyStore() {
  const now = new Date().toISOString();
  return {
    version: STORE_VERSION,
    createdAt: now,
    updatedAt: now,
    games: {},
  };
}

export function loadStore() {
  const file = storePath();
  if (!fs.existsSync(file)) return emptyStore();

  let raw;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new StoreError(`Could not read your saved results at ${file}: ${error.message}`);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (error) {
    throw new StoreError(
      `Your saved results at ${file} are not valid JSON. ` +
        `Move that file somewhere safe and try again. (${error.message})`,
    );
  }

  if (!data || typeof data !== 'object' || !data.games || typeof data.games !== 'object') {
    throw new StoreError(
      `Your saved results at ${file} have an unexpected shape. ` +
        `Move that file somewhere safe and try again.`,
    );
  }

  if (!Number.isInteger(data.version)) data.version = STORE_VERSION;
  if (!data.createdAt) data.createdAt = new Date().toISOString();
  if (!data.updatedAt) data.updatedAt = data.createdAt;
  return data;
}

export function saveStore(store) {
  const dir = configDir();
  const file = storePath();
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });

  store.version = STORE_VERSION;
  store.updatedAt = new Date().toISOString();

  const temp = `${file}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(temp, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(temp, file);
    try {
      fs.chmodSync(file, 0o600);
    } catch {
      // Best effort on platforms that do not support chmod.
    }
  } catch (error) {
    try {
      fs.unlinkSync(temp);
    } catch {
      // Ignore cleanup errors.
    }
    throw new StoreError(`Could not save your results at ${file}: ${error.message}`);
  }
}

export function getGame(store, day) {
  return store.games[String(day)] ?? null;
}

export function putGame(store, game) {
  store.games[String(game.day)] = game;
  saveStore(store);
  return game;
}

export function removeGame(store, day) {
  if (store.games[String(day)]) {
    delete store.games[String(day)];
    saveStore(store);
    return true;
  }
  return false;
}

export function listGames(store) {
  return Object.values(store.games).sort((a, b) => a.day - b.day);
}

export function completedGames(store) {
  return listGames(store).filter((game) => game.completed);
}
