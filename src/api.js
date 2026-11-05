import {
  MIN_DAY,
  formatDayDate,
  todayDay,
} from './day.js';
import { buildArticle } from './game.js';

const HOSTS = ['https://catfishing.net', 'https://categoryfishing.net'];
const USER_AGENT = 'catfishing-cli/1.0 (unofficial terminal client)';

export class GameError extends Error {
  constructor(message, code = 'game-error') {
    super(message);
    this.name = 'GameError';
    this.code = code;
  }
}

function invalidDayMessage(day) {
  const today = todayDay();
  if (day < MIN_DAY) {
    return `The archive starts at day ${MIN_DAY} (${formatDayDate(MIN_DAY)}).`;
  }
  if (day > today) {
    return `Day ${day} is in the future. Today is day ${today} (${formatDayDate(today)}). New games unlock at midnight, local time.`;
  }
  return `Day ${day} is not available. The server said "Invalid day".`;
}

function validateGameData(data) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.articles)) {
    throw new GameError('The server returned an unexpected response.', 'bad-data');
  }

  const articles = data.articles.map(buildArticle);
  const previews = Array.isArray(data.previews) ? data.previews : [];
  const stats = data.stats && typeof data.stats === 'object' ? data.stats : {};

  return { articles, previews, stats };
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchGame(day, { timeout = 15000, retries = 1 } = {}) {
  if (!Number.isInteger(day) || day < MIN_DAY) {
    throw new GameError(invalidDayMessage(day), 'invalid-day');
  }

  for (const host of HOSTS) {
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response;
      try {
        response = await fetch(`${host}/app/game?day=${day}`, {
          headers: {
            accept: 'application/json',
            'user-agent': USER_AGENT,
          },
          signal: AbortSignal.timeout(timeout),
        });
      } catch {
        if (attempt < retries) {
          await delay(350);
          continue;
        }
        break;
      }

      if (response.status === 400) {
        let body = null;
        try {
          body = await response.json();
        } catch {
          // Ignore an unreadable error body.
        }
        throw new GameError(
          body?.message === 'Invalid day' ? invalidDayMessage(day) : `The server said: ${body?.message ?? 'Bad request'}.`,
          'invalid-day',
        );
      }

      if (!response.ok) {
        if (response.status >= 500 && attempt < retries) {
          await delay(350);
          continue;
        }
        break;
      }

      try {
        return validateGameData(await response.json());
      } catch (error) {
        if (error instanceof GameError) throw error;
        break;
      }
    }
  }

  throw new GameError(
    'Could not reach catfishing.net. Check your connection and try again.',
    'network',
  );
}
