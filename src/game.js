export const RESULT = {
  CORRECT: 'correct',
  CLOSE: 'close',
  INCORRECT: 'incorrect',
  SKIPPED: 'skipped',
  NOT_SHOWN: 'notShown',
};

export const MAX_SCORE = 10;

const ZERO_WIDTH = /[\u200B\u200C\u200D\uFEFF]/g;
const NUMBER_ROMAN = /\d+|\b[ivx]+(?=$| of | and )/g;
const DISTANCE_TABLE = [
  { minLength: 18, maxDistance: 4 },
  { minLength: 12, maxDistance: 3 },
  { minLength: 7, maxDistance: 2 },
  { minLength: 4, maxDistance: 1 },
];
const CONNECTIVES = new Set([
  'in', 'of', 'from', 'by', 'at', 'on', 'for', 'about', 'with', 'and', 'or', 'to',
]);

/** Trim invisible characters and duplicate whitespace, preserving case. */
export function cleanGuess(value) {
  if (!value) return '';
  return String(value)
    .replace(ZERO_WIDTH, '')
    .replace(/\s\s+/g, ' ')
    .trim();
}

/**
 * The answer normalisation used by catfishing:
 * drop bracketed text, accents, punctuation, case and leading articles.
 */
export function normalise(value) {
  const clean = cleanGuess(value);
  if (!clean) return '';
  return clean
    .replace(/\(.*\)/g, '')
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^\w\s]+/g, '')
    .replace(/\s\s+/g, ' ')
    .trim()
    .replace(/^(?:a|an|teh|the|thr)\s/, '');
}

/** Split a Wikipedia title like "Gonzo (Muppet)" into its main part and note. */
export function splitTitle(title) {
  if (!title) return { main: '', note: null };
  const match = /^(.*?)\s*\(([^()]*)\)\s*$/.exec(title);
  if (!match) return { main: title, note: null };
  return { main: match[1], note: match[2] };
}

export function buildArticle(raw) {
  const names = Array.isArray(raw?.names) ? raw.names.filter(Boolean) : [];
  const namesMap = new Map();
  for (const name of names) {
    const key = normalise(name);
    if (key) namesMap.set(key, name);
  }

  const title = raw?.title ?? '';
  const titleNormalised = normalise(title);
  if (titleNormalised && !namesMap.has(titleNormalised)) {
    namesMap.set(titleNormalised, title);
  }

  const namesVeto = Array.isArray(raw?.namesVeto) ? raw.namesVeto.filter(Boolean) : [];

  return {
    title,
    titleFormatted: splitTitle(title).main,
    titleNormalised,
    categories: Array.isArray(raw?.categories) ? [...raw.categories] : [],
    names,
    namesMap,
    namesVeto,
    namesVetoNormalised: new Set(namesVeto.map(normalise).filter(Boolean)),
    suggestedBy: raw?.suggestedBy ?? null,
    hidden: Boolean(raw?.hidden),
  };
}

/** Optimal string alignment distance, i.e. Levenshtein plus adjacent swaps. */
export function damerauLevenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, (_, row) => {
    const values = new Array(cols).fill(0);
    values[0] = row;
    return values;
  });
  for (let col = 1; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = a[row - 1] === b[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost,
      );
      if (
        row > 1 &&
        col > 1 &&
        a[row - 1] === b[col - 2] &&
        a[row - 2] === b[col - 1]
      ) {
        matrix[row][col] = Math.min(matrix[row][col], matrix[row - 2][col - 2] + 1);
      }
    }
  }

  return matrix[a.length][b.length];
}

/** Longer answers are allowed more typo corrections. */
export function maxEdits(a, b) {
  const longest = Math.max(a.length, b.length);
  for (const { minLength, maxDistance } of DISTANCE_TABLE) {
    if (longest >= minLength) return maxDistance;
  }
  return 0;
}

function numericTokens(text) {
  return text.match(NUMBER_ROMAN) ?? [];
}

export function fuzzyMatch(guessNormalised, targetNormalised) {
  const allowance = maxEdits(guessNormalised, targetNormalised);
  if (
    allowance === 0 ||
    Math.abs(guessNormalised.length - targetNormalised.length) > allowance
  ) {
    return { match: false, distance: Infinity, maxDistance: allowance };
  }

  const targetTokens = numericTokens(targetNormalised);
  if (targetTokens.length > 0) {
    const guessTokens = numericTokens(guessNormalised);
    if (
      guessTokens.length !== targetTokens.length ||
      !guessTokens.every((token, index) => token === targetTokens[index])
    ) {
      return { match: false, distance: Infinity, maxDistance: allowance };
    }
  }

  const distance = damerauLevenshtein(guessNormalised, targetNormalised);
  return { match: distance <= allowance, distance, maxDistance: allowance };
}

export function checkGuess(rawGuess, article) {
  if (!article?.namesMap?.size) {
    throw new Error('Cannot check a guess without an article and its names.');
  }

  const guess = cleanGuess(rawGuess);
  const guessNormalised = normalise(guess);
  if (!guessNormalised) {
    return { kind: 'incorrect', guess, guessNormalised };
  }

  const exact = article.namesMap.get(guessNormalised);
  if (exact !== undefined) {
    return { kind: 'correct', guess, guessNormalised, matchedName: exact };
  }

  if (
    guessNormalised.length < 4 ||
    article.namesVetoNormalised.has(guessNormalised)
  ) {
    return { kind: 'incorrect', guess, guessNormalised };
  }

  const titleMatch = fuzzyMatch(guessNormalised, article.titleNormalised);
  if (titleMatch.match) {
    return {
      kind: 'dym',
      guess,
      guessNormalised,
      matchedName: article.titleFormatted,
      distance: titleMatch.distance,
    };
  }

  let best = null;
  for (const [nameNormalised, displayName] of article.namesMap) {
    const result = fuzzyMatch(guessNormalised, nameNormalised);
    if (result.match && (best === null || result.distance < best.distance)) {
      best = { distance: result.distance, matchedName: displayName };
    }
  }

  if (best) {
    return {
      kind: 'dym',
      guess,
      guessNormalised,
      matchedName: best.matchedName,
      distance: best.distance,
    };
  }

  return { kind: 'incorrect', guess, guessNormalised };
}

export function scoreFor(corrects, closes) {
  const safeCorrects = Math.max(0, Math.min(MAX_SCORE, Number(corrects) || 0));
  const safeCloses = Math.max(
    0,
    Math.min(MAX_SCORE - safeCorrects, Number(closes) || 0),
  );
  return Math.round((safeCorrects + safeCloses * 0.5 + Number.EPSILON) * 100) / 100;
}

export function tally(answers = []) {
  let corrects = 0;
  let closes = 0;
  for (const answer of answers) {
    if (answer.result === RESULT.CORRECT) corrects += 1;
    else if (answer.result === RESULT.CLOSE) closes += 1;
  }
  return { corrects, closes, score: scoreFor(corrects, closes) };
}

export function formatScore(score) {
  if (!Number.isFinite(score)) return '–';
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * Group repetitive categories so long lists stay readable.
 * Every category is still shown; grouping is purely visual.
 */
export function groupCategories(categories, { minGroup = 3 } = {}) {
  const list = Array.isArray(categories) ? [...categories] : [];
  const order = new Map(list.map((category, index) => [category, index]));
  const candidates = [];

  for (const category of list) {
    const words = category.split(/\s+/);
    for (const size of [3, 2]) {
      if (words.length <= size) continue;
      if (size === 2 && !CONNECTIVES.has(words[1].toLowerCase())) continue;
      candidates.push({
        prefix: words.slice(0, size).join(' '),
        size,
        category,
      });
    }
  }

  const byPrefix = new Map();
  for (const candidate of candidates) {
    if (!byPrefix.has(candidate.prefix)) {
      byPrefix.set(candidate.prefix, {
        prefix: candidate.prefix,
        size: candidate.size,
        members: new Set(),
      });
    }
    byPrefix.get(candidate.prefix).members.add(candidate.category);
  }

  const groups = [];
  const assigned = new Set();
  const ranked = [...byPrefix.values()]
    .filter((group) => group.members.size >= minGroup)
    .sort(
      (a, b) =>
        b.size - a.size ||
        b.members.size - a.members.size ||
        a.prefix.localeCompare(b.prefix),
    );

  for (const group of ranked) {
    const members = [...group.members].filter((member) => !assigned.has(member));
    if (members.length < minGroup) continue;
    members.sort((a, b) => order.get(a) - order.get(b));
    for (const member of members) assigned.add(member);
    groups.push({ prefix: group.prefix, members });
  }

  groups.sort((a, b) => order.get(a.members[0]) - order.get(b.members[0]));
  const rest = list.filter((category) => !assigned.has(category));
  return { groups, rest };
}
