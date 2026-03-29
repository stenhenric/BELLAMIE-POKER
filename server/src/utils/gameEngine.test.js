const { buildDeck } = require("./gameEngine");
const { getCardType, CARD_TYPES } = require('./gameEngine');

describe('getCardType', () => {
  test('should return SPECIAL_ACE for special ace card', () => {
    const card = { isSpecialAce: true };
    expect(getCardType(card)).toBe(CARD_TYPES.SPECIAL_ACE);
  });

  test('should return ACE for regular Ace', () => {
    const card = { rank: 'A', suit: 'hearts' };
    expect(getCardType(card)).toBe(CARD_TYPES.ACE);
  });

  test('should return FEEDER for Joker', () => {
    const card = { rank: 'JOKER', suit: 'red' };
    expect(getCardType(card)).toBe(CARD_TYPES.FEEDER);
  });

  test('should return FEEDER for rank 2 and 3', () => {
    expect(getCardType({ rank: '2', suit: 'clubs' })).toBe(CARD_TYPES.FEEDER);
    expect(getCardType({ rank: '3', suit: 'diamonds' })).toBe(CARD_TYPES.FEEDER);
  });

  test('should return QUESTION for rank 8 and Q', () => {
    expect(getCardType({ rank: '8', suit: 'spades' })).toBe(CARD_TYPES.QUESTION);
    expect(getCardType({ rank: 'Q', suit: 'hearts' })).toBe(CARD_TYPES.QUESTION);
  });

  test('should return SPECIAL for rank J and K', () => {
    expect(getCardType({ rank: 'J', suit: 'clubs' })).toBe(CARD_TYPES.SPECIAL);
    expect(getCardType({ rank: 'K', suit: 'diamonds' })).toBe(CARD_TYPES.SPECIAL);
  });

  test('should return NORMAL for other ranks', () => {
    expect(getCardType({ rank: '4', suit: 'spades' })).toBe(CARD_TYPES.NORMAL);
    expect(getCardType({ rank: '7', suit: 'hearts' })).toBe(CARD_TYPES.NORMAL);
    expect(getCardType({ rank: '10', suit: 'clubs' })).toBe(CARD_TYPES.NORMAL);
  });
});

describe("buildDeck", () => {

  test('should return a deck of 55 cards', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(55);
  });

  test('should contain 52 standard cards', () => {
    const deck = buildDeck();
    const standardCards = deck.filter(card => !card.isSpecialAce && card.rank !== 'JOKER');
    expect(standardCards).toHaveLength(52);

    // Check all suits are present
    const suits = ['hearts', 'diamonds', 'clubs', 'spades'];
    for (const suit of suits) {
      const cardsOfSuit = standardCards.filter(card => card.suit === suit);
      expect(cardsOfSuit).toHaveLength(13);
    }
  });

  test('should contain exactly 2 Jokers (one red, one black)', () => {
    const deck = buildDeck();
    const jokers = deck.filter(card => card.rank === 'JOKER');

    expect(jokers).toHaveLength(2);
    expect(jokers).toContainEqual(expect.objectContaining({ rank: 'JOKER', suit: 'red', colour: 'red' }));
    expect(jokers).toContainEqual(expect.objectContaining({ rank: 'JOKER', suit: 'black', colour: 'black' }));
  });

  test('should contain exactly 1 Special Ace', () => {
    const deck = buildDeck();
    const specialAces = deck.filter(card => card.isSpecialAce);

    expect(specialAces).toHaveLength(1);
    expect(specialAces[0]).toEqual(expect.objectContaining({
      rank: 'A',
      suit: 'special',
      colour: 'black',
      isSpecialAce: true
    }));
  });

  test('should return a shuffled deck', () => {
    const deck1 = buildDeck();
    const deck2 = buildDeck();

    // Decks should have the same cards
    expect(deck1.length).toBe(deck2.length);

    // But the order should be different (extremely unlikely to be identical)
    // We check if at least one card is in a different position
    const isDifferentOrder = deck1.some((card, index) => card.id !== deck2[index].id);
    expect(isDifferentOrder).toBe(true);
  });
});
