// ─── KADI GAME ENGINE ────────────────────────────────────────────────────────
const { randomInt } = require('crypto');

const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const COLOURS = { hearts: 'red', diamonds: 'red', clubs: 'black', spades: 'black' };

const CARD_TYPES = {
  NORMAL: 'normal',
  FEEDER: 'feeder',
  QUESTION: 'question',
  SPECIAL: 'special',
  ACE: 'ace',
  SPECIAL_ACE: 'special_ace',
};

function returnInvalid(reason, code) {
  const res = { valid: false, reason };
  if (code) res.code = code;
  return res;
}

function returnValid(extra = {}) {
  return { valid: true, ...extra };
}

// ─── Build deck ───────────────────────────────────────────────────────────────
function buildDeck() {
  const deck = [];

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({ rank, suit, colour: COLOURS[suit], id: `${rank}_${suit}` });
    }
  }

  // 2 Jokers
  deck.push({ rank: 'JOKER', suit: 'red', colour: 'red', id: 'JOKER_red' });
  deck.push({ rank: 'JOKER', suit: 'black', colour: 'black', id: 'JOKER_black' });

  // Special Ace
  deck.push({ rank: 'A', suit: 'special', colour: 'black', id: 'A_special', isSpecialAce: true });

  return shuffle(deck);
}

function shuffle(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// ─── Card classification ──────────────────────────────────────────────────────
function getCardType(card) {
  if (card.isSpecialAce) return CARD_TYPES.SPECIAL_ACE;
  if (card.rank === 'A') return CARD_TYPES.ACE;
  if (card.rank === 'JOKER') return CARD_TYPES.FEEDER;
  if (card.rank === '2' || card.rank === '3') return CARD_TYPES.FEEDER;
  if (card.rank === '8' || card.rank === 'Q') return CARD_TYPES.QUESTION;
  if (card.rank === 'J' || card.rank === 'K') return CARD_TYPES.SPECIAL;
  return CARD_TYPES.NORMAL;
}

function isFeeder(card) { return getCardType(card) === CARD_TYPES.FEEDER; }
function isAce(card) { return getCardType(card) === CARD_TYPES.ACE || getCardType(card) === CARD_TYPES.SPECIAL_ACE; }
function isQuestion(card) { return getCardType(card) === CARD_TYPES.QUESTION; }
function isJoker(card) { return card.rank === 'JOKER'; }

function isValidCalledCard(card) {
  return Boolean(card && RANKS.includes(card.rank) && SUITS.includes(card.suit));
}

function matchesCalledCard(card, calledCard) {
  return Boolean(
    card &&
    calledCard &&
    !card.isSpecialAce &&
    card.rank === calledCard.rank &&
    card.suit === calledCard.suit
  );
}

function normalizeCardsForPlay(cards, state, playerId) {
  if (!Array.isArray(cards) || cards.length === 0) {
    return returnInvalid('No cards selected');
  }

  const hand = state.hands[playerId] || [];
  const handById = new Map(hand.map(card => [card.id, card]));
  const normalized = [];
  const seenIds = new Set();

  for (const card of cards) {
    if (!card?.id || seenIds.has(card.id)) {
      return returnInvalid('Invalid card selection');
    }

    const actualCard = handById.get(card.id);
    if (!actualCard) {
      return returnInvalid('You can only play cards from your hand');
    }

    normalized.push(actualCard);
    seenIds.add(card.id);
  }

  return returnValid({ cards: normalized });
}

function syncNikoKadiStatus(state, playerId) {
  const handCount = state.hands[playerId]?.length ?? 0;

  if (handCount > 1) {
    delete state.nikokadi[playerId];
  }

  state.nikoKadiWindow = handCount === 1 ? playerId : null;
}

function feederValue(card) {
  if (card.rank === '2') return 2;
  if (card.rank === '3') return 3;
  if (card.rank === 'JOKER') return 5;
  return 0;
}

// ─── Initial game state ───────────────────────────────────────────────────────
function createGameState(players) {
  const deck = buildDeck();
  const hands = {};
  let deckIndex = 0;

  // Deal 3 cards to each player
  for (const player of players) {
    hands[player.id] = deck.slice(deckIndex, deckIndex + 3);
    deckIndex += 3;
  }

  // Find first non-special card for the discard pile
  let firstCard = null;
  let remaining = deck.slice(deckIndex);
  for (let i = 0; i < remaining.length; i++) {
    const c = remaining[i];
    if (!isFeeder(c) && !isAce(c) && !isQuestion(c) && c.rank !== 'J' && c.rank !== 'K') {
      firstCard = c;
      remaining = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
      break;
    }
  }

  return {
    deck: remaining,
    discardPile: [firstCard],
    hands,
    players: players.map((p, i) => ({ ...p, position: i, eliminated: false })),
    currentPlayerIndex: 0,
    direction: 1, // 1 = clockwise, -1 = counter-clockwise
    activeSuit: firstCard.suit,
    activeColour: firstCard.colour,
    feedStack: 0,
    activeFeed: false,
    awaitingAnswer: null, // { questionSuit } — turn stays until answer picked
    specialAceCall: null, // { callerId, card: {rank, suit} }
    nikokadi: {}, // { playerId: true } — who has declared
    nikoKadiWindow: null, // playerId who just played second-to-last card
    gameOver: false,
    winnerId: null,
  };
}

// ─── Refactored Validation Helpers ────────────────────────────────────────────

function validateSpecialAceCall(cards, state, options) {
  const firstCard = cards[0];
  const isTwoRegularAces = cards.length === 2 && cards.every(card => getCardType(card) === CARD_TYPES.ACE);

  if (state.specialAceCall?.card) {
    if (!isTwoRegularAces) {
      if (cards.length !== 1 || !matchesCalledCard(firstCard, state.specialAceCall.card)) {
        return returnInvalid(`Special Ace called for ${state.specialAceCall.card.rank} of ${state.specialAceCall.card.suit}`);
      }
    }
  }
  return returnValid();
}

function validateAces(cards, options) {
  const firstCard = cards[0];
  if (firstCard.isSpecialAce && !isValidCalledCard(options.calledCard)) {
    return returnInvalid('Special Ace must call a specific card');
  }

  if (cards.length === 2) {
    const types = cards.map(getCardType);
    if (types.includes(CARD_TYPES.ACE) && types.includes(CARD_TYPES.SPECIAL_ACE)) {
      return returnInvalid('Cannot stack Regular Ace with Special Ace');
    }
    if (types.every(t => t === CARD_TYPES.ACE)) return returnValid();
  }
  if (cards.length > 2) return returnInvalid('Cannot stack more than 2 Aces');
  return returnValid();
}

function validateQuestions(cards, state, topCard) {
  const firstCard = cards[0];

  if (firstCard.suit !== state.activeSuit && firstCard.rank !== topCard.rank) {
    return returnInvalid(`Question must match suit: ${state.activeSuit}`);
  }

  const questionCards = cards.filter(c => isQuestion(c));
  const answerCards = cards.filter(c => !isQuestion(c));

  if (answerCards.length > 1) {
    return returnInvalid('Only one answer card allowed');
  }

  for (let i = 1; i < questionCards.length; i++) {
    const prev = questionCards[i - 1];
    const curr = questionCards[i];
    if (curr.rank !== prev.rank && curr.suit !== prev.suit) {
      return returnInvalid('Question chain: each card must share rank or suit with the previous');
    }
  }

  if (answerCards.length === 1) {
    const answer = answerCards[0];
    const lastQuestion = questionCards[questionCards.length - 1];
    const invalid = isFeeder(answer) || isAce(answer) || answer.rank === 'J' || answer.rank === 'K' || answer.rank === 'Q';
    if (invalid) return returnInvalid('Invalid answer card');
    if (answer.suit !== lastQuestion.suit) {
      return returnInvalid(`Answer must match suit of last question: ${lastQuestion.suit}`);
    }
  }

  return returnValid();
}

function validateStacking(cards, state, topCard) {
  const firstCard = cards[0];
  const stackable = ['4','5','6','7','9','10','J','Q','K','8'];

  if (stackable.includes(firstCard.rank) && firstCard.rank === topCard.rank) {
    if (!cards.every(c => c.rank === firstCard.rank)) {
      return returnInvalid('Stacked cards must have the same rank');
    }
    return returnValid();
  }

  if (cards.length > 1) {
    const rank = firstCard.rank;
    if (!cards.every(c => c.rank === rank)) {
      return returnInvalid('Stacked cards must have the same rank');
    }
    if (!stackable.includes(rank)) {
      return returnInvalid(`${rank} cannot be stacked`);
    }
    if (firstCard.suit !== state.activeSuit) {
      return returnInvalid(`First card must match suit: ${state.activeSuit}`);
    }
    return returnValid();
  }

  return null; // Signals to continue validation if not stacking
}

// ─── Validate a play ──────────────────────────────────────────────────────────
function canPlay(cards, state, playerId, options = {}) {
  if (!cards || cards.length === 0) return returnInvalid('No cards selected');

  const topCard = state.discardPile[state.discardPile.length - 1];
  const firstCard = cards[0];

  const specialAceCheck = validateSpecialAceCall(cards, state, options);
  if (!specialAceCheck.valid) return specialAceCheck;

  // ── Aces can always be played ──
  if (isAce(firstCard)) {
    return validateAces(cards, options);
  }

  // ── Active feed: only feeders or aces allowed ──
  if (state.activeFeed) {
    if (!isFeeder(firstCard) && !isAce(firstCard)) {
      return returnInvalid('You must play a feeder or Ace to defend');
    }
  }

  // ── Awaiting answer: player must pick from deck (handled via pick_answer event) ──
  if (state.awaitingAnswer) {
    return returnInvalid('You must pick an answer card first');
  }

  // ── Question cards: questions + answer played together ──
  if (isQuestion(firstCard)) {
    return validateQuestions(cards, state, topCard);
  }

  // ── Joker: follows colour ──
  if (isJoker(firstCard)) {
    if (firstCard.colour !== state.activeColour) {
      return returnInvalid(`Joker must match colour: ${state.activeColour}`);
    }
    return returnValid();
  }

  // ── Feeders (2, 3): first must match suit ──
  if (isFeeder(firstCard)) {
    if (firstCard.suit !== state.activeSuit) {
      return returnInvalid(`Feeder must match suit: ${state.activeSuit}`);
    }
    return returnValid();
  }

  // ── Stacking cards ──
  const stackingCheck = validateStacking(cards, state, topCard);
  if (stackingCheck) return stackingCheck;

  // ── Normal / special single card: must match suit ──
  if (firstCard.suit !== state.activeSuit) {
    if (isJoker(topCard) && firstCard.colour !== state.activeColour) {
      return returnInvalid(`Must match colour after Joker: ${state.activeColour}`, 'WRONG_SUIT');
    }
    if (!isJoker(topCard)) {
      return returnInvalid(`Must match suit: ${state.activeSuit}`, 'WRONG_SUIT');
    }
  }

  return returnValid();
}

// ─── Apply a play ─────────────────────────────────────────────────────────────
function applyPlay(cards, state, playerId, options = {}) {
  // options: { chosenSuit, calledCard } for aces / special ace
  const newState = structuredClone(state); // deep clone
  const firstCard = cards[0];
  const lastCard = cards[cards.length - 1];
  const type = getCardType(firstCard);

  // Remove cards from player's hand
  const cardIds = new Set(cards.map(c => c.id));
  newState.hands[playerId] = newState.hands[playerId].filter(c => !cardIds.has(c.id));

  // Add to discard pile
  newState.discardPile.push(...cards);

  if (newState.specialAceCall?.card) {
    const isCancellingAcePair = cards.length === 2 && cards.every(c => getCardType(c) === CARD_TYPES.ACE);
    if (isCancellingAcePair || matchesCalledCard(firstCard, newState.specialAceCall.card)) {
      newState.specialAceCall = null;
    }
  }

  syncNikoKadiStatus(newState, playerId);

  // ── Ace logic ──
  if (type === CARD_TYPES.ACE || type === CARD_TYPES.SPECIAL_ACE) {
    // Refuse feeders
    newState.activeFeed = false;
    newState.feedStack = 0;

    if (type === CARD_TYPES.SPECIAL_ACE) {
      // Call a specific card
      newState.specialAceCall = { callerId: playerId, card: options.calledCard };
      newState.activeSuit = options.calledCard.suit;
      newState.activeColour = COLOURS[options.calledCard.suit];
    } else if (cards.length === 2) {
      // Two regular aces: choose suit
      newState.activeSuit = options.chosenSuit || state.activeSuit;
      newState.activeColour = COLOURS[options.chosenSuit] || state.activeColour;
      newState.specialAceCall = null;
    } else {
      // Single regular ace: choose suit
      newState.activeSuit = options.chosenSuit || state.activeSuit;
      newState.activeColour = COLOURS[options.chosenSuit] || state.activeColour;
      newState.specialAceCall = null;
    }
    advanceTurn(newState);
    return newState;
  }

  // ── Feeder logic ──
  if (isFeeder(firstCard)) {
    if (!newState.activeFeed) newState.activeFeed = true;
    for (const c of cards) {
      newState.feedStack += feederValue(c);
    }
    newState.activeSuit = lastCard.rank === 'JOKER' ? state.activeSuit : lastCard.suit;
    newState.activeColour = lastCard.colour;
    advanceTurn(newState);
    return newState;
  }

  // ── Question logic ──
  if (isQuestion(firstCard)) {
    const questionCards = cards.filter(c => isQuestion(c));
    const answerCards = cards.filter(c => !isQuestion(c));
    const lastQuestion = questionCards[questionCards.length - 1];

    newState.activeSuit = lastQuestion.suit;
    newState.activeColour = COLOURS[lastQuestion.suit];

    if (answerCards.length === 1) {
      // Answer included — complete play, advance turn
      newState.activeSuit = answerCards[0].suit;
      newState.activeColour = COLOURS[answerCards[0].suit];
      newState.awaitingAnswer = null;
      advanceTurn(newState);
    } else {
      // No answer — turn stays, player must pick answer from deck
      newState.awaitingAnswer = { questionSuit: lastQuestion.suit };
    }
    return newState;
  }

  // ── Jack: skip ──
  if (firstCard.rank === 'J') {
    newState.activeSuit = lastCard.suit;
    newState.activeColour = COLOURS[lastCard.suit];
    const skipCount = cards.length;
    advanceTurn(newState, skipCount + 1);
    return newState;
  }

  // ── King: reverse ──
  if (firstCard.rank === 'K') {
    for (let i = 0; i < cards.length; i++) {
      newState.direction *= -1;
    }
    newState.activeSuit = lastCard.suit;
    newState.activeColour = COLOURS[lastCard.suit];
    advanceTurn(newState);
    return newState;
  }

  // ── Normal cards / stacked cards ──
  newState.activeSuit = lastCard.suit;
  newState.activeColour = COLOURS[lastCard.suit];
  advanceTurn(newState);
  return newState;
}

// ─── Advance turn ─────────────────────────────────────────────────────────────
function advanceTurn(state, steps = 1) {
  const activePlayers = state.players.filter(p => !p.eliminated);
  if (activePlayers.length === 0) return;

  let idx = state.currentPlayerIndex;
  for (let i = 0; i < steps; i++) {
    idx = (idx + state.direction + state.players.length) % state.players.length;
    // Skip eliminated players
    while (state.players[idx].eliminated) {
      idx = (idx + state.direction + state.players.length) % state.players.length;
    }
  }
  state.currentPlayerIndex = idx;
}

// ─── Force pick cards ─────────────────────────────────────────────────────────
function forcePick(state, playerId, count, options = {}) {
  const { advanceTurnAfterPick = true, resetFeed = true } = options;
  const newState = structuredClone(state);
  const picks = [];

  for (let i = 0; i < count; i++) {
    if (newState.deck.length === 0) reshuffleDeck(newState);
    if (newState.deck.length > 0) {
      const card = newState.deck.shift();
      picks.push(card);
      newState.hands[playerId].push(card);
    }
  }

  // Check hand limit
  if (newState.hands[playerId].length >= 15) {
    eliminatePlayer(newState, playerId);
  }

  syncNikoKadiStatus(newState, playerId);

  if (resetFeed) {
    newState.activeFeed = false;
    newState.feedStack = 0;
  }

  if (advanceTurnAfterPick) {
    advanceTurn(newState);
  }

  return { newState, picks };
}

function reshuffleDeck(state) {
  if (state.discardPile.length <= 1) return;
  const top = state.discardPile[state.discardPile.length - 1];
  const reshuffled = shuffle(state.discardPile.slice(0, -1));
  state.discardPile = [top];
  state.deck = reshuffled;
}

function eliminatePlayer(state, playerId) {
  const p = state.players.find(p => p.id === playerId);
  if (p) p.eliminated = true;
}

// ─── Check win ────────────────────────────────────────────────────────────────
function checkWin(state, playerId) {
  const hand = state.hands[playerId];
  if (hand.length !== 0) return false;
  if (!state.nikokadi[playerId]) return false; // must have declared
  return true;
}

// ─── NIKO KADI declaration ────────────────────────────────────────────────────
function declareNikoKadi(state, playerId) {
  const newState = structuredClone(state);
  newState.nikokadi[playerId] = true;
  return newState;
}

// ─── Fine a player 1 card ─────────────────────────────────────────────────────
function fine(state, playerId) {
  return forcePick(state, playerId, 1);
}

module.exports = {
  buildDeck,
  createGameState,
  normalizeCardsForPlay,
  canPlay,
  applyPlay,
  advanceTurn,
  forcePick,
  checkWin,
  declareNikoKadi,
  fine,
  syncNikoKadiStatus,
  getCardType,
  isFeeder,
  isAce,
  isQuestion,
  CARD_TYPES,
  shuffle,
  reshuffleDeck,
};
