import { io } from 'socket.io-client';

// Since you are using Vite, we use import.meta.env
// Make sure to define VITE_BACKEND_URL in your .env file (e.g., http://localhost:5000)
const SERVER_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const socket = io(SERVER_URL, {
  autoConnect: false,           // Set to false so we only connect when the user actually enters a game/dashboard
  withCredentials: true,        // Essential if you are using HTTP cookies/sessions for authentication
  transports: ['websocket'],    // Force WebSocket first for lower latency (skips HTTP long-polling)
  reconnectionAttempts: 5,      // How many times to try reconnecting if the network drops
  reconnectionDelay: 1000,      // Wait 1 second before trying to reconnect
});

export default socket;