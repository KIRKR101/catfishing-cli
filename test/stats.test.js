import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeStats,
  globalSnapshot,
  percentileForScore,
} from '../src/stats.js';

function game(day, score, corrects, closes, total = 10) {
  return {
    day,
    score,
    corrects,
    closes,
    total,
    completed: true,
    answers: Array.from({ length: total }, (_, index) => ({
      result:
        index < corrects
          ? 'correct'
          : index < corrects + closes
            ? 'close'
            : 'incorrect',
    })),
  };
}

test('stats aggregate days, scores and streaks', () => {
  const games = [
    game(100, 5, 4, 2),
    game(101, 7.5, 7, 1),
    game(103, 10, 10, 0),
  ];
  const stats = computeStats(games, { today: 103 });

  assert.equal(stats.played, 3);
  assert.equal(stats.average, 7.5);
  assert.equal(stats.best, 10);
  assert.deepEqual(stats.bestDays, [103]);
  assert.equal(stats.currentStreak, 1);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.corrects, 21);
  assert.equal(stats.closes, 3);
  assert.equal(stats.questions, 30);
  assert.equal(stats.distribution[10], 1);
  assert.equal(stats.distribution[15], 1);
  assert.equal(stats.distribution[20], 1);
});

test('a streak survives until the current day is over', () => {
  const games = [game(100, 5, 4, 2), game(101, 6, 6, 0)];
  const stats = computeStats(games, { today: 102 });
  assert.equal(stats.currentStreak, 2);
});

test('hidden questions are excluded from the questions denominator', () => {
  const hidden = {
    ...game(100, 1.5, 1, 1),
    answers: [
      { result: 'correct' },
      { result: 'close' },
      { result: 'incorrect' },
      { result: 'notShown' },
    ],
    total: 4,
  };
  const stats = computeStats([hidden], { today: 100 });
  assert.equal(stats.questions, 3);
  assert.equal(stats.correctPercent, (1 / 3) * 100);
});

test('percentile is the share of players scored at least as well as', () => {
  const buckets = Array.from({ length: 21 }, () => 0);
  buckets[0] = 1;
  buckets[20] = 1;
  assert.equal(percentileForScore(0, buckets), 25);
  assert.equal(percentileForScore(10, buckets), 75);
  assert.equal(percentileForScore(5, buckets), 50);
  assert.equal(percentileForScore(5, []), null);
});

test('global snapshots keep the score histogram', () => {
  const snapshot = globalSnapshot({
    played: 100,
    scoresMean: 4.2,
    correctsMean: 4.1,
    scores: Array.from({ length: 21 }, (_, index) => index),
    corrects: Array.from({ length: 11 }, (_, index) => index),
  });
  assert.equal(snapshot.played, 100);
  assert.equal(snapshot.scores.length, 21);
  assert.equal(snapshot.corrects.length, 11);
  assert.equal(globalSnapshot(null), null);
});
