// ─── KADI GAME ENGINE ────────────────────────────────────────────────────────

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
    const j = Math.floor(Math.random() * (i + 1));
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
    return { valid: false, reason: 'No cards selected' };
  }

  const hand = state.hands[playerId] || [];
  const handById = new Map(hand.map(card => [card.id, card]));
  const normalized = [];
  const seenIds = new Set();

  for (const card of cards) {
    if (!card?.id || seenIds.has(card.id)) {
      return { valid: false, reason: 'Invalid card selection' };
    }

    const actualCard = handById.get(card.id);
    if (!actualCard) {
      return { valid: false, reason: 'You can only play cards from your hand' };
    }

    normalized.push(actualCard);
    seenIds.add(card.id);
  }

  return { valid: true, cards: normalized };
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

// ─── Validate a play ──────────────────────────────────────────────────────────
function canPlay(cards, state, playerId, options = {}) {
  if (!cards || cards.length === 0) return { valid: false, reason: 'No cards selected' };

  const topCard = state.discardPile[state.discardPile.length - 1];
  const firstCard = cards[0];
  const isTwoRegularAces = cards.length === 2 && cards.every(card => getCardType(card) === CARD_TYPES.ACE);

  if (state.specialAceCall?.card) {
    if (!isTwoRegularAces) {
      if (cards.length !== 1 || !matchesCalledCard(firstCard, state.specialAceCall.card)) {
        return {
          valid: false,
          reason: `Special Ace called for ${state.specialAceCall.card.rank} of ${state.specialAceCall.card.suit}`,
        };
      }
    }
  }

  // ── Aces can always be played ──
  if (isAce(firstCard)) {
    if (firstCard.isSpecialAce && !isValidCalledCard(options.calledCard)) {
      return { valid: false, reason: 'Special Ace must call a specific card' };
    }

    // Cannot stack regular + special ace
    if (cards.length === 2) {
      const types = cards.map(getCardType);
      if (types.includes(CARD_TYPES.ACE) && types.includes(CARD_TYPES.SPECIAL_ACE)) {
        return { valid: false, reason: 'Cannot stack Regular Ace with Special Ace' };
      }
      // Only exactly 2 regular aces allowed stacked
      if (types.every(t => t === CARD_TYPES.ACE)) return { valid: true };
    }
    if (cards.length > 2) return { valid: false, reason: 'Cannot stack more than 2 Aces' };
    return { valid: true };
  }

  // ── Active feed: only feeders or aces allowed ──
  if (state.activeFeed) {
    if (!isFeeder(firstCard) && !isAce(firstCard)) {
      return { valid: false, reason: 'You must play a feeder or Ace to defend' };
    }
  }

  // ── Awaiting answer: player must pick from deck (handled via pick_answer event) ──
  if (state.awaitingAnswer) {
    return { valid: false, reason: 'You must pick an answer card first' };
  }

  // ── Question cards: questions + answer played together ──
  if (isQuestion(firstCard)) {
    // First question must match active suit or same rank as top card
    if (firstCard.suit !== state.activeSuit && firstCard.rank !== topCard.rank) {
      return { valid: false, reason: `Question must match suit: ${state.activeSuit}` };
    }

    const questionCards = cards.filter(c => isQuestion(c));
    const answerCards = cards.filter(c => !isQuestion(c));

    if (answerCards.length > 1) {
      return { valid: false, reason: 'Only one answer card allowed' };
    }

    // Validate question chain: each next question must share rank OR suit with previous
    for (let i = 1; i < questionCards.length; i++) {
      const prev = questionCards[i - 1];
      const curr = questionCards[i];
      if (curr.rank !== prev.rank && curr.suit !== prev.suit) {
        return { valid: false, reason: 'Question chain: each card must share rank or suit with the previous' };
      }
    }

    // Validate answer if included
    if (answerCards.length === 1) {
      const answer = answerCards[0];
      const lastQuestion = questionCards[questionCards.length - 1];
      const invalid = isFeeder(answer) || isAce(answer) || answer.rank === 'J' || answer.rank === 'K' || answer.rank === 'Q';
      if (invalid) return { valid: false, reason: 'Invalid answer card' };
      if (answer.suit !== lastQuestion.suit) {
        return { valid: false, reason: `Answer must match suit of last question: ${lastQuestion.suit}` };
      }
    }

    return { valid: true };
  }

  // ── Joker: follows colour ──
  if (isJoker(firstCard)) {
    if (firstCard.colour !== state.activeColour) {
      return { valid: false, reason: `Joker must match colour: ${state.activeColour}` };
    }
    return { valid: true };
  }

  // ── Feeders (2, 3): first must match suit ──
  if (isFeeder(firstCard)) {
    if (firstCard.suit !== state.activeSuit) {
      return { valid: false, reason: `Feeder must match suit: ${state.activeSuit}` };
    }
    return { valid: true };
  }

  // ── Same rank as top card: always playable (single or stacked) ──
  const stackable = ['4','5','6','7','9','10','J','Q','K','8'];
  if (stackable.includes(firstCard.rank) && firstCard.rank === topCard.rank) {
    if (!cards.every(c => c.rank === firstCard.rank)) {
      return { valid: false, reason: 'Stacked cards must have the same rank' };
    }
    return { valid: true };
  }

  // ── Stacking same-rank cards (must match suit for first card) ──
  if (cards.length > 1) {
    const rank = firstCard.rank;
    if (!cards.every(c => c.rank === rank)) {
      return { valid: false, reason: 'Stacked cards must have the same rank' };
    }
    if (!stackable.includes(rank)) {
      return { valid: false, reason: `${rank} cannot be stacked` };
    }
    if (firstCard.suit !== state.activeSuit) {
      return { valid: false, reason: `First card must match suit: ${state.activeSuit}` };
    }
    return { valid: true };
  }

  // ── Normal / special single card: must match suit ──
  if (firstCard.suit !== state.activeSuit) {
    if (isJoker(topCard) && firstCard.colour !== state.activeColour) {
      return { valid: false, reason: `Must match colour after Joker: ${state.activeColour}`, code: 'WRONG_SUIT' };
    }
    if (!isJoker(topCard)) {
      return { valid: false, reason: `Must match suit: ${state.activeSuit}`, code: 'WRONG_SUIT' };
    }
  }

  return { valid: true };
}

// ─── Apply a play ─────────────────────────────────────────────────────────────
function applyPlay(cards, state, playerId, options = {}) {
  // options: { chosenSuit, calledCard } for aces / special ace
  const newState = JSON.parse(JSON.stringify(state)); // deep clone
  const firstCard = cards[0];
  const lastCard = cards[cards.length - 1];
  const type = getCardType(firstCard);

  // Remove cards from player's hand
  const cardIds = cards.map(c => c.id);
  newState.hands[playerId] = newState.hands[playerId].filter(c => !cardIds.includes(c.id));

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
  const newState = JSON.parse(JSON.stringify(state));
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
  const newState = JSON.parse(JSON.stringify(state));
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
};
