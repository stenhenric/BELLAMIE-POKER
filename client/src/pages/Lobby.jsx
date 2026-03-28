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
    if (!socket) return;
    socket.emit('create_room', { maxPlayers });
    socket.once('room_created', ({ roomId }) => {
      navigate(`/room/${roomId}`);
    });
  };

  const joinRoom = () => {
    if (!socket) return;
    if (!roomCode.trim()) return setError('Enter a room code');
    setError('');
    socket.emit('join_room', { roomId: roomCode.toUpperCase() });
    socket.once('error', ({ message }) => setError(message));
    socket.once('room_update', () => navigate(`/room/${roomCode.toUpperCase()}`));
  };

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-green-800">KADI</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">@{user?.username}</span>
            <button onClick={logout} className="text-sm text-red-500 hover:underline">Logout</button>
          </div>
        </div>

        {error && <p className="bg-red-100 text-red-600 p-3 rounded mb-4 text-sm">{error}</p>}

        <div className="space-y-6">
          <div className="border border-gray-200 rounded-xl p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Create a Room</h2>
            <div className="flex items-center gap-3 mb-3">
              <label className="text-sm text-gray-600">Max Players:</label>
              <select
                value={maxPlayers}
                onChange={e => setMaxPlayers(Number(e.target.value))}
                className="border rounded px-2 py-1 text-sm"
              >
                {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <button
              onClick={createRoom}
              className="w-full bg-green-700 text-white py-2 rounded-lg font-semibold hover:bg-green-800"
            >
              Create Room
            </button>
          </div>

          <div className="border border-gray-200 rounded-xl p-4">
            <h2 className="font-semibold text-gray-700 mb-3">Join a Room</h2>
            <input
              type="text"
              placeholder="Enter room code"
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-green-500 uppercase tracking-widest text-center font-mono text-lg"
            />
            <button
              onClick={joinRoom}
              className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700"
            >
              Join Room
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
