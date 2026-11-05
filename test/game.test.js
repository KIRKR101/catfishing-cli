import test from 'node:test';
import assert from 'node:assert/strict';

import {
  RESULT,
  buildArticle,
  checkGuess,
  damerauLevenshtein,
  formatScore,
  groupCategories,
  maxEdits,
  normalise,
  scoreFor,
  tally,
} from '../src/game.js';
import { shareText } from '../src/share.js';

test('normalise follows the game rules', () => {
  assert.equal(normalise('The Lord of the Rings'), 'lord of the rings');
  assert.equal(normalise('  The   Beatles  '), 'beatles');
  assert.equal(normalise('N.A.S.A.'), 'nasa');
  assert.equal(normalise('Africa (Toto song)'), 'africa');
  assert.equal(normalise('Héãvy Mêtål Ümlāùt'), 'heavy metal umlaut');
  assert.equal(normalise('Chilli & Lime'), 'chilli and lime');
  assert.equal(normalise('B. B. King'), 'b b king');
  assert.equal(normalise('Москва'), '');
  assert.equal(normalise('   '), '');
});

test('Damerau-Levenshtein counts adjacent swaps as one edit', () => {
  assert.equal(damerauLevenshtein('gonzo', 'gonzo'), 0);
  assert.equal(damerauLevenshtein('gonzo', 'gonoz'), 1);
  assert.equal(damerauLevenshtein('kitten', 'sitting'), 3);
});

test('longer answers get more typo allowance', () => {
  assert.equal(maxEdits('cat', 'car'), 0);
  assert.equal(maxEdits('four', 'foor'), 1);
  assert.equal(maxEdits('sevennn', 'sevenn'), 2);
  assert.equal(maxEdits('twelvecharsx', 'twelvecharsy'), 3);
  assert.equal(maxEdits('eighteencharacters', 'eighteencharacterz'), 4);
});

test('exact names, aliases and titles are correct', () => {
  const article = buildArticle({
    title: 'Gonzo (Muppet)',
    categories: [],
    names: ['Gonzo', 'Baby gonzo', 'Gonzo the Great', 'The Great Gonzo'],
  });

  assert.equal(checkGuess('gonzo', article).kind, 'correct');
  assert.equal(checkGuess('GONZO!', article).kind, 'correct');
  assert.equal(checkGuess('the great gonzo', article).kind, 'correct');
  assert.equal(checkGuess('gonzo (muppet)', article).kind, 'correct');
});

test('near misses produce a Did You Mean prompt', () => {
  const article = buildArticle({
    title: 'Gonzo (Muppet)',
    categories: [],
    names: ['Gonzo'],
  });

  const result = checkGuess('gonzi', article);
  assert.equal(result.kind, 'dym');
  assert.equal(result.matchedName, 'Gonzo');
});

test('numbers and Roman numerals must match exactly', () => {
  const apollo = buildArticle({ title: 'Apollo 11', names: ['Apollo 11'] });
  assert.equal(checkGuess('apollo 13', apollo).kind, 'incorrect');

  const charles = buildArticle({ title: 'Charles III', names: ['Charles III'] });
  assert.equal(checkGuess('charles ii', charles).kind, 'incorrect');
});

test('vetoed guesses are incorrect, not typos', () => {
  const linear = buildArticle({
    title: 'Linear B',
    names: ['Linear B'],
    namesVeto: ['Linear A'],
  });
  assert.equal(checkGuess('linear a', linear).kind, 'incorrect');
});

test('short guesses never get a Did You Mean prompt', () => {
  const cat = buildArticle({ title: 'Cat', names: ['Cat'] });
  assert.equal(checkGuess('car', cat).kind, 'incorrect');
});

test('score is one point per correct and half per close', () => {
  assert.equal(scoreFor(7, 1), 7.5);
  assert.equal(scoreFor(10, 3), 10);
  assert.equal(scoreFor(0, 0), 0);
  assert.equal(formatScore(7.5), '7.5');
  assert.equal(formatScore(10), '10');
});

test('tally counts correct and close answers', () => {
  const result = tally([
    { result: RESULT.CORRECT },
    { result: RESULT.CLOSE },
    { result: RESULT.INCORRECT },
    { result: RESULT.SKIPPED },
    { result: RESULT.NOT_SHOWN },
  ]);
  assert.deepEqual(result, { corrects: 1, closes: 1, score: 1.5 });
});

test('repetitive categories are grouped without hiding anything', () => {
  const categories = [
    'Number-one singles in Australia',
    'Number-one singles in Austria',
    'Number-one singles in Denmark',
    'Songs written by Lady Gaga',
    'Songs written by Mark Ronson',
    'Songs written by Andrew Wyatt',
    'Pop ballads',
  ];
  const { groups, rest } = groupCategories(categories);

  assert.equal(groups.length, 2);
  assert.equal(groups[0].prefix, 'Number-one singles in');
  assert.deepEqual(groups[0].members, [
    'Number-one singles in Australia',
    'Number-one singles in Austria',
    'Number-one singles in Denmark',
  ]);
  assert.equal(groups[1].prefix, 'Songs written by');
  assert.deepEqual(rest, ['Pop ballads']);
});

test('share text uses the game emoji', () => {
  const answers = [
    { result: RESULT.CORRECT },
    { result: RESULT.CLOSE },
    { result: RESULT.INCORRECT },
    { result: RESULT.CORRECT },
    { result: RESULT.CORRECT },
    { result: RESULT.CORRECT },
    { result: RESULT.CORRECT },
    { result: RESULT.CORRECT },
    { result: RESULT.CORRECT },
    { result: RESULT.CORRECT },
  ];
  assert.equal(
    shareText({ day: 865, answers, score: 8.5, corrects: 8, closes: 1 }),
    'catfishing.net\n#865 - 8.5/10\n🐈🥚🐟🐈🐈\n🐈🐈🐈🐈🐈',
  );
});
