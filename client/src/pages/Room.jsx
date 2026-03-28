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

    socket.emit('join_room', { roomId });

    socket.on('room_update', (data) => setRoom(data));
    socket.on('game_start', () => navigate(`/game/${roomId}`));
    socket.on('error', ({ message }) => setError(message));

    return () => {
      socket.off('room_update');
      socket.off('game_start');
      socket.off('error');
    };
  }, [socket, roomId, navigate]);

  const startGame = () => {
    socket.emit('start_game');
  };

  const isHost = room?.players[0]?.id === user?.id;

  return (
    <div className="min-h-screen bg-green-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-green-800 mb-1">Room</h1>
        <p className="text-gray-500 text-sm mb-6 font-mono tracking-widest text-lg font-bold">{roomId}</p>

        {error && <p className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm">{error}</p>}

        <div className="mb-6">
          <h2 className="font-semibold text-gray-700 mb-2">
            Players ({room?.players.length || 0}/{room?.maxPlayers || '?'})
          </h2>
          <ul className="space-y-2">
            {room?.players.map((p, i) => (
              <li key={p.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-4 py-2">
                <span>{i === 0 ? '👑' : '🃏'}</span>
                <span className="font-medium">{p.username}</span>
                {p.id === user?.id && <span className="text-xs text-gray-400">(you)</span>}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-gray-400 text-center mb-4">
          {isHost ? 'You are the host. Start when ready!' : 'Waiting for host to start...'}
        </p>

        {isHost && (
          <button
            onClick={startGame}
            disabled={!room || room.players.length < 2}
            className="w-full bg-green-700 text-white py-2 rounded-lg font-semibold hover:bg-green-800 disabled:opacity-40"
          >
            Start Game
          </button>
        )}
      </div>
    </div>
  );
}
