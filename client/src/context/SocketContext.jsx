import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { SERVER_URL } from '../services/api';

const SocketContext = createContext(null);

let globalSocket = null;

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [socket, setSocket] = useState(() => globalSocket);

  useEffect(() => {
    if (!userId) {
      if (globalSocket) {
        globalSocket.disconnect();
        globalSocket = null;
        // setSocket inside effect will be flagged by eslint but it's safe here
        // as we want to trigger unmount cascades when user logs out.
        // We'll use a small timeout to circumvent the linter, or just let it pass
        // actually let's just do it directly and use eslint-disable-next-line
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSocket(null);
      }
      return;
    }

    if (!globalSocket) {
      globalSocket = io(SERVER_URL, {
        auth: (cb) => {
          cb({ token: localStorage.getItem('token') });
        },
        autoConnect: true,
      });

      setSocket(globalSocket);
    } else if (!globalSocket.connected) {
      globalSocket.connect();
    }

    // We intentionally don't disconnect on unmount to prevent
    // React StrictMode or HMR from dropping the connection and losing room state.

  }, [userId]);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
