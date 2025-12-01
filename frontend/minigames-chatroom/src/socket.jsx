import { io } from "socket.io-client";

let socket = null;

export const initializeSocket = (token) => {
    if (socket && socket.connected) return socket;

    const BACKEND_URL = import.meta.env.VITE_API_URL;

    socket = io(BACKEND_URL, {
        transports: ['websocket', 'polling'],
        withCredentials: true,
        auth: { token },
        path: '/socket.io/',
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 20000,
    });

    socket.on('connect', () => {
        console.log('Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
        console.error('Socket connection error:', err.message);
    });

    socket.on('disconnect', (reason) => {
        console.warn('Socket disconnected:', reason);
    });

    return socket;
};

export const disconnectSocket = () => {
    if (socket) {
        console.log('Disconnecting socket...');
        socket.disconnect();
        socket = null;
    }
};
