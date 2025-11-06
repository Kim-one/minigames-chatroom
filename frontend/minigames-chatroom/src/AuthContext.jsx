import {createContext, useContext, useEffect, useState} from "react";
import {initializeSocket, disconnectSocket} from "./socket.jsx";

const AuthContext = createContext(null);

export const useAuth = ()=>{
    return useContext(AuthContext);
}

export const AuthProvider =({children}) =>{
    const [user,setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'))
    const [activeSocket, setActiveSocket] = useState(null);

    useEffect(()=>{
        const savedUser = localStorage.getItem('user');
        if(savedUser){
            setUser(JSON.parse(savedUser))
        }
    },[]);

    useEffect(()=>{
        if(user && token){
            const sockectInstance = initializeSocket(token)
            setActiveSocket(sockectInstance);
        }else{
            if(activeSocket){
                disconnectSocket()
                setActiveSocket(null)
            }
        }
    },[user, token]);

    const handleSetUser = (userData)=>{
        if(userData){
            const newToken =localStorage.getItem('token')
            localStorage.setItem('user', JSON.stringify(userData))
            setUser(userData);
            setToken(newToken);
        }else{
            localStorage.removeItem('user');
            localStorage.removeItem('token');
            setUser(null);
            setToken(null);
        }
    }

    const value={
        user,
        setUser:handleSetUser,
        activeSocket:activeSocket,
        token
    };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
};