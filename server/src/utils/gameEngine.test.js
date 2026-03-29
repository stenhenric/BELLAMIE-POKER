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
