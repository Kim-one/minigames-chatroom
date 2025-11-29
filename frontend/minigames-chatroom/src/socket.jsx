import { io } from "socket.io-client";
const SOCKET_URL = process.env.VITE_API_URL
let socket = null;

export const initializeSocket = (token) => {

    if (socket && socket.connected) {
        return socket
    }

    if (!socket && token) {
        socket = io(SOCKET_URL, {
            auth: { token }
        });

        socket.on('connect_error', (err) => {
            console.error("Socket Auth Error ", err)
        })
    }

    return socket;
}

export const getSocket = () => socket;

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null
        console.log("Socket manually disconnected!")
    }
}