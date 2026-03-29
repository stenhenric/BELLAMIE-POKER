import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
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
        relative w-16 h-24 rounded-lg flex flex-col items-center justify-between py-1 shadow-xl
        transition-all duration-300 ease-[cubic-bezier(0.25,0.8,0.25,1)]
        border-[3px]
        ${selected ? 'border-amber-400 -translate-y-4 shadow-amber-500/30' : 'border-stone-200 hover:-translate-y-2 hover:shadow-2xl hover:border-stone-100'}
        ${isSpecial && !selected ? 'border-purple-300' : ''}
        bg-white overflow-hidden group
      `}
    >
      {/* Premium card texture background */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #000 1px, transparent 1px)', backgroundSize: '4px 4px' }}></div>

      <div className={`text-sm font-bold w-full text-left pl-1 leading-none ${isRed ? 'text-red-600' : isSpecial ? 'text-purple-700' : 'text-stone-900'}`}>
        {card.rank === 'JOKER' ? 'J' : card.rank}
      </div>

      <div className={`text-2xl filter drop-shadow-sm ${isRed ? 'text-red-600' : isSpecial ? 'text-purple-700' : 'text-stone-900'} ${card.rank === 'JOKER' ? 'text-3xl' : ''}`}>
        {card.rank === 'JOKER' ? '🃏' : SUIT_SYMBOLS[card.suit]}
      </div>

      <div className={`text-sm font-bold w-full text-right pr-1 leading-none rotate-180 ${isRed ? 'text-red-600' : isSpecial ? 'text-purple-700' : 'text-stone-900'}`}>
        {card.rank === 'JOKER' ? 'J' : card.rank}
      </div>
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

  const circlePositions = useMemo(() => {
    return getCirclePositions(gameState?.players || [], user?.id);
  }, [gameState?.players, user?.id]);

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
      <div className="min-h-screen bg-felt flex items-center justify-center font-body p-4">
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        <div className="relative glass-panel rounded-3xl p-10 text-center shadow-2xl z-10 w-full max-w-md">
          <h1 className="text-4xl font-heading font-bold text-gold-gradient drop-shadow-md mb-2 tracking-widest uppercase">Game Over</h1>
          <div className="h-px w-32 mx-auto bg-gradient-to-r from-transparent via-amber-500 to-transparent opacity-50 mb-6"></div>

          <div className="bg-black/30 border border-amber-500/30 rounded-2xl py-8 px-4 mb-8">
            <p className="text-5xl mb-4 filter drop-shadow-lg">🏆</p>
            <p className="text-2xl font-bold text-stone-100 tracking-wide">{gameOver}</p>
            <p className="text-amber-500 uppercase tracking-widest text-xs font-bold mt-2">Takes the pot</p>
          </div>

          <button onClick={() => window.location.href = '/lobby'} className="btn-gold w-full px-6 py-4 rounded-xl font-bold tracking-widest uppercase text-sm">
            Return to Lounge
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return <div className="min-h-screen bg-felt flex items-center justify-center font-heading text-gold-gradient text-2xl font-bold tracking-widest uppercase">Dealing Cards...</div>;
  }

  const topCard = gameState.discardPile[0];

  return (
    <div className="min-h-screen bg-felt p-4 flex flex-col gap-4 font-body text-stone-200">
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.8)] z-0"></div>

      {/* Header */}
      <div className="relative z-10 flex justify-between items-center glass-panel px-6 py-3 rounded-full border border-amber-500/20 shadow-lg mx-auto w-full max-w-4xl">
        <span className="font-heading font-bold text-xl text-gold-gradient tracking-widest">VIP TABLE</span>
        <span className="text-xs font-bold tracking-[0.2em] uppercase bg-black/40 px-3 py-1 rounded text-amber-500/80">Code: {roomId}</span>
        <span className="text-sm font-bold tracking-wide flex items-center gap-2">
          <span className="text-stone-400 uppercase text-xs">Suit:</span>
          <span className={`px-3 py-1 rounded-md text-xs uppercase tracking-widest border ${
            gameState.activeSuit === 'hearts' || gameState.activeSuit === 'diamonds'
              ? 'bg-red-950/40 text-red-500 border-red-500/30'
              : 'bg-stone-900/40 text-stone-300 border-stone-500/30'
          }`}>
            {gameState.activeSuit} {SUIT_SYMBOLS[gameState.activeSuit]}
          </span>
        </span>
      </div>

      {/* Message Area */}
      <div className="relative z-10 h-12 flex justify-center items-center">
        {message && (
          <div className="bg-amber-500 text-stone-900 font-bold px-6 py-2 rounded-full text-sm tracking-wide shadow-[0_0_15px_rgba(251,191,36,0.5)] animate-bounce-slow">
            {message}
          </div>
        )}
      </div>

      {/* Action Hints */}
      <div className="relative z-10 flex flex-col gap-2 items-center max-w-md mx-auto w-full">
        {gameState.activeFeed && (
          <div className="bg-red-950/80 border border-red-500 text-red-100 w-full text-center py-2 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(220,38,38,0.4)] tracking-wide">
            ⚠ Feed Stack: Pick {gameState.feedStack} cards!
          </div>
        )}

        {gameState.awaitingAnswer && (
          <div className="bg-blue-950/80 border border-blue-500 text-blue-100 w-full text-center py-2 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(59,130,246,0.4)] tracking-wide">
            ❓ No answer in hand — pick a card to pass turn
          </div>
        )}

        {isMyTurn && !gameState.awaitingAnswer && selected.some(c => c.rank === '8' || c.rank === 'Q') && (
          <div className="bg-indigo-950/80 border border-indigo-400 text-indigo-100 w-full text-center py-2 rounded-lg text-sm font-bold tracking-wide">
            ❓ Select matching answer card, or play questions and pick answer
          </div>
        )}

        {isMyTurn && hasSpecialAceSelected && (
          <div className="bg-purple-950/80 border border-purple-500 text-purple-100 w-full text-center py-2 rounded-lg text-sm font-bold tracking-wide shadow-[0_0_15px_rgba(168,85,247,0.4)]">
            ♠ Special Ace selected - choose card to call
          </div>
        )}

        {gameState.specialAceCall && (
          <div className="bg-purple-900 text-purple-100 w-full text-center py-2 rounded-lg font-bold text-sm tracking-wide border border-purple-400">
            ♠ Call: {gameState.specialAceCall.card?.rank} of {gameState.specialAceCall.card?.suit}
          </div>
        )}
      </div>

      {/* Circular table */}
      <div className="relative w-72 h-72 sm:w-96 sm:h-96 mx-auto my-auto z-10 flex-shrink-0">

        {/* Table inner edge styling */}
        <div className="absolute inset-4 rounded-full border-4 border-stone-800/40 bg-black/10 shadow-[inset_0_0_40px_rgba(0,0,0,0.6)]"></div>
        <div className="absolute inset-5 rounded-full border border-amber-500/20"></div>

        {/* Direction arrow SVG */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" style={{ zIndex: 1, filter: 'drop-shadow(0 0 4px rgba(251,191,36,0.5))' }}>
          <defs>
            <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="2" refY="2" orient="auto">
              <path d="M0,0 L0,4 L4,2 z" fill="#facc15" />
            </marker>
          </defs>
          {(() => {
            const positions = circlePositions;
            const currentIdx = gameState.players.findIndex(p => p.id === gameState.currentPlayerId);
            const nextIdx = (currentIdx + gameState.direction + gameState.players.length) % gameState.players.length;
            const from = positions[currentIdx];
            const to = positions[nextIdx];
            if (!from || !to) return null;
            const dx = to.x - from.x, dy = to.y - from.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;
            const pad = 12;
            return (
              <line
                x1={from.x + dx * (pad / dist)} y1={from.y + dy * (pad / dist)}
                x2={from.x + dx * ((dist - pad) / dist)} y2={from.y + dy * ((dist - pad) / dist)}
                stroke="#facc15" strokeWidth="0.8" markerEnd="url(#arrowhead)" opacity="0.6"
              />
            );
          })()}
        </svg>

        {/* Center: top card + direction indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className="relative">
            {/* Deck shadow/stack effect */}
            <div className="absolute top-1 left-1 w-16 h-24 bg-stone-300 rounded-lg border border-stone-400"></div>
            <div className="absolute top-0.5 left-0.5 w-16 h-24 bg-stone-200 rounded-lg border border-stone-300"></div>
            {topCard && (
              <div className="relative transform rotate-[-3deg] hover:rotate-0 transition-transform duration-300">
                <CardDisplay card={topCard} />
              </div>
            )}
          </div>
          <div className="text-amber-500/50 text-3xl font-bold mt-4 select-none drop-shadow-md">
            {gameState.direction === 1 ? '↻' : '↺'}
          </div>
        </div>

        {/* Players around the circle */}
        {circlePositions.map(({ player, x, y }) => (
          <div
            key={player.id}
            className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
          >
            <div className={`
              rounded-xl px-3 py-2 text-center min-w-[90px] backdrop-blur-md border transition-all duration-300 shadow-xl
              ${player.id === gameState.currentPlayerId
                ? 'bg-stone-900/90 border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] scale-110 z-30'
                : 'bg-black/60 border-stone-700/50 text-stone-400'}
              ${player.eliminated ? 'opacity-30 grayscale' : ''}
            `}>
              <div className={`font-bold truncate text-xs tracking-wide ${player.id === gameState.currentPlayerId ? 'text-amber-400' : 'text-stone-200'} ${player.eliminated ? 'line-through' : ''}`}>
                {player.username}
              </div>

              <div className="flex justify-center gap-1 mt-1">
                {/* Visual card counter */}
                <div className="flex items-center gap-1 text-[10px] font-mono font-bold bg-black/40 px-2 py-0.5 rounded text-stone-300">
                  <span>🎴</span> {player.cardCount}
                </div>
              </div>

              {/* Status badges */}
              <div className="absolute -top-2 -right-2 flex gap-1">
                {gameState.nikokadi[player.id] && (
                  <div className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow border border-purple-400 animate-pulse">NK</div>
                )}
                {gameState.nikoKadiWindow === player.id && !gameState.nikokadi[player.id] && (
                  <div className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow border border-orange-300">⏳</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Turn indicator */}
      <div className="relative z-10 text-center mb-2">
        <p className={`inline-block px-6 py-1.5 rounded-full font-bold text-xs tracking-[0.2em] uppercase border ${
          isMyTurn
            ? 'bg-amber-500/20 text-amber-400 border-amber-500/50 shadow-[0_0_15px_rgba(251,191,36,0.2)]'
            : 'bg-black/40 text-stone-400 border-stone-700/50'
        }`}>
          {isMyTurn ? 'YOUR TURN TO ACT' : `Waiting for ${gameState.players.find(p => p.id === gameState.currentPlayerId)?.username}`}
        </p>
      </div>

      {/* My hand & Controls */}
      <div className="relative z-10 mt-auto bg-black/40 backdrop-blur-md rounded-t-3xl border-t border-x border-stone-700/50 p-4 pb-8 -mx-4">

        {/* Actions Row */}
        {isMyTurn && (
          <div className="flex gap-3 justify-center flex-wrap mb-6 max-w-2xl mx-auto">
            {gameState.awaitingAnswer ? (
              <button
                onClick={pickAnswer}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-[0_4px_15px_rgba(37,99,235,0.4)] transition-all animate-pulse"
              >
                Pick Answer Card
              </button>
            ) : (
              <>
                <button
                  onClick={playCards}
                  disabled={selected.length === 0}
                  className={`
                    px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all
                    ${selected.length > 0
                      ? 'bg-green-600 hover:bg-green-500 text-white shadow-[0_4px_15px_rgba(22,163,74,0.4)] transform hover:-translate-y-1'
                      : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700'}
                  `}
                >
                  Play {selected.length > 0 ? `(${selected.length})` : ''}
                </button>
                <button
                  onClick={pickCards}
                  className="bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-600 px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-lg transition-all transform hover:-translate-y-1"
                >
                  Pick {gameState.activeFeed ? gameState.feedStack : 'Card'}
                </button>
                {gameState.nikoKadiWindow === user?.id && !gameState.nikokadi[user?.id] && (
                  <button
                    onClick={declareNikoKadi}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm shadow-[0_4px_20px_rgba(147,51,234,0.6)] border border-purple-400 animate-pulse"
                  >
                    NIKO KADI!
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex justify-between items-end mb-3 px-2 max-w-4xl mx-auto w-full">
          <p className="text-stone-400 text-xs font-bold tracking-widest uppercase">Your Hand</p>
          <p className="text-amber-500 text-xs font-bold tracking-widest bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">{gameState.myHand.length} CARDS</p>
        </div>

        {/* Cards Container */}
        <div className="flex flex-wrap gap-x-2 gap-y-4 justify-center max-w-4xl mx-auto px-2">
          {sortHand(gameState.myHand).map(card => (
            <div key={card.id} className="transform transition-transform hover:z-10 hover:scale-105">
              <CardDisplay
                card={card}
                selected={!!selected.find(c => c.id === card.id)}
                onClick={() => toggleCard(card)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Suit Picker Modal */}
      {showSuitPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-amber-500/30 w-full max-w-sm transform transition-all">
            <h2 className="text-xl font-heading font-bold text-center mb-6 text-gold-gradient tracking-widest uppercase">Select Suit</h2>
            <div className="grid grid-cols-2 gap-4">
              {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                <button
                  key={suit}
                  onClick={() => confirmSuit(suit)}
                  className="flex flex-col items-center gap-3 border border-stone-700 bg-stone-900/50 rounded-2xl px-4 py-6 hover:border-amber-400 hover:bg-stone-800 hover:-translate-y-1 transition-all group shadow-lg"
                >
                  <span className={`text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform ${suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-stone-300'}`}>
                    {SUIT_SYMBOLS[suit]}
                  </span>
                  <span className="font-bold tracking-widest uppercase text-xs text-stone-300 group-hover:text-amber-400">
                    {suit}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showCallPicker && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-panel rounded-3xl p-8 shadow-2xl border border-purple-500/40 w-full max-w-sm">
            <h2 className="text-xl font-heading font-bold text-center mb-6 text-purple-400 tracking-widest uppercase drop-shadow-[0_0_10px_rgba(192,132,252,0.5)]">Call Specific Card</h2>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-2">
                  Select Rank
                </label>
                <select
                  value={calledCard.rank}
                  onChange={(e) => setCalledCard(prev => ({ ...prev, rank: e.target.value }))}
                  className="w-full bg-stone-900 border border-purple-500/30 text-stone-200 rounded-xl px-4 py-3 font-bold focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                >
                  {CALLABLE_RANKS.map(rank => (
                    <option key={rank} value={rank}>{rank}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-purple-300 uppercase tracking-widest mb-2">
                  Select Suit
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['hearts', 'diamonds', 'clubs', 'spades'].map(suit => (
                    <button
                      key={suit}
                      type="button"
                      onClick={() => setCalledCard(prev => ({ ...prev, suit }))}
                      className={`
                        flex justify-center items-center py-3 rounded-lg border transition-all text-xl
                        ${calledCard.suit === suit
                          ? 'bg-purple-900/60 border-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                          : 'bg-stone-900 border-stone-700 hover:border-purple-500/50'}
                      `}
                    >
                      <span className={suit === 'hearts' || suit === 'diamonds' ? 'text-red-500' : 'text-stone-300'}>
                        {SUIT_SYMBOLS[suit]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-4">
              <button
                type="button"
                onClick={() => setShowCallPicker(false)}
                className="flex-1 border border-stone-600 text-stone-300 rounded-xl px-4 py-3 font-bold uppercase tracking-widest text-xs hover:bg-stone-800 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCalledCard}
                className="flex-1 bg-purple-600 text-white rounded-xl px-4 py-3 font-bold uppercase tracking-widest text-xs hover:bg-purple-500 shadow-[0_4px_15px_rgba(147,51,234,0.4)] transition-all"
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
