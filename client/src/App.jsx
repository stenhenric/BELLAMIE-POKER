import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Lobby from './pages/Lobby';
import Room from './pages/Room';
import Game from './pages/Game';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-green-900 flex items-center justify-center text-white">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

function HomeRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-green-900 flex items-center justify-center text-white">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const activeGameRoomId = localStorage.getItem('activeGameRoomId');
  if (activeGameRoomId) {
    return <Navigate to={`/game/${activeGameRoomId}`} replace />;
  }

  return <Navigate to="/lobby" replace />;
}

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/lobby" element={<PrivateRoute><Lobby /></PrivateRoute>} />
            <Route path="/room/:roomId" element={<PrivateRoute><Room /></PrivateRoute>} />
            <Route path="/game/:roomId" element={<PrivateRoute><Game /></PrivateRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;
