import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { fetchGame, GameError } from './api.js';
import {
  MIN_DAY,
  dayFromIso,
  formatDayDate,
  isoDateForDay,
  todayDay,
} from './day.js';
import { RESULT, checkGuess, tally } from './game.js';
import { PromptAbort, Prompter } from './input.js';
import { shareText } from './share.js';
import {
  completedGames,
  getGame,
  loadStore,
  putGame,
  storePath,
} from './storage.js';
import {
  computeStats,
  globalSnapshot,
} from './stats.js';
import {
  C,
  indentLines,
  paint,
  setColorEnabled,
} from './ui.js';
import * as views from './views.js';

const COMMANDS = new Set([
  'play',
  'today',
  'archive',
  'stats',
  'result',
  'results',
  'share',
  'help',
  'version',
]);

const VERSION = readVersion();

function readVersion() {
  try {
    const packageFile = fileURLToPath(new URL('../package.json', import.meta.url));
    return JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
  } catch {
    return '1.0.0';
  }
}

function print(lines) {
  const safeLines = Array.isArray(lines) ? lines : [String(lines)];
  const flat = safeLines.flatMap((line) => String(line).split('\n'));
  process.stdout.write(`${indentLines(flat, 2).join('\n')}\n`);
}

function printJson(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    command: null,
    day: null,
    date: null,
    replay: false,
    force: false,
    flat: false,
    json: false,
    all: false,
    limit: 14,
    help: false,
    version: false,
  };
  const positional = [];

  const takeValue = (index, flag) => {
    const value = args[index + 1];
    if (value == null || value.startsWith('-')) {
      throw new GameError(`${flag} needs a value.`);
    }
    return value;
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--version' || arg === '-v') options.version = true;
    else if (arg === '--replay') options.replay = true;
    else if (arg === '--force' || arg === '-f') options.force = true;
    else if (arg === '--flat') options.flat = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--all') options.all = true;
    else if (arg === '--no-color') setColorEnabled(false);
    else if (arg === '--day' || arg === '-d') {
      const value = takeValue(index, arg);
      index += 1;
      options.day = Number(value);
    } else if (arg === '--date') {
      options.date = takeValue(index, '--date');
      index += 1;
    } else if (arg === '--limit' || arg === '-n') {
      const value = Number(takeValue(index, arg));
      if (!Number.isInteger(value) || value < 1) {
        throw new GameError('--limit needs a positive whole number.');
      }
      options.limit = value;
      index += 1;
    } else if (arg === '--') {
      positional.push(...args.slice(index + 1));
      break;
    } else if (arg.startsWith('-')) {
      throw new GameError(`Unknown option: ${arg}. Try catfishing --help.`);
    } else {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    if (!options.command && COMMANDS.has(positional[0])) {
      options.command = positional.shift();
    } else if (!options.command) {
      options.command = 'play';
    }

    if (positional.length > 0) {
      if (options.command === 'play' || options.command === 'result' || options.command === 'results' || options.command === 'share') {
        const value = positional.shift();
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) options.date = value;
        else options.day = Number(value);
      } else if (options.command === 'archive') {
        const value = Number(positional[0]);
        if (Number.isInteger(value) && value > 0) {
          options.limit = value;
          positional.shift();
        }
      }
    }

    if (positional.length > 0) {
      throw new GameError(`Unexpected argument: ${positional[0]}`);
    }
  }

  if (!options.command) options.command = 'play';
  if (options.command === 'today') options.command = 'play';
  if (options.command === 'results') options.command = 'result';
  return options;
}

function resolveDay(options) {
  if (options.date) {
    const day = dayFromIso(options.date);
    if (day == null) {
      throw new GameError(`"${options.date}" is not a valid date. Use YYYY-MM-DD.`);
    }
    return day;
  }
  if (options.day != null) {
    if (!Number.isInteger(options.day)) {
      throw new GameError(`"${options.day}" is not a valid day number.`);
    }
    return options.day;
  }
  return todayDay();
}

function validateDay(day) {
  if (day < MIN_DAY) {
    throw new GameError(
      `Day ${day} is before the archive. The public archive starts at day ${MIN_DAY} (${formatDayDate(MIN_DAY)}).`,
    );
  }
}

function newRecord(day, total) {
  const now = new Date().toISOString();
  return {
    day,
    date: isoDateForDay(day),
    total,
    answers: [],
    completed: false,
    startedAt: now,
    updatedAt: now,
    corrects: 0,
    closes: 0,
    score: 0,
    emojiSet: 'default',
  };
}

function persist(store, record, stats = null) {
  if (record.answers.length === 0 && !record.completed) return;

  if (record.answers.length > record.total) {
    record.answers = record.answers.slice(0, record.total);
  }

  const totals = tally(record.answers);
  record.corrects = totals.corrects;
  record.closes = totals.closes;
  record.score = totals.score;
  record.updatedAt = new Date().toISOString();

  const wasComplete = record.completed;
  record.completed = record.answers.length >= record.total;
  if (record.completed && !wasComplete) {
    record.completedAt = record.updatedAt;
    const started = Date.parse(record.startedAt);
    if (Number.isFinite(started)) {
      record.durationMs = Math.max(0, Date.now() - started);
    }
    if (stats) {
      const snapshot = globalSnapshot(stats);
      if (snapshot) record.global = snapshot;
      if (stats.emojiSet) record.emojiSet = stats.emojiSet;
    }
  } else if (record.completed && stats && !record.global) {
    const snapshot = globalSnapshot(stats);
    if (snapshot) record.global = snapshot;
  }

  putGame(store, record);
}

function questionStatsFor(stats, index) {
  const articleStats = Array.isArray(stats?.articles) ? stats.articles[index] : null;
  if (!articleStats) return null;
  return {
    ...articleStats,
    played: Number(stats.played) || 0,
  };
}

function answerWithMetadata(article, answer, stats, index) {
  const questionStats = questionStatsFor(stats, index);
  return {
    ...answer,
    title: article.title,
    correctRate: Number.isFinite(Number(questionStats?.correctRate))
      ? Number(questionStats.correctRate)
      : undefined,
    closeRate: Number.isFinite(Number(questionStats?.closeRate))
      ? Number(questionStats.closeRate)
      : undefined,
  };
}

async function askGuess(prompter, article) {
  while (true) {
    const value = await prompter.line(`  ${paint(C.emerald, '❯', { bold: true })} `);
    const guess = value.trim();

    if (!guess) continue;
    if (guess === '/quit' || guess === '/exit') return { action: 'quit' };
    if (guess === '/skip' || guess === '/s') return { action: 'skip' };
    if (guess === '/help' || guess === '?') {
      print([
        '',
        `${paint(C.amber, 'enter')}        submit a guess`,
        `${paint(C.amber, '/skip')}        skip this question`,
        `${paint(C.amber, '/quit')}        save and exit`,
        '',
      ]);
      continue;
    }

    const check = checkGuess(guess, article);
    if (check.kind === 'correct') {
      return {
        action: 'answer',
        answer: { result: RESULT.CORRECT, guess: check.guess, matchedName: check.matchedName },
      };
    }

    if (check.kind === 'dym') {
      const prompt = `  Did you mean ${paint(C.amber, check.matchedName, { bold: true })}? ${paint(C.faint, '[y/N]')} `;
      const reply = await prompter.key(prompt, { valid: ['y', 'n'], defaultKey: 'n' });
      if (reply === 'y') {
        return {
          action: 'answer',
          answer: {
            result: RESULT.CORRECT,
            guess: check.guess,
            dym: true,
            matchedName: check.matchedName,
          },
        };
      }
      return {
        action: 'answer',
        answer: { result: RESULT.INCORRECT, guess: check.guess },
      };
    }

    return {
      action: 'answer',
      answer: { result: RESULT.INCORRECT, guess: check.guess },
    };
  }
}

async function confirmReplay(prompter, day) {
  const reply = await prompter.key(
    `  Day ${day} already has a saved game. Restart and overwrite it? ${paint(C.faint, '[y/N]')} `,
    { valid: ['y', 'n'], defaultKey: 'n' },
  );
  return reply === 'y';
}

async function playCommand(options, prompter) {
  const store = loadStore();
  const day = resolveDay(options);
  validateDay(day);
  const existing = getGame(store, day);

  if (existing?.completed && !options.replay) {
    print(
      views.renderResult({
        record: existing,
        global: existing.global,
        storeFile: storePath(),
      }),
    );
    print([
      '',
      `${paint(C.amber, 'replay')}  ${paint(C.muted, `catfishing play ${day} --replay`)}  ${paint(C.faint, '·')}  ${paint(C.muted, 'catfishing archive')}`,
      '',
    ]);
    return;
  }

  if (options.replay && existing && (existing.answers?.length ?? 0) > 0) {
    if (!options.force) {
      if (!prompter.interactive) {
        throw new GameError('Use --force to overwrite a saved game in non-interactive mode.');
      }
      if (!(await confirmReplay(prompter, day))) {
        print(['', paint(C.muted, 'Nothing changed.'), '']);
        return;
      }
    }
  }

  const data = await fetchGame(day);
  const total = data.articles.length;
  const record =
    existing && !options.replay
      ? existing
      : newRecord(day, total);

  record.total = total;
  record.date = isoDateForDay(day);
  if (!record.startedAt) record.startedAt = new Date().toISOString();
  if (!record.emojiSet) record.emojiSet = data.stats.emojiSet || 'default';

  if ((record.answers?.length ?? 0) > 0 && !record.completed) {
    print(
      views.renderNotice(
        `Resuming day ${day} — ${record.answers.length} of ${total} answered.`,
      ),
    );
  }

  let index = record.answers.length;
  let skippedHidden = false;
  while (index < total && data.articles[index]?.hidden) {
    record.answers.push({
      result: RESULT.NOT_SHOWN,
      title: data.articles[index].title,
    });
    index += 1;
    skippedHidden = true;
  }
  if (skippedHidden) persist(store, record, data.stats);

  try {
    while (index < total) {
      const article = data.articles[index];
      const preview = data.previews[index] ?? {};

      print(
        views.renderQuestion({
          day,
          date: record.date,
          index,
          total,
          answers: record.answers,
          score: record.score,
          article,
          flat: options.flat,
        }),
      );

      const outcome = await askGuess(prompter, article);

      if (outcome.action === 'quit') {
        persist(store, record, data.stats);
        print([
          '',
          `${paint(C.amber, 'saved')}  ${record.answers.length} of ${total} answered. Resume with ${paint(C.cream, `catfishing play ${day}`)}.`,
          '',
        ]);
        return;
      }

      let answer;
      if (outcome.action === 'skip') {
        answer = { result: RESULT.SKIPPED };
      } else {
        answer = outcome.answer;
      }
      answer = answerWithMetadata(article, answer, data.stats, index);
      record.answers.push(answer);

      print('');
      print(
        views.renderAnswer({
          article,
          preview,
          answer,
          questionStats: questionStatsFor(data.stats, index),
        }),
      );
      print('');

      if (answer.result === RESULT.INCORRECT) {
        const choice = await prompter.line(
          `  ${paint(C.amber, 'c')} ${paint(C.muted, 'close enough')}  ${paint(C.faint, '· enter to continue')} `,
        );
        const reply = choice.trim().toLowerCase();
        if (reply === '/quit' || reply === '/exit') {
          persist(store, record, data.stats);
          print([
            '',
            `${paint(C.amber, 'saved')}  ${record.answers.length} of ${total} answered. Resume with ${paint(C.cream, `catfishing play ${day}`)}.`,
            '',
          ]);
          return;
        }
        if (reply === 'c') {
          answer.result = RESULT.CLOSE;
          print(views.renderNotice('Marked close enough — half a mark.'));
        }
      } else {
        const prompt =
          record.answers.length < total
            ? `  ${paint(C.faint, 'enter to continue')} `
            : `  ${paint(C.faint, 'enter to see your result')} `;
        const reply = await prompter.line(prompt);
        if (['/quit', '/exit'].includes(reply.trim().toLowerCase())) {
          persist(store, record, data.stats);
          print([
            '',
            `${paint(C.amber, 'saved')}  ${record.answers.length} of ${total} answered. Resume with ${paint(C.cream, `catfishing play ${day}`)}.`,
            '',
          ]);
          return;
        }
      }

      persist(store, record, data.stats);
      index = record.answers.length;

      while (index < total && data.articles[index]?.hidden) {
        record.answers.push({
          result: RESULT.NOT_SHOWN,
          title: data.articles[index].title,
        });
        index += 1;
      }
      if (record.answers.length !== index) persist(store, record, data.stats);
    }
  } catch (error) {
    if (error instanceof PromptAbort) {
      persist(store, record, data.stats);
      print([
        '',
        `${paint(C.amber, 'saved')}  ${record.answers.length} of ${total} answered. Resume with ${paint(C.cream, `catfishing play ${day}`)}.`,
        '',
      ]);
      return;
    }
    throw error;
  }

  persist(store, record, data.stats);
  print(
    views.renderSummary({
      record,
      global: record.global,
      storeFile: storePath(),
    }),
  );
}

function archiveCommand(options) {
  const store = loadStore();
  const today = todayDay();
  const limit = options.all ? today - MIN_DAY + 1 : options.limit;
  const rows = [];

  for (let day = today; day >= MIN_DAY && rows.length < limit; day -= 1) {
    rows.push({ day, record: getGame(store, day) });
  }

  const stats = computeStats(completedGames(store), { today });

  if (options.json) {
    printJson(
      rows.map(({ day, record }) => ({
        day,
        date: isoDateForDay(day),
        status: record?.completed ? 'completed' : record ? 'inProgress' : 'unplayed',
        record,
      })),
    );
    return;
  }

  print(
    views.renderArchive({
      rows,
      summary: stats,
      storeFile: storePath(),
    }),
  );
}

function statsCommand(options) {
  const store = loadStore();
  const today = todayDay();
  const stats = computeStats(completedGames(store), { today });
  const recent = completedGames(store)
    .sort((a, b) => b.day - a.day)
    .slice(0, 7)
    .map((record) => ({ day: record.day, record }));

  if (options.json) {
    printJson({ stats, recent });
    return;
  }

  print(
    views.renderStats({
      stats,
      recentRows: recent,
      storeFile: storePath(),
    }),
  );
}

function resultCommand(options) {
  const store = loadStore();
  const day = resolveDay(options);
  validateDay(day);
  const record = getGame(store, day);

  if (!record) {
    throw new GameError(
      `No saved game for day ${day} (${formatDayDate(day)}). Play it with: catfishing play ${day}`,
    );
  }

  if (options.json) {
    printJson(record);
    return;
  }

  print(
    views.renderResult({
      record,
      global: record.global,
      storeFile: storePath(),
    }),
  );
}

function shareCommand(options) {
  const store = loadStore();
  const day = resolveDay(options);
  validateDay(day);
  const record = getGame(store, day);

  if (!record || (record.answers?.length ?? 0) === 0) {
    throw new GameError(`No saved game for day ${day}. Play it first with: catfishing play ${day}`);
  }
  if (!record.completed) {
    throw new GameError(
      `Day ${day} is not finished yet (${record.answers.length} of ${record.total}). Resume with: catfishing play ${day}`,
    );
  }

  const text = shareText({
    day: record.day,
    answers: record.answers,
    score: record.score,
    corrects: record.corrects,
    closes: record.closes,
    setName: record.emojiSet,
  });

  if (options.json) {
    printJson({ day, text });
    return;
  }

  process.stdout.write(`${text}\n`);
}

export async function main(argv = process.argv) {
  const options = parseArgs(argv);

  if (options.help) {
    print(views.renderHelp());
    return;
  }
  if (options.version) {
    process.stdout.write(`catfishing-cli ${VERSION}\n`);
    return;
  }

  const prompter = new Prompter();

  try {
    switch (options.command) {
      case 'play':
        await playCommand(options, prompter);
        break;
      case 'archive':
        archiveCommand(options);
        break;
      case 'stats':
        statsCommand(options);
        break;
      case 'result':
        resultCommand(options);
        break;
      case 'share':
        shareCommand(options);
        break;
      case 'help':
        print(views.renderHelp());
        break;
      case 'version':
        process.stdout.write(`catfishing-cli ${VERSION}\n`);
        break;
      default:
        throw new GameError(`Unknown command: ${options.command}. Try catfishing --help.`);
    }
  } finally {
    prompter.close();
  }
}

export { parseArgs };
