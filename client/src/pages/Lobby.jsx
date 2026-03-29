import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Lobby() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [error, setError] = useState('');

  const createRoom = () => {
    if (!socket) {
      setError('Connecting to server...');
      return;
    }

    setError('');
    socket.once('room_created', ({ roomId }) => {
      navigate(`/room/${roomId}`);
    });
    socket.emit('create_room', { maxPlayers });
  };

  const joinRoom = () => {
    if (!roomCode.trim()) return setError('Enter a room code');

    const nextRoomId = roomCode.trim().toUpperCase();
    setError('');
    navigate(`/room/${nextRoomId}`);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-felt p-4 font-body">
      <div className="absolute inset-0 bg-black/40 pointer-events-none" />
      <div className="relative glass-panel rounded-3xl shadow-2xl p-8 w-full max-w-md z-10">

        <div className="flex justify-between items-center mb-8 border-b border-amber-500/20 pb-4">
          <h1 className="text-2xl font-heading font-bold tracking-widest text-gold-gradient drop-shadow-md">
            FIDEL'S POKER
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-stone-300 text-sm font-medium">@{user?.username}</span>
            <button onClick={logout} className="text-sm text-red-400 hover:text-red-300 transition-colors uppercase tracking-wide font-bold">Logout</button>
          </div>
        </div>

        {error && <p className="bg-red-900/50 border border-red-500/50 text-red-200 p-3 rounded-lg mb-6 text-sm backdrop-blur-sm">{error}</p>}

        <div className="space-y-6">
          <div className="bg-black/20 border border-amber-500/20 rounded-2xl p-5 backdrop-blur-sm">
            <h2 className="font-bold text-amber-500 uppercase tracking-widest text-sm mb-4">Host a Table</h2>
            <div className="flex items-center justify-between mb-5">
              <label className="text-sm text-stone-300 font-medium">Table Size (Players):</label>
              <select
                value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))}
                className="input-dark rounded-lg px-3 py-1 text-sm font-bold w-20 text-center"
              >
                {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              onClick={createRoom}
              className="w-full btn-gold rounded-xl py-3 font-bold tracking-widest uppercase text-sm shadow-lg"
            >
              Open New Table
            </button>
          </div>

          <div className="flex items-center gap-4 my-2 opacity-50">
            <div className="h-px bg-amber-500 flex-1"></div>
            <span className="text-amber-500 font-bold uppercase text-xs tracking-widest">OR</span>
            <div className="h-px bg-amber-500 flex-1"></div>
          </div>

          <div className="bg-black/20 border border-amber-500/20 rounded-2xl p-5 backdrop-blur-sm">
            <h2 className="font-bold text-amber-500 uppercase tracking-widest text-sm mb-4">Join a Table</h2>
            <input
              type="text"
              placeholder="ENTER ROOM CODE"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full input-dark rounded-xl px-4 py-3 mb-4 text-center font-mono text-xl tracking-[0.2em] font-bold"
            />
            <button
              onClick={joinRoom}
              className="w-full bg-stone-800 hover:bg-stone-700 text-amber-500 border border-amber-500/50 transition-all rounded-xl py-3 font-bold tracking-widest uppercase text-sm shadow-lg"
            >
              Take a Seat
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

