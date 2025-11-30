import { io } from "socket.io-client";
import {API_URL} from "./config.js";

const SOCKET_URL = API_URL;
let socket = null;

export const initializeSocket = (token) => {
    console.log('Initializing socket with token:', {
        hasToken: !!token,
        tokenLength: token?.length,
        apiUrl: SOCKET_URL
    });

    if (socket && socket.connected) {
        console.log('Socket already connected, reusing');
        return socket;
    }

    // Disconnect existing socket if any
    if (socket) {
        console.log('Disconnecting existing socket');
        socket.disconnect();
        socket = null;
    }

    if (token) {
        console.log('Creating new socket connection');

        const socketOptions = {
            auth: {
                token: token
            },
            transports: ['polling'],
            withCredentials: true,
            autoConnect: true,
            forceNew: true
        };

        console.log('🔌 Socket options:', socketOptions);

        socket = io(SOCKET_URL, socketOptions);

        socket.on('connect', () => {
            console.log('Socket connected successfully!');
            console.log('Socket ID:', socket.id);
            console.log('Transport:', socket.io.engine?.transport?.name);
        });

        socket.on('connect_error', (err) => {
            console.error("Socket connection error:", err);
            console.error("Error message:", err.message);
            console.error("Error type:", err.type);
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
        });

        setTimeout(() => {
            if (!socket.connected) {
                console.log('Socket not connected after 2 seconds, attempting manual connect');
                socket.connect();
            }
        }, 2000);
    } else {
        console.error('No token provided for socket initialization');
    }

    return socket;
}

export const getSocket = () => {
    console.log('Getting socket:', {
        exists: !!socket,
        connected: socket?.connected,
        id: socket?.id
    });
    return socket;
}

export const disconnectSocket = () => {
    if (socket) {
        console.log('Manually disconnecting socket');
        socket.disconnect();
        socket = null;
        console.log("Socket disconnected!");
    }
}
