import { RESULT, formatScore } from './game.js';

export const EMOJI_SETS = {
  default: {
    correct: '🐈',
    close: '🥚',
    incorrect: '🐟',
    skipped: '🐟',
    notShown: '⚫',
  },
  halloween: {
    correct: '👻',
    close: '🎃',
    incorrect: '⚰️',
    skipped: '⚰️',
    notShown: '⚫',
  },
  christmas: {
    correct: '🎅🏻',
    close: '🥕',
    incorrect: '❄️',
    skipped: '❄️',
    notShown: '⚫',
  },
  eurovision: {
    correct: '💃',
    close: '🪩',
    incorrect: '0️⃣',
    skipped: '0️⃣',
    notShown: '⚫',
  },
};

export function emojiSetFor(name) {
  return EMOJI_SETS[name] ?? EMOJI_SETS.default;
}

export function emojiRows(answers, setName = 'default') {
  const set = emojiSetFor(setName);
  const symbols = answers
    .slice(0, 10)
    .map((answer) => set[answer.result] ?? set.notShown);
  return [symbols.slice(0, 5).join(''), symbols.slice(5, 10).join('')].filter(
    Boolean,
  );
}

export function shareText({
  day,
  answers,
  score,
  corrects,
  closes,
  link = 'catfishing.net',
  setName = 'default',
}) {
  const playable = answers.filter(
    (answer) => answer.result !== RESULT.NOT_SHOWN,
  ).length;
  const total = playable || answers.length || 10;
  const rows = emojiRows(answers, setName);
  const heading = `#${day} - ${formatScore(score)}/${total}${score >= total ? ' 🎉' : ''}`;
  return [link, heading, ...rows].join('\n');
}
