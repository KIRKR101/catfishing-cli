import {
  MAX_SCORE,
  RESULT,
  formatScore,
  groupCategories,
  splitTitle,
} from './game.js';
import {
  emojiRows,
  shareText,
} from './share.js';
import {
  align,
  C,
  centre,
  flow,
  gradient,
  gradientBar,
  gradientRule,
  layout,
  link,
  paint,
  panelRaw,
  padEnd,
  padStart,
  pill,
  rule,
  shade,
  truncate,
  visibleWidth,
  wrap,
} from './ui.js';
import {
  MIN_DAY,
  formatDayDate,
} from './day.js';

const SYMBOL = {
  [RESULT.CORRECT]: '✔',
  [RESULT.CLOSE]: '◐',
  [RESULT.INCORRECT]: '✘',
  [RESULT.SKIPPED]: '–',
  [RESULT.NOT_SHOWN]: '·',
};

const COLOR = {
  [RESULT.CORRECT]: C.emerald,
  [RESULT.CLOSE]: C.amber,
  [RESULT.INCORRECT]: C.red,
  [RESULT.SKIPPED]: C.faint,
  [RESULT.NOT_SHOWN]: C.faint,
};

const LABEL = {
  [RESULT.CORRECT]: 'Correct',
  [RESULT.CLOSE]: 'Close enough',
  [RESULT.INCORRECT]: 'Not quite',
  [RESULT.SKIPPED]: 'Skipped',
  [RESULT.NOT_SHOWN]: 'Hidden',
};

const faint = (text) => paint(C.faint, text, { dim: true });
const muted = (text) => paint(C.muted, text);
const cream = (text) => paint(C.cream, text);
const amber = (text) => paint(C.amber, text);
const emerald = (text) => paint(C.emerald, text);
const boldCream = (text) => paint(C.cream, text, { bold: true });
const boldAmber = (text) => paint(C.amber, text, { bold: true });
const violet = (text) => paint(C.violet, text);
const key = (text) => paint(C.cream, text, { bold: true });
const section = (text) => `${paint(C.emerald, '▎')} ${boldCream(text)}`;

export function scoreColor(score) {
  if (score >= MAX_SCORE) return C.emeraldSoft;
  if (score >= 7) return C.emerald;
  if (score >= 4) return C.amber;
  if (score > 0) return C.rose;
  return C.red;
}

function verdictFor(score) {
  if (score >= MAX_SCORE) return 'purrfect';
  if (score >= 8) return 'excellent';
  if (score >= 6) return 'solid';
  if (score >= 4) return 'scrappy';
  if (score > 0) return 'rough';
  return 'tough day';
}

function masthead({ day, width, subtitle = 'the Wikipedia guessing game' }) {
  const title = gradient('catfishing', [C.emeraldSoft, C.emerald, C.amber], { bold: true });
  const left = `${paint(C.emerald, '🐈')}  ${title}`;
  let right = '';
  if (day != null) {
    right = `${faint('day')} ${pill(String(day), C.cream, C.emeraldDim)}  ${faint('·')}  ${muted(
      formatDayDate(day),
    )}`;
  }
  return [
    align(left, right, width),
    faint(subtitle),
    gradientRule(width),
  ];
}

function progressLine({ answers, total, score, width, current = null }) {
  const marks = Array.from({ length: total }, (_, index) => {
    const answer = answers[index];
    if (answer) return paint(COLOR[answer.result] ?? C.faint, SYMBOL[answer.result] ?? '·');
    if (index === current) return paint(C.amber, '◌');
    return faint('·');
  }).join(' ');

  const answered = answers.filter((answer) => answer.result !== RESULT.NOT_SHOWN).length;
  const left = `${marks}  ${paint(C.cream, `${answered}/${total}`, { bold: true })}`;
  const right = `${faint('score')} ${pill(formatScore(score), scoreColor(score))}`;
  return align(left, right, width);
}

function categoryLines(article, width, flat) {
  const inner = width - 6;
  const lines = [];

  if (!article.categories.length) {
    return [faint('No categories.')];
  }

  if (flat) {
    return flow(
      article.categories.map((category) => ({
        text: category,
        style: cream,
      })),
      inner,
    );
  }

  const { groups, rest } = groupCategories(article.categories);
  for (const group of groups) {
    lines.push(`${paint(C.amber, '▸')} ${boldAmber(group.prefix)}`);
    const childLines = flow(
      group.members.map((member) => ({
        text: member.slice(group.prefix.length).trim() || member,
        style: cream,
      })),
      inner - 2,
    );
    for (const line of childLines) lines.push(`  ${line}`);
  }

  if (rest.length > 0) {
    lines.push(
      ...flow(
        rest.map((category) => ({ text: category, style: cream })),
        inner,
      ),
    );
  }

  return lines;
}

function previewPanel(preview, width) {
  const extract = String(preview?.extract ?? '').replace(/\s+/g, ' ').trim();
  if (!extract) return [];

  const inner = width - 6;
  let lines = wrap(extract, inner);
  if (lines.length > 6) {
    lines = lines.slice(0, 6);
    lines[5] = `${truncate(lines[5], inner - 1)}…`;
  }

  return panelRaw(
    lines.map((line) => paint(C.cream, line, { italic: true })),
    { width, title: 'wikipedia', borderColor: C.faint, titleColor: C.muted },
  );
}

function titleLines(article, width) {
  const { main, note } = splitTitle(article.title);
  const plain = note ? `${main} (${note})` : main;
  if (visibleWidth(plain) <= width) {
    return [note ? `${boldCream(main)} ${faint(`(${note})`)}` : boldCream(main)];
  }

  const lines = wrap(main, width).map((line) => boldCream(line));
  if (note) {
    lines.push(...wrap(`(${note})`, width).map((line) => faint(line)));
  }
  return lines;
}

function pointsFor(answer) {
  if (answer.result === RESULT.CORRECT) return '+1';
  if (answer.result === RESULT.CLOSE) return '+0.5';
  return '+0';
}

export function renderQuestion({
  day,
  date,
  index,
  total,
  answers,
  score,
  article,
  flat = false,
}) {
  const { width } = layout();
  const lines = masthead({ day, date, width });
  lines.push('');
  lines.push(progressLine({ answers, total, score, width, current: index }));
  lines.push('');
  lines.push(
    `${paint(C.emerald, '▸')} ${boldCream('Question')} ${paint(C.cream, String(index + 1), {
      bold: true,
    })} ${faint(`of ${total}`)}`,
  );
  lines.push(muted('Guess the article from its categories'));
  lines.push('');

  const categories = categoryLines(article, width, flat);
  lines.push(
    ...panelRaw(categories, {
      width,
      title: 'categories',
      borderColor: C.emeraldDim,
      titleColor: C.emeraldSoft,
    }),
  );

  if (article.suggestedBy) {
    lines.push('');
    lines.push(`  ${faint('suggested by')} ${violet(article.suggestedBy)}`);
  }

  lines.push('');
  const hints = [
    `${key('enter')} ${faint('to guess')}`,
    `${key('/skip')} ${faint('to skip')}`,
    `${key('/quit')} ${faint('to save and exit')}`,
  ];
  lines.push(...flow(hints.map((text) => ({ text })), width, {
    separator: `  ${faint('·')}  `,
  }));
  return lines;
}

export function renderAnswer({
  article,
  preview,
  answer,
  questionStats,
  width = layout().width,
}) {
  const color = COLOR[answer.result] ?? C.faint;
  const symbol = SYMBOL[answer.result] ?? '·';
  const label = LABEL[answer.result] ?? 'Answered';

  const lines = [];
  const badgeColor = answer.result === RESULT.SKIPPED ? C.muted : color;
  const badge = pill(
    `${symbol} ${label}${answer.dym ? ' · did you mean' : ''}`,
    C.ink,
    badgeColor,
  );
  const points = pointsFor(answer);
  lines.push(
    align(
      badge,
      points === '+0' ? faint(points) : paint(color, points, { bold: true }),
      width,
    ),
  );

  if (answer.result === RESULT.INCORRECT || answer.result === RESULT.SKIPPED) {
    lines.push(faint('the answer was'));
  }
  lines.push(...titleLines(article, width));

  const sub = article.titleFormatted !== article.title ? article.titleFormatted : null;
  if (answer.guess && (answer.result !== RESULT.CORRECT || answer.dym || sub)) {
    lines.push(
      `${faint('you guessed ')}${paint(C.amberSoft, truncate(answer.guess, width - 14), {
        italic: true,
      })}`,
    );
  }

  if (preview?.extract) {
    lines.push('');
    lines.push(...previewPanel(preview, width));
  }

  const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(article.title.replace(/ /g, '_'))}`;
  lines.push('');
  lines.push(
    `${paint(C.emerald, '↗')} ${link(
      url,
      paint(C.sky, 'Wikipedia', { underline: true }),
    )} ${faint(truncate(url.replace(/^https?:\/\//, ''), Math.max(10, width - 16)))}`,
  );

  if (questionStats) {
    const played = Number(questionStats.played ?? 0);
    const correct = Number(questionStats.correctRate);
    const close = Number(questionStats.closeRate);
    const parts = [];
    if (Number.isFinite(correct)) {
      parts.push(`${emerald(`${Math.round(correct)}%`)} ${faint('correct')}`);
    }
    if (Number.isFinite(close)) {
      parts.push(`${amber(`${Math.round(close)}%`)} ${faint('close')}`);
    }
    if (played > 0) {
      parts.push(`${muted(played.toLocaleString('en-GB'))} ${faint('answers')}`);
    }
    if (parts.length > 0) {
      lines.push(
        ...flow(
          parts.map((text) => ({ text })),
          width,
          { separator: `  ${faint('·')}  ` },
        ),
      );
    }

    const popular = Array.isArray(questionStats.popular)
      ? questionStats.popular.slice(0, 4)
      : [];
    if (popular.length > 0) {
      const popularLines = flow(
        popular.map(([name, , count]) => ({ text: `${name} (${count})`, style: cream })),
        Math.max(20, width - 10),
        { separator: faint(' · ') },
      );
      for (const [lineIndex, line] of popularLines.entries()) {
        lines.push(
          lineIndex === 0 ? `${faint('popular')}  ${line}` : `         ${line}`,
        );
      }
    }
  }

  return lines;
}

function scorePanel({ record, width, global, title = 'your result' }) {
  const answers = record.answers ?? [];
  const score = record.score ?? 0;
  const total = record.total ?? answers.length ?? MAX_SCORE;
  const color = scoreColor(score);
  const inner = width - 6;
  const lines = [];

  const verdict = verdictFor(score);
  lines.push(centre(paint(color, verdict.toUpperCase(), { bold: true }), inner));
  lines.push('');
  lines.push(
    centre(
      `${paint(color, formatScore(score), { bold: true })} ${faint(`/ ${total}`)}`,
      inner,
    ),
  );
  lines.push('');

  const rows = emojiRows(answers, record.emojiSet);
  for (const row of rows) lines.push(centre(row, inner));

  lines.push('');
  const barWidth = Math.min(30, Math.max(12, inner - 8));
  lines.push(
    centre(
      gradientBar(score, total, barWidth, { from: shade(color, 0.3), to: color }),
      inner,
    ),
  );
  lines.push('');

  const missed = Math.max(0, total - (record.corrects ?? 0) - (record.closes ?? 0));
  lines.push(
    centre(
      `${emerald(`${record.corrects ?? 0} correct`)}  ${faint('·')}  ${amber(
        `${record.closes ?? 0} close`,
      )}  ${faint('·')}  ${paint(C.red, `${missed} missed`)}`,
      inner,
    ),
  );

  const percentile =
    global && Array.isArray(global.scores) && Number.isFinite(score)
      ? percentileFrom(score, global.scores)
      : null;
  if (percentile != null) {
    lines.push('');
    const average =
      Number.isFinite(Number(global.scoresMean)) && Number(global.scoresMean) > 0
        ? `  ${faint('·')}  ${faint(`players average ${Number(global.scoresMean).toFixed(1)}`)}`
        : '';
    const percentileText =
      percentile >= 99 && percentile < 100
        ? percentile.toFixed(1)
        : String(Math.round(percentile));
    const summary = `${paint(C.violet, '◆')} ${muted(
      `better than ${percentileText}% of players`,
    )}${average}`;
    for (const line of wrap(summary, inner)) {
      lines.push(centre(line, inner));
    }
  }

  return panelRaw(lines, {
    width,
    title,
    borderColor: color,
    titleColor: color,
  });
}

function percentileFrom(score, buckets) {
  const total = buckets.reduce((sum, count) => sum + count, 0);
  if (!total) return null;
  const index = Math.max(0, Math.min(buckets.length - 1, Math.round(score * 2)));
  let below = 0;
  for (let i = 0; i < index; i += 1) below += buckets[i];
  return Math.max(0, Math.min(100, (100 * (below + 0.5 * buckets[index])) / total));
}

function sharePanel({ record, width }) {
  if (!record.answers || record.answers.length === 0) return [];
  const text = shareText({
    day: record.day,
    answers: record.answers,
    score: record.score,
    corrects: record.corrects,
    closes: record.closes,
    setName: record.emojiSet,
  });
  const lines = text.split('\n').flatMap((line) => wrap(line, width - 6));
  return panelRaw(lines.map((line) => cream(line)), {
    width,
    title: 'share',
    borderColor: C.amber,
    titleColor: C.amberSoft,
  });
}

export function renderSummary({ record, global, storeFile }) {
  const { width } = layout();
  const lines = masthead({ day: record.day, width, subtitle: 'result' });
  lines.push('');
  lines.push(...scorePanel({ record, width, global, title: 'your result' }));
  lines.push('');
  lines.push(...sharePanel({ record, width }));
  lines.push('');
  lines.push('');
  lines.push(
    `${paint(C.emerald, 'next')}  ${key('catfishing archive')}  ${faint('·')}  ${key(
      'catfishing stats',
    )}  ${faint('·')}  ${key('catfishing play --replay')}`,
  );
  return lines;
}

function tableHeader() {
  const head = (text) => paint(C.muted, text, { bold: true });
  return `${padEnd(head('DAY'), 5)}${padEnd(head('DATE'), 17)}${padEnd(
    head('SCORE'),
    8,
  )}${head('QUESTIONS')}`;
}

function answerStrip(record) {
  return (record.answers ?? [])
    .slice(0, MAX_SCORE)
    .map((answer) => paint(COLOR[answer.result] ?? C.faint, SYMBOL[answer.result] ?? '·'))
    .join('');
}

export function renderResult({ record, global, storeFile }) {
  const { width } = layout();
  const lines = masthead({
    day: record.day,
    width,
    subtitle: record.completed ? 'saved result' : 'in progress',
  });
  lines.push('');
  lines.push(...scorePanel({ record, width, global, title: 'your result' }));
  lines.push('');

  const heading = `${section('Questions')} ${faint(`${record.answers?.length ?? 0} of ${record.total ?? 10}`)}`;
  lines.push(heading);
  lines.push('');

  for (const [index, answer] of (record.answers ?? []).entries()) {
    const color = COLOR[answer.result] ?? C.faint;
    const symbol = SYMBOL[answer.result] ?? '·';
    const title = answer.title || 'Unknown article';
    const { main, note } = splitTitle(title);
    const rate = Number.isFinite(answer.correctRate)
      ? faint(`${Math.round(answer.correctRate)}% correct`)
      : '';

    const left = `${paint(color, symbol)} ${faint(`${index + 1}.`)} ${boldCream(main)}${
      note ? ` ${faint(`(${note})`)}` : ''
    }`;
    lines.push(align(left, rate, width));

    if (answer.guess && (answer.result !== RESULT.CORRECT || answer.dym)) {
      lines.push(
        `   ${faint('you guessed')} ${paint(
          C.amberSoft,
          truncate(answer.guess, width - 18),
          { italic: true },
        )}`,
      );
    }
  }

  lines.push('');
  if (record.completed) {
    lines.push(...sharePanel({ record, width }));
  } else {
    lines.push(
      faint(
        `Resume with catfishing play ${record.day} — ${record.answers?.length ?? 0} of ${
          record.total ?? 10
        } answered.`,
      ),
    );
  }
  lines.push('');
  return lines;
}

export function renderArchive({ rows, summary, storeFile }) {
  const { width } = layout();
  const lines = masthead({ width, subtitle: 'archive' });
  lines.push('');

  if (rows.length === 0) {
    lines.push(muted('No playable days in that range.'));
    return lines;
  }

  lines.push(tableHeader());
  lines.push(rule(width));

  for (const row of rows) {
    const { day, record } = row;
    const date = formatDayDate(day);
    let scoreText = faint('—');
    let questions = faint('·');

    if (record?.completed) {
      const color = scoreColor(record.score);
      scoreText = paint(color, formatScore(record.score), { bold: true });
      questions = answerStrip(record);
    } else if (record) {
      const answered = record.answers?.length ?? 0;
      scoreText = paint(C.amber, `${answered}/${record.total ?? 10}`);
      questions = (record.answers ?? [])
        .map((answer) => paint(COLOR[answer.result] ?? C.faint, SYMBOL[answer.result] ?? '·'))
        .join('');
    }

    lines.push(
      `${padEnd(day < MIN_DAY ? faint(String(day)) : paint(C.cream, String(day)), 5)}` +
        `${padEnd(muted(date), 17)}${padEnd(scoreText, 8)}${questions}`,
    );
  }

  if (summary) {
    lines.push('');
    lines.push(rule(width));
    lines.push(
      `${emerald(`${summary.played} played`)} ${faint('·')} ${muted(
        `average ${summary.average.toFixed(1)}`,
      )} ${faint('·')} ${amber(`streak ${summary.currentStreak}`)}`,
    );
    lines.push(faint(`results stored in ${storeFile}`));
  }

  return lines;
}

export function renderStats({ stats, recentRows, storeFile }) {
  const { width } = layout();
  const lines = masthead({ width, subtitle: 'stats' });
  lines.push('');

  if (stats.played === 0) {
    lines.push(muted('No games played yet.'));
    lines.push('');
    lines.push(`Start today's game with ${amber('catfishing play')}.`);
    return lines;
  }

  const inner = width - 6;
  const kv = (label, value) =>
    align(faint(label), value, inner);

  const bestDay =
    stats.bestDays && stats.bestDays.length > 0
      ? `  ${faint(`day ${stats.bestDays[stats.bestDays.length - 1]}`)}`
      : '';

  const statLines = [
    kv(
      'Days played',
      `${paint(C.amber, String(stats.played), { bold: true })} ${faint(
        stats.currentStreak === 1 ? 'day' : 'days',
      )}`,
    ),
    kv(
      'Current streak',
      `${paint(C.amber, String(stats.currentStreak), { bold: true })} ${faint(
        stats.currentStreak === 1 ? 'day' : 'days',
      )}`,
    ),
    kv(
      'Best streak',
      `${paint(C.amber, String(stats.bestStreak), { bold: true })} ${faint(
        stats.bestStreak === 1 ? 'day' : 'days',
      )}`,
    ),
    '',
    kv('Average score', `${paint(C.amber, stats.average.toFixed(1), { bold: true })} ${faint('/ 10')}`),
    kv(
      'Best score',
      `${paint(scoreColor(stats.best), formatScore(stats.best), { bold: true })} ${faint(
        '/ 10',
      )}${bestDay}`,
    ),
    '',
    kv(
      'Correct answers',
      `${paint(C.emerald, `${Math.round(stats.correctPercent)}%`, { bold: true })} ${faint(
        `(${stats.corrects})`,
      )}  ${gradientBar(stats.correctPercent, 100, 10, {
        from: shade(C.emerald, 0.35),
        to: C.emerald,
      })}`,
    ),
    kv(
      'Close enough',
      `${paint(C.amber, `${Math.round(stats.closePercent)}%`, { bold: true })} ${faint(
        `(${stats.closes})`,
      )}  ${gradientBar(stats.closePercent, 100, 10, {
        from: shade(C.amber, 0.35),
        to: C.amber,
      })}`,
    ),
  ];

  lines.push(
    ...panelRaw(statLines, {
      width,
      title: 'your stats',
      borderColor: C.emeraldDim,
      titleColor: C.emeraldSoft,
    }),
  );

  lines.push('');
  lines.push(section('Score distribution'));
  lines.push('');

  const chart = [];
  const maxCount = Math.max(...stats.distribution, 1);
  for (let index = 0; index < stats.distribution.length; index += 1) {
    const count = stats.distribution[index];
    if (count === 0) continue;
    const score = index / 2;
    const label = padStart(formatScore(score), 4);
    const barWidth = Math.max(1, Math.round((count / maxCount) * 24));
    const color = scoreColor(score);
    chart.push(
      `${faint(label)}  ${gradientBar(count, maxCount, barWidth, {
        from: shade(color, 0.35),
        to: color,
      })} ${faint(String(count))}`,
    );
  }
  lines.push(...chart);
  lines.push('');

  if (recentRows.length > 0) {
    lines.push(section('Recent games'));
    lines.push('');
    lines.push(...renderArchiveRows(recentRows));
  }

  lines.push('');
  lines.push(faint(`results stored in ${storeFile}`));
  return lines;
}

function renderArchiveRows(rows) {
  const { width } = layout();
  const lines = [];
  lines.push(tableHeader());
  lines.push(rule(width));
  for (const row of rows) {
    const { day, record } = row;
    const date = formatDayDate(day);
    const color = scoreColor(record.score);
    lines.push(
      `${padEnd(paint(C.cream, String(day)), 5)}${padEnd(muted(date), 17)}${padEnd(
        paint(color, formatScore(record.score), { bold: true }),
        8,
      )}${answerStrip(record)}`,
    );
  }
  return lines;
}

function helpRow(label, description, width, { column = 35, color = amber } = {}) {
  const styled = `  ${color(label)}`;
  const descriptionColumn = Math.min(column, width - 12);
  const line = `${padEnd(styled, descriptionColumn)}  ${muted(description)}`;
  if (visibleWidth(line) <= width) return [line];
  return [
    styled,
    ...wrap(description, Math.max(12, width - 6)).map((part) => `      ${muted(part)}`),
  ];
}

export function renderHelp() {
  const { width } = layout();
  const lines = masthead({ width, subtitle: 'help' });
  lines.push('');
  lines.push(
    ...flow(
      [
        { text: 'Guess the Wikipedia article from its categories.' },
        { text: 'Ten questions a day.', style: muted },
      ],
      width,
      { separator: ' ' },
    ),
  );
  lines.push('');

  lines.push(section('Usage'));
  lines.push(...helpRow('catfishing', "play today's game", width));
  lines.push(...helpRow('catfishing play 865', 'play a specific day', width));
  lines.push(...helpRow('catfishing play --date 2026-11-04', 'play a date', width));
  lines.push(...helpRow('catfishing archive', 'recent days and scores', width));
  lines.push(...helpRow('catfishing stats', 'your lifetime stats', width));
  lines.push(...helpRow('catfishing result 865', 'review a saved game', width));
  lines.push(...helpRow('catfishing share', 'print a shareable score', width));
  lines.push('');

  lines.push(section('During a game'));
  lines.push(...helpRow('enter', 'submit a guess', width, { column: 14, color: key }));
  lines.push(...helpRow('/skip', 'skip the question', width, { column: 14, color: key }));
  lines.push(...helpRow('/quit', 'save your progress and exit', width, { column: 14, color: key }));
  lines.push(...helpRow('c', 'after a wrong guess, mark it close enough', width, { column: 14, color: key }));
  lines.push('');

  lines.push(section('Options'));
  lines.push(...helpRow('--day N', 'play day N', width, { column: 14, color: cream }));
  lines.push(...helpRow('--date DATE', 'play the day for YYYY-MM-DD', width, { column: 14, color: cream }));
  lines.push(...helpRow('--replay', 'restart a saved game (asks first)', width, { column: 14, color: cream }));
  lines.push(...helpRow('--force', 'overwrite without asking', width, { column: 14, color: cream }));
  lines.push(...helpRow('--flat', 'do not group repetitive categories', width, { column: 14, color: cream }));
  lines.push(...helpRow('--no-color', 'disable colour', width, { column: 14, color: cream }));
  lines.push(...helpRow('--json', 'JSON for result, archive, stats, share', width, { column: 14, color: cream }));
  lines.push(...helpRow('--limit N', 'number of days in the archive view', width, { column: 14, color: cream }));
  lines.push(...helpRow('--all', 'show the whole archive', width, { column: 14, color: cream }));
  lines.push('');

  lines.push(section('Scoring'));
  lines.push(
    ...flow(
      [
        { text: `${emerald('correct')} = 1 point` },
        { text: `${amber('close enough')} = 0.5 points` },
        { text: `maximum ${MAX_SCORE}` },
      ],
      width,
      { separator: `  ${faint('·')}  ` },
    ),
  );
  lines.push('');
  lines.push(
    ...wrap('Unofficial terminal client. Game data comes from catfishing.net.', width).map(
      faint,
    ),
  );
  return lines;
}

export function renderError(message) {
  return ['', `${paint(C.red, '✘')} ${message}`, ''];
}

export function renderNotice(message) {
  return ['', `${paint(C.amber, '•')} ${message}`, ''];
}
