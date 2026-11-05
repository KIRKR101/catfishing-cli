import { RESULT } from './game.js';

export function computeStats(games, { today } = {}) {
  const completed = games.filter((game) => game.completed && Number.isFinite(game.score));
  const played = completed.length;
  const scores = completed.map((game) => game.score);
  const totalScore = scores.reduce((sum, score) => sum + score, 0);
  const average = played > 0 ? totalScore / played : 0;
  const best = played > 0 ? Math.max(...scores) : null;
  const bestDays = completed
    .filter((game) => game.score === best)
    .map((game) => game.day)
    .sort((a, b) => a - b);

  const distribution = Array.from({ length: 21 }, () => 0);
  for (const game of completed) {
    distribution[Math.round(game.score * 2)] += 1;
  }

  const daySet = new Set(completed.map((game) => game.day));
  let bestStreak = 0;
  let run = 0;
  let previous = null;
  for (const day of [...daySet].sort((a, b) => a - b)) {
    if (previous !== null && day === previous + 1) run += 1;
    else run = 1;
    bestStreak = Math.max(bestStreak, run);
    previous = day;
  }

  let currentStreak = 0;
  if (Number.isInteger(today)) {
    let cursor = daySet.has(today) ? today : today - 1;
    while (daySet.has(cursor)) {
      currentStreak += 1;
      cursor -= 1;
    }
  }

  let corrects = 0;
  let closes = 0;
  let questions = 0;
  for (const game of completed) {
    corrects += Number(game.corrects) || 0;
    closes += Number(game.closes) || 0;
    const playable = Array.isArray(game.answers)
      ? game.answers.filter((answer) => answer.result !== RESULT.NOT_SHOWN).length
      : Number(game.total) || 10;
    questions += playable;
  }

  return {
    played,
    average,
    best,
    bestDays,
    distribution,
    currentStreak,
    bestStreak,
    corrects,
    closes,
    questions,
    correctPercent: questions > 0 ? (corrects / questions) * 100 : 0,
    closePercent: questions > 0 ? (closes / questions) * 100 : 0,
    perfectDays: distribution[20] ?? 0,
  };
}

/**
 * Percentage of players this score beats, using the day's score histogram.
 * Mirrors the calculation used by catfishing itself.
 */
export function percentileForScore(score, buckets) {
  if (!Array.isArray(buckets) || buckets.length === 0) return null;
  const total = buckets.reduce((sum, count) => sum + (Number(count) || 0), 0);
  if (total === 0) return null;

  const index = Math.max(0, Math.min(buckets.length - 1, Math.round(score * 2)));
  let below = 0;
  for (let i = 0; i < index; i += 1) below += Number(buckets[i]) || 0;

  // Percentage of players this score is at least as good as.
  return Math.max(
    0,
    Math.min(100, (100 * (below + 0.5 * (Number(buckets[index]) || 0))) / total),
  );
}

export function globalSnapshot(stats) {
  if (!stats || typeof stats !== 'object') return null;
  if (!Array.isArray(stats.scores) || !Array.isArray(stats.corrects)) return null;

  return {
    played: Number(stats.played) || 0,
    scoresMean: Number(stats.scoresMean) || 0,
    correctsMean: Number(stats.correctsMean) || 0,
    scores: stats.scores.map((value) => Number(value) || 0),
    corrects: stats.corrects.map((value) => Number(value) || 0),
  };
}
