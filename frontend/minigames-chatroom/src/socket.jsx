import { io } from "socket.io-client";

const SOCKET_URL = process.env.VITE_API_URL;
let socket = null;

export const initializeSocket = (token) => {
    if (socket && socket.connected) {
        return socket;
    }

    if (!socket && token) {
        socket = io(SOCKET_URL, {
            auth: {
                token: token
            },
            transports: ['websocket', 'polling'],
            withCredentials: true,
            timeout: 10000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000
        });

        socket.on('connect', () => {
            console.log("Socket connected successfully");
        });

        socket.on('connect_error', (err) => {
            console.error("Socket Auth Error ", err);
            if (err.message.includes('auth') || err.message.includes('401')) {
                console.log("Authentication failed, clearing token...");
                localStorage.removeItem('token');
            }
        });

        socket.on('disconnect', (reason) => {
            console.log("Socket disconnected:", reason);
            if (reason === 'io server disconnect') {
                console.log("Server disconnected socket, may need to reauthenticate");
            }
        });

        socket.on('reconnect_attempt', (attempt) => {
            console.log(`Reconnection attempt ${attempt}`);
        });
    }

    return socket;
}

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
        console.log("Socket manually disconnected!");
    }
}

export const getSocketStatus = () => {
    if (!socket) return 'not_initialized';
    return socket.connected ? 'connected' : 'disconnected';
}