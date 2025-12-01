import { io } from "socket.io-client";
import {API_URL} from "./config.js";

const SOCKET_URL = API_URL;
let socket = null;

export const initializeSocket = (token) => {
    console.log('Initializing socket with token:', {
        hasToken: !!token,
        tokenLength: token?.length,
        apiUrl: SOCKET_URL,
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '74.220.48.0/24'
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

        const isDevelopment = window.location.hostname === 'localhost' ||
            window.location.hostname === '74.220.48.0/24';

        const socketOptions = {
            auth: {
                token: token
            },
            transports: [ 'websocket','polling'],
            withCredentials: true,
            autoConnect: true,
            forceNew: true,
            upgrade: true,
            ...(isDevelopment ? {} : {
                path: '/socket.io/',
                timeout:10000,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000
            })
        };

        console.log('Socket options:', socketOptions);

        const socketUrl = isDevelopment ? SOCKET_URL : window.location.origin;
        console.log('Connection to: ', socketUrl);

        socket = io(SOCKET_URL, socketOptions);

        socket.on('connect', () => {
            console.log('Socket connected successfully!');
            console.log('Socket ID:', socket.id);
            console.log('Transport:', socket.io.engine?.transport?.name);
            console.log('Socket Status:', {
                connected: socket.connected,
                id: socket.id,
                rooms: Array.from(socket.rooms || [])
            });

            if(typeof window !== 'undefined' && window.rejoinRooms){
                window.rejoinRooms();
            }
        });

        socket.on('connect_error', (err) => {
            console.error("Socket connection error:", err);
            console.error("Error message:", err.message);
            console.error("Error type:", err.type);

            if(err.message.includes('websocket')){
                console.log('Websocket failed, falling back to polling only');
                socket.io.opts.transports = ['polling'];
            }
        });

        socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);

            if(reason === 'io server disconnect'){
                setTimeout(() => {
                    socket.connected();
                }, 1000);
            }
        });

        socket.on('error', (err) => {
            console.error('Socket error:', err);
        });

        socket.on('room-joined', (data) => {
            console.log('Successfully joined room:', data);
            socket.inChatRoom = true;
        });

        socket.on('room-join-error', (error) => {
            console.error('Failed to join room:', error);
        })


        setTimeout(() => {
            if (!socket.connected) {
                console.log('Socket not connected after 2 seconds, attempting manual connect');
                console.log('Current socket state:',{
                    connected: socket.connected,
                    disconnected: socket.disconnected,
                    id: socket.id
                })
                // socket.connect();
            }
        }, 2000);
    } else {
        console.error('No token provided for socket initialization');
    }

    return socket;
}

export const getSocket = () => {
    if(socket){
        console.log('Getting socket:', {
            exists: true,
            connected: socket.connected,
            id: socket.id,
            inChatRoom: socket.inChatRoom
        });
    }else{
        console.log('Getting socket: No socket instance');
    }
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

export const joinRoom = (roomId, userData = {}) =>{
    if(!socket || !socket.connected){
        console.error('Cannot join room: Socket not connected');
        return false;
    }

    console.log('Attempting to join room:', roomId);
    socket.emit('join-room',{
        roomId,
        userData,
        timestamp: Date.now()
    });
    return true;
}

export const leaveRoom = (roomId) =>{
    if(socket && socket.connected){
        console.log('Leaving room:', roomId);
        socket.emit('leave-room', {roomId});
        socket.inChatRoom = false;
    }
}



