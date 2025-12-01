import { useParams } from "react-router-dom";
import {useEffect, useState, useRef, act} from "react";
import { useAuth } from "../AuthContext.jsx";
import SpaceShooter from "./Minigames/space_shooter_game.jsx";
import ImposterGame from "./Minigames/imposter_game.jsx";
import GameLobby from "./GameLobby.jsx";
import api from "../api.js";

const ChatRoom = () => {
    const { roomID } = useParams();
    const [roomInfo, setRoomInfo] = useState(null);
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);
    // const [error, setError] = useState('');
    // const [hasJoined, setHasJoined] = useState(false);
    const username = JSON.parse(localStorage.getItem('user'))?.username;
    const token = localStorage.getItem('token');
    const [showAccessDenied, setShowAccessDenied] = useState(null);
    const hasLoadedRef = useRef(false);
    const messagesEndRef = useRef(null);
    const [showGames, setShowGames] = useState(null);
    const [selectedGame, setSelectedGame] = useState(null);
    const { activeSocket } = useAuth();
    const [showChatInfo, setShowChatInfo] = useState(false);

    const [activeLobby, setActiveLobby] = useState(null);
    const [gameInvitation, setGameInvitation] = useState(null);
    const [isInLobby, setIsInLobby] = useState(false);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // fetch messages
    useEffect(() => {
        if (!activeSocket || hasLoadedRef.current) return;

        const joinRoom = async () => {
            try {
                hasLoadedRef.current = true;

                // Fetch room info
                const roomRes = await api.get(`/room/${roomID}`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setRoomInfo(roomRes.data);

                // Join room server-side
                await api.post(
                    `/room/${roomID}/join`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                );

                // Fetch messages
                const messagesRes = await api.get(`/room/${roomID}/messages`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setMessages(
                    messagesRes.data.map((msg) => ({
                        ...msg,
                        time: new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        }),
                    }))
                );

                // Join room via socket
                activeSocket.emit("join_room", roomID);

                // Listen to new messages
                activeSocket.on("receive_message", (msg) => {
                    setMessages((prev) => [...prev, msg]);
                });

                // Game invitation
                activeSocket.on("game_invitation", (inv) => {
                    setGameInvitation(inv);
                    const systemMsg = {
                        sender: "System",
                        content: `${inv.startedBy} started a ${inv.gameType} game! You have 30s to join.`,
                        time: new Date().toLocaleTimeString(),
                        isSystem: true,
                    };
                    setMessages((prev) => [...prev, systemMsg]);
                });

                // Space shooter start
                activeSocket.on("space_shooter_game_start", (data) => {
                    if (data.gameState === "starting" || data.gameState === "active") {
                        setSelectedGame("SpaceShooter");
                    }
                });
            } catch (err) {
                console.error("Error joining room:", err.response?.data || err.message);
                if (err.response?.status === 400) setShowAccessDenied(true);
                hasLoadedRef.current = false;
            }
        };

        joinRoom();

        return () => {
            if (activeSocket) {
                activeSocket.off("receive_message");
                activeSocket.off("game_invitation");
                activeSocket.off("space_shooter_game_start");
            }
        };
    }, [activeSocket, roomID, token]);

    const sendMessage = (e) => {
        e.preventDefault();
        if (!message.trim() || !activeSocket) return;

        const msgData = { room: roomID, content: message };
        const localMsg = {
            ...msgData,
            sender: username,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        };

        setMessages((prev) => [...prev, localMsg]);
        activeSocket.emit("send_message", msgData);
        setMessage("");
    };

    const joinLobby = async () => {
        if (!gameInvitation) return;
        try {
            await api.post(
                `/lobby/${gameInvitation.lobbyId}/join`,
                {},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setActiveLobby({
                id: gameInvitation.lobbyId,
                gameType: gameInvitation.gameType,
                isOwner: false,
            });
            setIsInLobby(true);
            setGameInvitation(null);
            activeSocket.emit("join_game_lobby", gameInvitation.lobbyId);
        } catch (err) {
            console.error("Error joining lobby:", err);
        }
    };

    return (

        <div className={'w-full bg-black text-white h-[calc(100vh-3.5rem)] '}>
            <div className={'flex flex-row flex-1 gap-3 relative'}>
                {/* Game Lobby Display */}
                {isInLobby && (
                    <GameLobby
                        lobbyId={activeLobby.id}
                        gameType={activeLobby.gameType}
                        isOwner={activeLobby.isOwner}
                        onLeave={leaveLobby}
                        username={username}
                        socket={activeSocket}
                    />
                )}

                {/* Game Invitation Popup */}
                {gameInvitation && !isInLobby && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-gray-800 p-6 rounded-lg max-w-md">
                            <h3 className="text-xl font-bold mb-4">Game Invitation</h3>
                            <p>{gameInvitation.startedBy} started a {gameInvitation.gameType} game!</p>
                            <p>Minimum players: {gameInvitation.minPlayers}</p>
                            <p>Time remaining: {Math.ceil((gameInvitation.countdownEnds - Date.now()) / 1000)}s</p>
                            <div className="flex gap-2 mt-4">
                                <button
                                    onClick={joinLobby}
                                    className="bg-green-500 px-4 py-2 rounded hover:bg-green-600"
                                >
                                    Join Game
                                </button>
                                <button
                                    onClick={() => setGameInvitation(null)}
                                    className="bg-gray-500 px-4 py-2 rounded hover:bg-gray-600"
                                >
                                    Decline
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {!selectedGame && !isInLobby && (
                    <div className={'flex flex-row flex-1 gap-3 relative'}>
                        {/* SIDEBAR */}
                        <div className={'border-r border-solid border-gray-600 w-1/4 h-[calc(100vh-3.5rem)]'}>
                            <div>
                                <p className={'pb-4 border-b border-solid border-gray-600'}>{username}</p>
                            </div>
                            <div>
                                <p onClick={() => setShowChatInfo(false)}>#Chat</p>
                            </div>

                            {/* GAMES CONTAINER */}
                            <div>
                                <p onClick={() => setShowGames(!showGames)}>#Games</p>
                                {showGames && roomInfo?.owner === username && (
                                    <div className={'flex flex-col gap-3 mt-2'}>
                                        <button
                                            className={'bg-blue-500 px-3 py-2 rounded hover:bg-blue-600'}
                                            onClick={() => startGame('SpaceShooter')}
                                        >
                                            Start Space Shooter (2+ players)
                                        </button>
                                        <button
                                            className={'bg-purple-500 px-3 py-2 rounded hover:bg-purple-600'}
                                            onClick={() => startGame('Imposter')}
                                        >
                                            Start Imposter Game (3+ players)
                                        </button>
                                    </div>
                                )}
                                {showGames && roomInfo?.owner !== username && (
                                    <div className="mt-2 text-gray-400">
                                        Only room owner can start games
                                    </div>
                                )}
                            </div>

                            {/* GENERAL INFO ABOUT CHATROOM */}
                            <div>
                                <p onClick={() => setShowChatInfo(true)}>#General</p>
                            </div>
                        </div>

                        {/* MAIN CHAT ROOM SECTION */}
                        {showChatInfo ? (
                            <div className="flex flex-1 flex-col p-4">
                                <h1 className={'font-bold text-3xl mb-4'}>{roomInfo?.chatroomName}</h1>
                                <p className="mb-4">{roomInfo?.description}</p>
                                <h3 className="font-bold text-xl mb-2">Members</h3>
                                <ul>
                                    {roomInfo?.members.map((member, index) => (
                                        <li key={index} className="py-1">{member}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className={'flex flex-1 flex-col'}>
                                <h2 className={'border-b border-solid border-gray-600 pb-4 pl-4 pt-2'}>
                                    Welcome to {roomInfo ? roomInfo.chatroomName : 'Loading...'}
                                </h2>
                                <div className={'flex flex-col gap-1 mb-3 mt-3 h-[calc(100vh-12.5rem)] overflow-y-auto scrollbar-hide p-4'}>
                                    {messages.map((msg, index) => (
                                        <div key={index} className={msg.sender === username ? 'my-message' : 'other-message'}>
                                            {msg.isSystem ? (
                                                <div className={'text-center text-gray-400 italic my-2'}>
                                                    {msg.content}
                                                </div>
                                            ) : msg.sender === username ? (
                                                <div className={'bg-blue-500 rounded pl-4 pr-4 pt-2 pb-2 w-64 float-right flex flex-col text-wrap'}>
                                                    <span className={'timestamp'}><strong>{msg.sender}:</strong> <p className={'float-right'}>{msg.time}</p></span>
                                                    {msg.content}
                                                </div>
                                            ) : (
                                                <div className={'bg-green-400 rounded pl-4 pr-4 pt-2 pb-2 w-64 float-left flex flex-col'}>
                                                    <span className={'timestamp'}><strong>{msg.sender}</strong> <p className={'float-right'}>{msg.time}</p></span>
                                                    {msg.content}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    <div ref={messagesEndRef}></div>
                                </div>
                                <form onSubmit={sendMessage} className={'flex flex-row border-t border-solid border-gray-600 p-4'}>
                                    <input
                                        className={'bg-gray-900 w-full rounded-full focus:outline-none pl-4 pr-4 pt-2 pb-2'}
                                        type="text"
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Type your message..."
                                    />
                                    <button
                                        type="submit"
                                        className="ml-2 bg-blue-500 px-4 rounded hover:bg-blue-600"
                                    >
                                        Send
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                )}

                {/* Game Components */}
                {selectedGame === 'SpaceShooter' && (
                    <SpaceShooter
                        socket={activeSocket}
                        lobbyId={activeLobby?.id}
                        username={username}
                        onGameEnd={() => setSelectedGame(null)}
                    />
                )}

                {selectedGame === 'Imposter' && (
                    <ImposterGame
                        socket={activeSocket}
                        lobbyId={activeLobby?.id}
                        username={username}
                        onGameEnd={() => setSelectedGame(null)}
                    />
                )}
            </div>

            {showAccessDenied && (
                <div className={'inset-0 absolute '}>
                    <div className={'inset-0 absolute z-0 bg-black/90 w-full h-screen'}></div>
                    <div className={'w-full h-screen absolute z-50 flex flex-col items-center justify-center'}>
                        <h2>Access Denied</h2>
                        <p>You do not have permission to access this private chat</p>
                        <button onClick={() => window.location.href = '/lobby'}>Go back</button>
                    </div>
                </div>
            )}
            {/* TEMPORARY TEST BUTTON - REMOVE AFTER TESTING */}
            {roomInfo?.owner === username && (
                <div className="mt-4 p-2 border border-yellow-500 rounded">
                    <p className="text-yellow-400 text-sm mb-2">Debug: Manual Start</p>
                    <button
                        onClick={() => manualStartGame('SpaceShooter')}
                        className="bg-yellow-500 px-2 py-1 rounded text-sm mr-2"
                    >
                        Manual Space Shooter
                    </button>
                    <button
                        onClick={() => manualStartGame('Imposter')}
                        className="bg-yellow-500 px-2 py-1 rounded text-sm"
                    >
                        Manual Imposter
                    </button>
                </div>
            )}
        </div>

    )
}

export default ChatRoom;



