import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', special: '♠' };
const SUIT_COLOURS = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-gray-800', spades: 'text-gray-800', special: 'text-purple-700' };
const CALLABLE_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const CARD_ORDER = ['special', 'A', 'JOKER', '2', '3', '4', '5', '6', '7', '8', 'Q', '9', '10', 'J', 'K'];

function getCirclePositions(players, myId) {
  const n = players.length;
  const myIndex = players.findIndex(p => p.id === myId);
  const base = myIndex === -1 ? 0 : myIndex;
  return players.map((player, i) => {
    const angleDeg = 90 + ((i - base) * 360 / n);
    const angleRad = (angleDeg * Math.PI) / 180;
    return { player, x: 50 + 40 * Math.cos(angleRad), y: 50 + 40 * Math.sin(angleRad) };
  });
}

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    const aKey = a.isSpecialAce ? 'special' : a.rank;
    const bKey = b.isSpecialAce ? 'special' : b.rank;
    return CARD_ORDER.indexOf(aKey) - CARD_ORDER.indexOf(bKey);
  });
}

function CardDisplay({ card, selected, onClick }) {
  const isRed = card.colour === 'red';
  const isSpecial = card.isSpecialAce;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        w-14 h-20 rounded-lg border-2 flex flex-col items-center justify-center text-sm font-bold shadow
        transition-transform
        ${selected ? 'border-yellow-400 -translate-y-3 bg-yellow-50' : 'border-gray-300 bg-white hover:-translate-y-1'}
        ${isSpecial ? 'border-purple-500 bg-purple-50' : ''}
      `}
    >
      <span className={isRed ? 'text-red-500' : isSpecial ? 'text-purple-700' : 'text-gray-800'}>
        {card.rank === 'JOKER' ? '🃏' : card.rank}
      </span>
      {card.rank !== 'JOKER' && (
        <span className={SUIT_COLOURS[card.suit] || ''}>
          {SUIT_SYMBOLS[card.suit] || ''}
        </span>
      )}
    </button>
  );
}

export default function Game() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const [gameState, setGameState] = useState(null);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState('');
  const [showSuitPicker, setShowSuitPicker] = useState(false);
  const [showCallPicker, setShowCallPicker] = useState(false);
  const [calledCard, setCalledCard] = useState({ rank: 'A', suit: 'hearts' });
  const [gameOver, setGameOver] = useState(null);
  const messageTimeoutRef = useRef(null);

  const flashMessage = useEffectEvent((nextMessage, duration = 3000) => {
    setMessage(nextMessage);
    window.clearTimeout(messageTimeoutRef.current);
    messageTimeoutRef.current = window.setTimeout(() => setMessage(''), duration);
  });

  useEffect(() => {
    return () => window.clearTimeout(messageTimeoutRef.current);
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Sync state on mount (page reload) and on every reconnect
    const handleConnect = () => socket.emit('rejoin_game', { roomId });
    const handleGameState = (state) => {
      setGameState(state);
      setSelected([]);
      setShowSuitPicker(false);
      setShowCallPicker(false);
    };
    const handleAppError = ({ message: errorMessage }) => flashMessage(errorMessage);
    const handleGameOver = ({ username }) => setGameOver(username);
    const handleNikoKadiDeclared = ({ username }) => flashMessage(`🔔 ${username} says NIKO KADI!`, 4000);
    const handleNikoKadiMissed = ({ username }) => flashMessage(`⚠ ${username} forgot NIKO KADI - fined 1 card!`, 4000);
    const handleFined = ({ message: fineMessage }) => flashMessage(`❌ ${fineMessage}`);
    const handlePlayerEliminated = ({ username }) => flashMessage(`💀 ${username} eliminated (15 cards)!`);
    const handlePlayerDisconnected = ({ username }) => flashMessage(`⚠ ${username} disconnected - waiting for them to reconnect...`, 5000);
    const handlePlayerReconnected = ({ username }) => flashMessage(`✓ ${username} reconnected`);

    socket.emit('rejoin_game', { roomId });
    socket.on('connect', handleConnect);
    socket.on('game_state', handleGameState);
    socket.on('app_error', handleAppError);
    socket.on('game_over', handleGameOver);
    socket.on('niko_kadi_declared', handleNikoKadiDeclared);
    socket.on('niko_kadi_missed', handleNikoKadiMissed);
    socket.on('fined', handleFined);
    socket.on('player_eliminated', handlePlayerEliminated);
    socket.on('player_disconnected', handlePlayerDisconnected);
    socket.on('player_reconnected', handlePlayerReconnected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('game_state', handleGameState);
      socket.off('app_error', handleAppError);
      socket.off('game_over', handleGameOver);
      socket.off('niko_kadi_declared', handleNikoKadiDeclared);
      socket.off('niko_kadi_missed', handleNikoKadiMissed);
      socket.off('fined', handleFined);
      socket.off('player_eliminated', handlePlayerEliminated);
      socket.off('player_disconnected', handlePlayerDisconnected);
      socket.off('player_reconnected', handlePlayerReconnected);
    };
  }, [socket, roomId]);

  const isMyTurn = gameState?.currentPlayerId === user?.id;
  const hasSpecialAceSelected = selected.length === 1 && selected[0]?.isSpecialAce;

  const toggleCard = (card) => {
    if (!isMyTurn) return;
    setSelected(prev =>
      prev.find(c => c.id === card.id)
        ? prev.filter(c => c.id !== card.id)
        : [...prev, card]
    );
  };

  const playCards = () => {
    if (!socket || selected.length === 0) return;

    if (hasSpecialAceSelected) {
      setShowCallPicker(true);
      return;
    }

    const needsSuitPick = selected.every(c => c.rank === 'A' && !c.isSpecialAce);
    if (needsSuitPick) { setShowSuitPicker(true); return; }
    socket.emit('play_cards', { cards: selected });
  };

  const pickCards = () => socket.emit('pick_cards');
  const pickAnswer = () => socket.emit('pick_answer');

  const declareNikoKadi = () => {
    socket.emit('niko_kadi');
  };

  const confirmSuit = (suit) => {
    socket.emit('play_cards', { cards: selected, chosenSuit: suit });
    setShowSuitPicker(false);
  };

  const confirmCalledCard = () => {
    socket.emit('play_cards', { cards: selected, calledCard });
    setShowCallPicker(false);
  };

  if (gameOver) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="bg-white rounded-2xl p-8 text-center shadow-xl">
          <h1 className="text-3xl font-bold text-green-800 mb-2">Game Over!</h1>
          <p className="text-xl text-gray-700">🏆 {gameOver} wins!</p>
          <button onClick={() => window.location.href = '/lobby'} className="mt-6 bg-green-700 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-800">
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return <div className="min-h-screen bg-green-900 flex items-center justify-center text-white text-xl">Loading game...</div>;
  }

  const topCard = gameState.discardPile[0];

  return (
    <div className="min-h-screen bg-green-900 p-4 flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-center text-white">
        <span className="font-bold text-lg">KADI</span>
        <span className="text-sm">Room: {roomId}</span>
        <span className="text-sm">Suit: <span className="font-bold uppercase">{gameState.activeSuit}</span></span>
      </div>

      {/* Message */}
      {message && (
        <div className="bg-yellow-100 text-yellow-800 text-center py-2 px-4 rounded-lg text-sm font-medium">
          {message}
        </div>
      )}

      {/* Feed indicator */}
      {gameState.activeFeed && (
        <div className="bg-red-500 text-white text-center py-2 rounded-lg font-bold">
          ⚠ Feed Stack: Pick {gameState.feedStack} cards!
        </div>
      )}

      {/* Awaiting answer */}
      {gameState.awaitingAnswer && (
        <div className="bg-blue-600 text-white text-center py-2 rounded-lg font-bold">
          ❓ No answer in hand — pick a card, it joins your hand and turn passes
        </div>
      )}

      {/* Question hint */}
      {isMyTurn && !gameState.awaitingAnswer && selected.some(c => c.rank === '8' || c.rank === 'Q') && (
        <div className="bg-blue-500 text-white text-center py-2 rounded-lg text-sm font-medium">
          ❓ Select an answer card of matching suit, or Play questions only then pick answer
        </div>
      )}

      {isMyTurn && hasSpecialAceSelected && (
        <div className="bg-purple-600 text-white text-center py-2 rounded-lg text-sm font-medium">
          ♠ Special Ace selected - choose the exact card you want to call
        </div>
      )}

      {/* Special Ace call */}
      {gameState.specialAceCall && (
        <div className="bg-purple-600 text-white text-center py-2 rounded-lg font-bold">
          ♠ Special Ace called: {gameState.specialAceCall.card?.rank} of {gameState.specialAceCall.card?.suit}
        </div>
      )}

      {/* Circular table */}
      <div className="relative w-80 h-80 mx-auto">
        {/* Direction arrow SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ zIndex: 1 }}>
          <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
              <path d="M0,0 L0,4 L4,2 z" fill="#facc15" />
            </marker>
          </defs>
          {(() => {
            const positions = getCirclePositions(gameState.players, user?.id);
            const currentIdx = gameState.players.findIndex(p => p.id === gameState.currentPlayerId);
            const nextIdx = (currentIdx + gameState.direction + gameState.players.length) % gameState.players.length;
            const from = positions[currentIdx];
            const to = positions[nextIdx];
            if (!from || !to) return null;
            const dx = to.x - from.x, dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;
            const pad = 9;
            return (
              <line
                x1={from.x + dx * (pad / dist)} y1={from.y + dy * (pad / dist)}
                x2={from.x + dx * ((dist - pad) / dist)} y2={from.y + dy * ((dist - pad) / dist)}
                stroke="#facc15" strokeWidth="1.5" markerEnd="url(#arrowhead)"
              />
            );
          })()}
        </svg>

        {/* Center: top card + direction indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          {topCard && <CardDisplay card={topCard} />}
          <div className="text-white text-2xl font-bold mt-1 select-none">
            {gameState.direction === 1 ? '↻' : '↺'}
          </div>
        </div>

        {/* Players around the circle */}
        {getCirclePositions(gameState.players, user?.id).map(({ player, x, y }) => (
          <div
            key={player.id}
            className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div className={`rounded-lg px-2 py-1 text-xs text-center w-20
              ${player.id === gameState.currentPlayerId ? 'bg-yellow-400 ring-2 ring-yellow-200 animate-pulse' : 'bg-white'}
              ${player.eliminated ? 'opacity-40' : ''}
            `}>
              <div className={`font-semibold truncate text-xs ${player.eliminated ? 'line-through' : ''}`}>{player.username}</div>
              <div className="text-gray-600 text-xs">{player.cardCount} cards</div>
              {gameState.nikokadi[player.id] && <div className="text-purple-600 text-xs font-bold animate-pulse">🔔 NK</div>}
              {gameState.nikoKadiWindow === player.id && !gameState.nikokadi[player.id] && (
                <div className="text-orange-500 text-xs font-bold">⏳ NK!</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Turn indicator */}
      <p className={`text-center font-bold text-sm ${isMyTurn ? 'text-yellow-300' : 'text-white/60'}`}>
        {isMyTurn ? 'YOUR TURN' : `Waiting for ${gameState.players.find(p => p.id === gameState.currentPlayerId)?.username}...`}
      </p>

      {/* My hand */}
      <div className="mt-auto">
        <p className="text-white text-sm mb-2 text-center">Your Hand ({gameState.myHand.length} cards)</p>
        <div className="flex flex-wrap gap-2 justify-center mb-4">
          {sortHand(gameState.myHand).map(card => (
            <CardDisplay
              key={card.id}
              card={card}
              selected={!!selected.find(c => c.id === card.id)}
              onClick={() => toggleCard(card)}
            />
          ))}
        </div>

        {/* Actions */}
        {isMyTurn && (
          <div className="flex gap-3 justify-center flex-wrap">
            {gameState.awaitingAnswer ? (
              <button
                onClick={pickAnswer}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 animate-pulse"
              >
                Pick Answer Card
              </button>
            ) : (
              <>
                <button
                  onClick={playCards}
                  disabled={selected.length === 0}
                  className="bg-green-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-600 disabled:opacity-40"
                >
                  Play ({selected.length})
                </button>
                <button
                  onClick={pickCards}
                  className="bg-orange-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-orange-600"
                >
                  Pick {gameState.activeFeed ? gameState.feedStack : 1}
                </button>
                {gameState.nikoKadiWindow === user?.id && !gameState.nikokadi[user?.id] && (
                  <button
                    onClick={declareNikoKadi}
                    className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold animate-pulse hover:bg-purple-700"
                  >
                    NIKO KADI!
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Suit Picker Modal */}
      {showSuitPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-center mb-4">Choose a suit</h2>
            <div className="grid grid-cols-2 gap-3">
              {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                <button
                  key={suit}
                  onClick={() => confirmSuit(suit)}
                  className="flex items-center gap-2 border-2 border-gray-200 rounded-xl px-4 py-3 hover:border-green-500 hover:bg-green-50 font-semibold capitalize"
                >
                  <span className={suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-gray-800'}>
                    {SUIT_SYMBOLS[suit]}
                  </span>
                  {suit}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCallPicker && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm">
            <h2 className="text-lg font-bold text-center mb-4">Call a specific card</h2>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Rank
                <select
                  value={calledCard.rank}
                  onChange={(e) => setCalledCard(prev => ({ ...prev, rank: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {CALLABLE_RANKS.map(rank => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-gray-700">
                Suit
                <select
                  value={calledCard.suit}
                  onChange={(e) => setCalledCard(prev => ({ ...prev, suit: e.target.value }))}
                  className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                >
                  {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                    <option key={suit} value={suit}>{suit}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowCallPicker(false)}
                className="flex-1 border border-gray-300 rounded-lg px-4 py-2 font-semibold text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCalledCard}
                className="flex-1 bg-purple-600 text-white rounded-lg px-4 py-2 font-semibold hover:bg-purple-700"
              >
                Call Card
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
