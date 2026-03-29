const { shuffle, reshuffleDeck } = require('./gameEngine');
const assert = require('assert');

function testShuffle() {
  console.log('Running testShuffle...');
  const original = Array.from({ length: 100 }, (_, i) => i);
  const shuffled = shuffle(original);

  assert.strictEqual(shuffled.length, original.length, 'Shuffled array should have the same length');
  assert.notDeepStrictEqual(shuffled, original, 'Shuffled array should not be identical to original (probabilistic)');

  const originalSorted = [...original].sort((a, b) => a - b);
  const shuffledSorted = [...shuffled].sort((a, b) => a - b);
  assert.deepStrictEqual(shuffledSorted, originalSorted, 'Shuffled array should contain all original elements');

  console.log('testShuffle passed!');
}

function testReshuffleDeck() {
  console.log('Running testReshuffleDeck...');
  const state = {
    discardPile: [
      { id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }
    ],
    deck: []
  };

  const topBefore = state.discardPile[state.discardPile.length - 1];
  reshuffleDeck(state);

  assert.strictEqual(state.discardPile.length, 1, 'Discard pile should only have the top card left');
  assert.strictEqual(state.discardPile[0], topBefore, 'The top card of discard pile should remain the same');
  assert.strictEqual(state.deck.length, 4, 'Deck should contain all other cards');

  console.log('testReshuffleDeck passed!');
}

try {
  testShuffle();
  testReshuffleDeck();
  console.log('All tests passed successfully!');
} catch (error) {
  console.error('Test failed!');
  console.error(error);
  process.exit(1);
}
