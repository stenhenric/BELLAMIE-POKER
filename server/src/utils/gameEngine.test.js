const {
  buildDeck,
  checkWin,
  applyPlay,
  createGameState,
  CARD_RANKS,
  CARD_TYPES
} = require("./gameEngine");
const { getCardType } = require('./gameEngine');

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

describe('checkWin', () => {
  test('should return false if player still has cards in hand', () => {
    const state = {
      hands: {
        player1: [{ rank: 'A', suit: 'hearts' }],
        player2: []
      },
      nikokadi: {
        player1: true,
        player2: false
      }
    };
    expect(checkWin(state, 'player1')).toBe(false);
  });

  test('should return false if player has no cards but has not declared niko kadi', () => {
    const state = {
      hands: {
        player1: [],
        player2: []
      },
      nikokadi: {
        player1: false,
        player2: false
      }
    };
    expect(checkWin(state, 'player1')).toBe(false);
  });

  test('should return true if player has no cards and has declared niko kadi', () => {
    const state = {
      hands: {
        player1: [],
        player2: []
      },
      nikokadi: {
        player1: true,
        player2: false
      }
    };
    expect(checkWin(state, 'player1')).toBe(true);
  });
});

describe('applyPlay', () => {
  const players = [{ id: 'p1', name: 'Player 1' }, { id: 'p2', name: 'Player 2' }, { id: 'p3', name: 'Player 3' }];

  test('should update state correctly for a Normal card', () => {
    const state = createGameState(players);
    const card = { rank: '4', suit: 'spades', id: '4_spades', colour: 'black' };
    state.hands['p1'] = [card];
    state.currentPlayerIndex = 0;
    state.activeSuit = 'hearts';
    state.activeColour = 'red';

    const newState = applyPlay([card], state, 'p1');

    expect(newState.activeSuit).toBe('spades');
    expect(newState.activeColour).toBe('black');
    expect(newState.currentPlayerIndex).toBe(1);
    expect(newState.hands['p1']).toHaveLength(0);
    expect(newState.discardPile[newState.discardPile.length - 1]).toEqual(card);
  });

  test('should toggle direction and update state for a King card', () => {
    const state = createGameState(players);
    const card = { rank: CARD_RANKS.KING, suit: 'diamonds', id: 'K_diamonds', colour: 'red' };
    state.hands['p1'] = [card];
    state.currentPlayerIndex = 0;
    state.direction = 1;

    const newState = applyPlay([card], state, 'p1');

    expect(newState.direction).toBe(-1);
    expect(newState.activeSuit).toBe('diamonds');
    expect(newState.activeColour).toBe('red');
    // From 0, with direction -1, next should be 2 (p3)
    expect(newState.currentPlayerIndex).toBe(2);
  });

  test('should skip players correctly for a Jack card', () => {
    const state = createGameState(players);
    const card = { rank: CARD_RANKS.JACK, suit: 'clubs', id: 'J_clubs', colour: 'black' };
    state.hands['p1'] = [card];
    state.currentPlayerIndex = 0;
    state.direction = 1;

    const newState = applyPlay([card], state, 'p1');

    expect(newState.activeSuit).toBe('clubs');
    expect(newState.activeColour).toBe('black');
    // Skip 1 player (p2), so next is p3 (index 2)
    expect(newState.currentPlayerIndex).toBe(2);
  });

  test('should skip multiple players if multiple Jacks are played', () => {
    const players4 = [...players, { id: 'p4', name: 'Player 4' }];
    const state = createGameState(players4);
    const jack1 = { rank: CARD_RANKS.JACK, suit: 'clubs', id: 'J_clubs', colour: 'black' };
    const jack2 = { rank: CARD_RANKS.JACK, suit: 'spades', id: 'J_spades', colour: 'black' };
    state.hands['p1'] = [jack1, jack2];
    state.currentPlayerIndex = 0;
    state.direction = 1;

    // In a real game, they must have same rank to be played together, which they do.
    const newState = applyPlay([jack1, jack2], state, 'p1');

    expect(newState.activeSuit).toBe('spades');
    // Skip 2 players (p2, p3), so next is p4 (index 3)
    expect(newState.currentPlayerIndex).toBe(3);
  });
});
