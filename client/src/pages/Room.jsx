import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!socket) return;

    const handleRoomUpdate = (data) => setRoom(data);
    const handleGameStart = () => navigate(`/game/${roomId}`);
    const handleAppError = ({ message }) => setError(message);

    socket.on('room_update', handleRoomUpdate);
    socket.on('game_start', handleGameStart);
    socket.on('app_error', handleAppError);
    socket.emit('join_room', { roomId });

    return () => {
      socket.off('room_update', handleRoomUpdate);
      socket.off('game_start', handleGameStart);
      socket.off('app_error', handleAppError);
    };
  }, [socket, roomId, navigate]);

  const startGame = () => {
    socket.emit('start_game');
  };

  const isHost = room?.players[0]?.id === user?.id;

  return (
    <div className="min-h-screen flex items-center justify-center bg-felt p-4 font-body">
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="relative glass-panel rounded-3xl shadow-2xl p-8 w-full max-w-md z-10">

        <div className="text-center mb-6">
          <h1 className="text-3xl font-heading font-bold tracking-widest text-gold-gradient drop-shadow-md mb-2">
            VIP TABLE
          </h1>
          <div className="inline-block bg-black/40 border border-amber-500/30 rounded-lg px-6 py-2">
            <p className="text-amber-400/80 uppercase text-xs tracking-[0.2em] mb-1 font-bold">Access Code</p>
            <p className="text-stone-100 font-mono tracking-[0.3em] text-2xl font-bold">{roomId}</p>
          </div>
        </div>

        {error && <p className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm backdrop-blur-sm text-center">{error}</p>}

        <div className="bg-black/20 border border-amber-500/20 rounded-2xl p-5 backdrop-blur-sm mb-6">
          <h2 className="font-bold text-amber-500 uppercase tracking-widest text-sm mb-4 flex justify-between items-center">
            <span>Seated Players</span>
            <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded text-xs">
              {room?.players.length || 0} / {room?.maxPlayers || '?'}
            </span>
          </h2>

          <ul className="space-y-3">
            {room?.players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 bg-stone-900/50 border border-stone-700/50 rounded-xl px-4 py-3">
                <span className="text-xl filter drop-shadow-md">{i === 0 ? '👑' : '🃏'}</span>
                <span className="font-bold text-stone-200 tracking-wide text-sm">{p.username}</span>
                {p.id === user?.id && <span className="ml-auto text-xs font-bold text-amber-500/60 uppercase tracking-widest">You</span>}
              </li>
            ))}

            {/* Empty seats placeholders */}
            {room && Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
              <li key={`empty-${i}`} className="flex items-center gap-3 bg-stone-900/20 border border-stone-800/50 border-dashed rounded-xl px-4 py-3 opacity-50">
                <span className="text-xl grayscale opacity-30">🪑</span>
                <span className="font-medium text-stone-500 tracking-wide text-sm italic">Empty Seat</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-center">
          <p className="text-sm text-amber-100/50 mb-5 font-medium tracking-wide">
            {isHost ? 'Waiting for players to join the table...' : 'Waiting for the dealer (host) to begin...'}
          </p>

          {isHost && (
            <button
              onClick={startGame}
              disabled={!room || room.players.length < 2}
              className="w-full btn-gold rounded-xl py-4 font-bold tracking-widest uppercase text-sm shadow-lg"
            >
              Deal Cards
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
