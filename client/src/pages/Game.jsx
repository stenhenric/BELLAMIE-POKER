import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠', special: '♠' };
const SUIT_COLOURS = { hearts: 'text-red-500', diamonds: 'text-red-500', clubs: 'text-gray-800', spades: 'text-gray-800', special: 'text-purple-700' };

const CARD_ORDER = ['special', 'A', 'JOKER', '2', '3', '4', '5', '6', '7', '8', 'Q', '9', '10', 'J', 'K'];

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
  const [gameOver, setGameOver] = useState(null);
  const [nikoKadiDeclared, setNikoKadiDeclared] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Sync state on mount (page reload) and on every reconnect
    socket.emit('rejoin_game', { roomId });
    socket.on('connect', () => socket.emit('rejoin_game', { roomId }));

    socket.on('game_state', (state) => {
      setGameState(state);
      setSelected([]);
    });

    socket.on('error', ({ message }) => {
      setMessage(message);
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('game_over', ({ username }) => setGameOver(username));

    socket.on('niko_kadi_declared', ({ username }) => {
      setMessage(`🔔 ${username} says NIKO KADI!`);
      setTimeout(() => setMessage(''), 4000);
    });

    socket.on('niko_kadi_missed', ({ username }) => {
      setMessage(`⚠ ${username} forgot NIKO KADI — fined 1 card!`);
      setTimeout(() => setMessage(''), 4000);
    });

    socket.on('fined', ({ message }) => {
      setMessage(`❌ ${message}`);
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('player_eliminated', ({ username }) => {
      setMessage(`💀 ${username} eliminated (15 cards)!`);
      setTimeout(() => setMessage(''), 3000);
    });

    socket.on('player_disconnected', ({ username }) => {
      setMessage(`⚠ ${username} disconnected — waiting for them to reconnect...`);
      setTimeout(() => setMessage(''), 5000);
    });

    socket.on('player_reconnected', ({ username }) => {
      setMessage(`✓ ${username} reconnected`);
      setTimeout(() => setMessage(''), 3000);
    });

    return () => {
      socket.off('connect');
      socket.off('game_state');
      socket.off('error');
      socket.off('game_over');
      socket.off('niko_kadi_declared');
      socket.off('niko_kadi_missed');
      socket.off('fined');
      socket.off('player_eliminated');
      socket.off('player_disconnected');
      socket.off('player_reconnected');
    };
  }, [socket, roomId]);

  const isMyTurn = gameState?.currentPlayerId === user?.id;

  const toggleCard = (card) => {
    if (!isMyTurn) return;
    setSelected(prev =>
      prev.find(c => c.id === card.id)
        ? prev.filter(c => c.id !== card.id)
        : [...prev, card]
    );
  };

  const playCards = () => {
    if (selected.length === 0) return;
    const needsSuitPick = selected.every(c => c.rank === 'A' && !c.isSpecialAce);
    if (needsSuitPick) { setShowSuitPicker(true); return; }
    socket.emit('play_cards', { cards: selected });
  };

  const pickCards = () => socket.emit('pick_cards');
  const pickAnswer = () => socket.emit('pick_answer');

  const declareNikoKadi = () => {
    socket.emit('niko_kadi');
    setNikoKadiDeclared(true);
  };

  const confirmSuit = (suit) => {
    socket.emit('play_cards', { cards: selected, chosenSuit: suit });
    setShowSuitPicker(false);
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

      {/* Special Ace call */}
      {gameState.specialAceCall && (
        <div className="bg-purple-600 text-white text-center py-2 rounded-lg font-bold">
          ♠ Special Ace called: {gameState.specialAceCall.card?.rank} of {gameState.specialAceCall.card?.suit}
        </div>
      )}

      {/* Players */}
      <div className="flex gap-2 flex-wrap justify-center">
        {gameState.players.map(p => (
          <div
            key={p.id}
            className={`bg-white rounded-lg px-3 py-2 text-sm text-center min-w-20
              ${p.id === gameState.currentPlayerId ? 'ring-2 ring-yellow-400' : ''}
              ${p.eliminated ? 'opacity-40 line-through' : ''}
            `}
          >
            <div className="font-semibold">{p.username}</div>
            <div className="text-gray-500">{p.cardCount} cards</div>
            {gameState.nikokadi[p.id] && (
              <div className="text-purple-600 text-xs font-bold animate-pulse">🔔 NIKO KADI</div>
            )}
            {gameState.nikoKadiWindow === p.id && !gameState.nikokadi[p.id] && (
              <div className="text-yellow-500 text-xs font-bold">⏳ must declare...</div>
            )}
          </div>
        ))}
      </div>

      {/* Discard pile */}
      <div className="flex justify-center my-2">
        <div className="text-center">
          <p className="text-white text-sm mb-2">Top Card</p>
          {topCard && <CardDisplay card={topCard} />}
        </div>
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
                {gameState.nikoKadiWindow === user?.id && !nikoKadiDeclared && (
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
    </div>
  );
}
