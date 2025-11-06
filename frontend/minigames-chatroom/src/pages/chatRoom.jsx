import {useParams} from "react-router-dom";
import {useEffect, useState, useRef, act} from "react";
import {useAuth} from "../AuthContext.jsx";
import SpaceShooter from "./Minigames/space_shooter_game.jsx";
import api from "../api.js";

const ChatRoom = ()=>{
    const {roomID} = useParams();
    const [roomInfo, setRoomInfo] = useState(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    const [error, setError] = useState('');
    const [hasJoined, setHasJoined] = useState(false);
    const username = JSON.parse(localStorage.getItem('user'))?.username;
    const token = localStorage.getItem('token');
    const [showAccessDenied, setShowAccessDenied] = useState(null);
    const hasLoadedRef = useRef(false);
    const messagesEndRef = useRef(null);
    const [showGames, setShowGames] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const {activeSocket} = useAuth();
    const [showChatInfo, setShowChatInfo] = useState(false);

    useEffect(()=>{
        if(hasLoadedRef.current){
            return
        }
        const joinRoom = async ()=>{
            if(!activeSocket){
                return
            }
            try {
                hasLoadedRef.current = true;
                // Fetch room info
                const roomRes = await api.get(`/room/${roomID}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                console.log("Room info fetched:", roomRes.data);
                setRoomInfo(roomRes.data);
                // Join the room
                await api.post(`/room/${roomID}/join`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                const messagesRes = await api.get(`/room/${roomID}/messages`,{
                    headers: { Authorization: `Bearer ${token}` }
                });

                setMessages(messagesRes.data.map(msg=>({
                    ...msg,
                        time: new Date(msg.createdAt).toLocaleTimeString([],{
                            hour:'2-digit',
                            minute: '2-digit'
                        })
                })));

                activeSocket.emit('join_room', roomID)

                activeSocket.on('receive_message',(data)=>{
                    console.log(`Received message ${data.content} from ${data.sender}`);
                    setMessages((list)=> [...list, data]);
                });
                activeSocket.on('error', (msg) => {
                    alert(msg);
                });
                setHasJoined(true);
            } catch (err) {
                console.error("Error joining room:", err.response?.data || err.message);
                if (err.response.status === 400){
                    setShowAccessDenied(true)
                }
                hasLoadedRef.current = false;
            }
        };
        if(activeSocket){
            joinRoom()
        }

        return () => {
            if(activeSocket){
                activeSocket.off('connect')
                activeSocket.off('receive_message');
                activeSocket.off('message_sent');
                activeSocket.off('error');
            }
        };
    },[roomID,activeSocket, token]);

    useEffect(()=>{
        messagesEndRef.current?.scrollIntoView({behavior: "smooth"})
    },[messages, selectedGame])

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim() === "" || error || !activeSocket) return;

        const messageData = {
            room: roomID,
            content: message
        };

        const localMessage={
            ...messageData,
            sender: username,
            time: new Date().toLocaleTimeString([],{
                hour:'2-digit',
                minute:'2-digit'
            })
        }

        setMessages((list)=>[...list, localMessage])

        activeSocket.current.emit('send_message', messageData);
        setMessage('')
    };
    return (
        <div className={'w-full bg-black text-white h-[calc(100vh-3.5rem)] '}>
            <div className={'flex flex-row flex-1 gap-3 relative'}>
                {!selectedGame &&(
                    <div className={'flex flex-row flex-1 gap-3 relative'}>
                        {/*SIDEBAR*/}
                        <div className={'border-r border-solid border-gray-600 w-1/4 h-[calc(100vh-3.5rem)]'}>
                            <div>
                                <p className={'pb-4 border-b border-solid border-gray-600'}>{username}</p>
                            </div>
                            <div>
                                <p onClick={()=>setShowChatInfo(false)}>#Chat</p>
                            </div>
                            {/*GAMES CONTAINER*/}
                            <div>
                                <p onClick={()=>setShowGames(true)}>#Games</p>
                                {showGames &&(
                                    <div className={'flex flex-col gap-3'}>
                                        <button className={'bg-blue-500'} onClick={()=>setSelectedGame('SpaceShooter')}>Space Shooter Game</button>
                                        <button onClick={()=>setSelectedGame('Imposter')}>Imposter Game</button>
                                    </div>
                                )}
                            </div>
                            {/*GENERAL INFO ABOUT CHATROOM*/}
                            <div>
                                <p onClick={()=>setRoomInfo(true)}>#General</p>
                            </div>
                        </div>
                        {/*MAIN CHAT ROOM SECTION*/}
                        {showChatInfo ? (
                            <div className={'flex flex-1'}>
                                <div className={'flex flex-col gap-1 mb-3 mt-3 h-[calc(100vh-12.5rem)]'}>
                                    <h1>{roomInfo.chatroomName}</h1>
                                    <p>{roomInfo.description}</p>
                                    <h3>Members</h3>
                                    <p>{roomInfo.members}</p>
                                </div>
                            </div>
                        ): (
                            <div className={'flex flex-1 flex-col'}>
                                <h2 className={'border-b border-solid border-gray-600 pb-4'}>Welcome to {roomInfo ? roomInfo.chatroomName : 'Loading...'}</h2>
                                <div className={'flex flex-col gap-1 mb-3 mt-3 h-[calc(100vh-12.5rem)] overflow-y-auto scrollbar-hide'}>
                                    {messages.map((msg, index) => (
                                        <div key={index} className={msg.sender === username ? 'my-message' : 'other-message'}>
                                            {msg.sender === username ?(
                                                <div className={'bg-blue-500 rounded pl-4 pr-4 pt-2 pb-2 w-64 float-right flex flex-col text-wrap'}>
                                                    <span className={'timestamp'}><strong>{msg.sender}:</strong> <p className={'float-right'}>{msg.time}</p></span>
                                                    {msg.content}
                                                </div>

                                            ) :(
                                                <div className={'bg-green-400 rounded pl-4 pr-4 pt-2 pb-2 w-64 float-left flex flex-col'}>
                                                    <span className={'timestamp'}><strong>{msg.sender}</strong> <p className={'float-right'}>{msg.time}</p></span>
                                                    {msg.content}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef}></div>
                                </div>
                                <form onSubmit={sendMessage} className={'flex flex-row border-t border-solid border-gray-600'}>
                                    <input
                                        className={'bg-gray-900 mt-2 w-full rounded-full focus:outline-none pl-2 pt-2 pb-2'}
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Type your message..."
                                    />
                                    <button type="submit">Send</button>
                                </form>
                            </div>
                        )}

                    </div>
                )}
                {selectedGame === 'SpaceShooter' && (<SpaceShooter socket={activeSocket} roomID={roomID} username={username} goBack={()=> setSelectedGame(null)}/>)}
            </div>
            {showAccessDenied &&(
                <div className={'inset-0 absolute '}>
                    <div className={'inset-0 absolute z-0 bg-black/90 w-full h-screen'}></div>
                    <div className={'w-full h-screen absolute z-50 flex flex-col items-center justify-center'}>
                        <h2>Access Denied</h2>
                        <p>You do not have permission to access this private chat</p>
                        <button onClick={()=>window.location.href='/lobby'}>Go back</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default ChatRoom;



