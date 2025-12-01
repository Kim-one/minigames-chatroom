import { createContext, useContext, useEffect, useState, useRef } from "react";
import { io } from "socket.io-client";

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem("user");
        return saved ? JSON.parse(saved) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem("token"));
    const [activeSocket, setActiveSocket] = useState(null);

    const socketRef = useRef(null);

    useEffect(() => {
        if (!user || !token) return;

        if (!socketRef.current) {
            const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
                auth: { token },
                transports: ["websocket"],
                reconnection: true,
                reconnectionAttempts: Infinity,
                reconnectionDelay: 1000,
                forceNew: true,
            });

            socketRef.current = socket;
            setActiveSocket(socket);

            socket.on("connect", () => {
                console.log("Socket connected:", socket.id);
            });

            socket.on("disconnect", (reason) => {
                console.log("Socket disconnected:", reason);
            });

            socket.on("connect_error", (err) => {
                console.error("Socket connection error:", err.message);
            });

            socket.onAny((event, ...args) => {
                if (event.includes("game") || event.includes("room") || event.includes("start")) {
                    console.log(`Socket event [${event}]:`, args);
                }
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setActiveSocket(null);
            }
        };
    }, [user, token]);

    // logout
    const handleSetUser = (userData) => {
        if (userData) {
            localStorage.setItem("user", JSON.stringify(userData));
            localStorage.setItem("token", localStorage.getItem("token") || "");
            setUser(userData);
            setToken(localStorage.getItem("token"));
        } else {
            localStorage.removeItem("user");
            localStorage.removeItem("token");
            setUser(null);
            setToken(null);

            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
                setActiveSocket(null);
            }
        }
    };

    return (
        <AuthContext.Provider value={{ user, setUser: handleSetUser, activeSocket, token }}>
            {children}
        </AuthContext.Provider>
    );
};
