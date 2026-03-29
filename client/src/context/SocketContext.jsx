import { createContext, useContext, useEffect, useMemo } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SERVER_URL } from '../services/api';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const socket = useMemo(() => {
    if (!userId) {
      return null;
    }

    return io(SERVER_URL, {
      auth: { token: localStorage.getItem('token') },
      autoConnect: false,
    });
  }, [userId]);

  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.connect();

    return () => {
      socket.disconnect();
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
