import { useParams } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
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
        if (activeSocket) {
            console.log('🔌 Socket connection status:', {
                connected: activeSocket.connected,
                id: activeSocket.id,
                transport: activeSocket.io.engine?.transport?.name
            });

            activeSocket.on('connect', () => {
                console.log('Socket connected in production');
            });

            activeSocket.on('disconnect', (reason) => {
                console.log('Socket disconnected:', reason);
            });

            activeSocket.on('connect_error', (error) => {
                console.error('Socket connection error:', error);
            });
        }
    }, [activeSocket]);

    useEffect(() => {
        if (!activeSocket) return;

        const checkConnection = () => {
            console.log('Socket Status Check:', {
                connected: activeSocket.connected,
                id: activeSocket.id,
                rooms: Array.from(activeSocket.rooms || [])
            });
        };

        checkConnection();

        const interval = setInterval(checkConnection, 3000);

        return () => clearInterval(interval);
    }, [activeSocket]);

    useEffect(() => {
        if (hasLoadedRef.current) {
            return
        }
        const joinRoom = async () => {
            if (!activeSocket) {
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

                const messagesRes = await api.get(`/room/${roomID}/messages`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                setMessages(messagesRes.data.map(msg => ({
                    ...msg,
                    time: new Date(msg.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                    })
                })));

                activeSocket.emit('join_room', roomID)

                activeSocket.on('receive_message', (data) => {
                    console.log(`Received message ${data.content} from ${data.sender}`);
                    setMessages((list) => [...list, data]);
                });
                activeSocket.on('error', (msg) => {
                    alert(msg);
                });
                // setHasJoined(true);

                activeSocket.on('game_session_started', (data) => {
                    console.log('game_session_started event received:', data);
                    console.log('Lobby ID:', data.lobbyId);
                    console.log('Game Type:', data.gameType);

                    console.log(`Joining game lobby: lobby_${data.lobbyId}`);
                    activeSocket.emit('join_game_lobby', data.lobbyId);

                    setActiveLobby({
                        id: data.lobbyId,
                        gameType: data.gameType,
                        isOwner: false
                    });

                    setTimeout(() => {
                        console.log(`Starting game: ${data.gameType}`);
                        setSelectedGame(data.gameType);
                    }, 500);
                });

                activeSocket.on('space_shooter_game_start', (data) => {
                    console.log('space_shooter_game_start event received:', data);
                    console.log('Game State:', data.gameState);
                    console.log('Players:', data.players);

                    if (data.gameState === 'starting' || data.gameState === 'active') {
                        console.log('Space Shooter game is ready!');
                    }
                });

                activeSocket.on('game_invitation', (data) => {
                    console.log('Game invitation received:', data);
                    setGameInvitation(data);

                    // Add system message to chat
                    const systemMessage = {
                        sender: 'System',
                        content: `${data.startedBy} started a ${data.gameType} game! You have 30 seconds to join.`,
                        time: new Date().toLocaleTimeString(),
                        isSystem: true
                    };
                    setMessages(prev => [...prev, systemMessage]);
                });

                activeSocket.on('player_joined_lobby', (data) => {
                    // Add system message when player joins
                    const systemMessage = {
                        sender: 'System',
                        content: `${data.username} joined the game lobby. (${data.playerCount}/${data.minPlayers} players)`,
                        time: new Date().toLocaleTimeString(),
                        isSystem: true
                    };
                    setMessages(prev => [...prev, systemMessage]);
                });

                activeSocket.on('player_left_lobby', (data) => {
                    // Add system message when player leaves
                    const systemMessage = {
                        sender: 'System',
                        content: `${data.username} left the game lobby. (${data.playerCount} players remaining)`,
                        time: new Date().toLocaleTimeString(),
                        isSystem: true
                    };
                    setMessages(prev => [...prev, systemMessage]);
                });

                activeSocket.on('lobby_countdown', (data) => {
                    if (isInLobby) {
                        // Update lobby countdown display
                        setActiveLobby(prev => prev ? { ...prev, countdown: data.timeLeft } : null);
                    }
                });

                activeSocket.on('game_starting', (data) => {
                    console.log('IMMEDIATE Game starting received:', data);
                    setGameInvitation(null);
                    setIsInLobby(false);

                    setActiveLobby({
                        id: data.lobbyId,
                        gameType: data.gameType,
                        isOwner: false
                    });

                    activeSocket.emit('join_game_lobby', data.lobbyId);

                    console.log(`Starting game immediately: ${data.gameType}`);
                    setSelectedGame(data.gameType);

                    const systemMessage = {
                        sender: 'System',
                        content: `Game starting! ${data.players.length} players joined.`,
                        time: new Date().toLocaleTimeString(),
                        isSystem: true
                    };
                    setMessages(prev => [...prev, systemMessage]);
                });

                // activeSocket.on('game_starting', (data) => {
                //     console.log('Game starting received:', data);
                //     setGameInvitation(null);
                //     setIsInLobby(false);
                //     setActiveLobby({
                //         id: data.lobbyId,
                //         gameType: data.gameType,
                //         isOwner: false
                //     });
                //
                //     // Add system message
                //     const systemMessage = {
                //         sender: 'System',
                //         content: `Game starting! ${data.players.length} players joined.`,
                //         time: new Date().toLocaleTimeString(),
                //         isSystem: true
                //     };
                //     setMessages(prev => [...prev, systemMessage]);
                //
                //     // Start the selected game after a brief delay to show the message
                //     setTimeout(() => {
                //         if (data.gameType === 'SpaceShooter') {
                //             setSelectedGame('SpaceShooter');
                //         } else if (data.gameType === 'Imposter') {
                //             setSelectedGame('Imposter');
                //         }
                //     }, 1000);
                // });

                activeSocket.on('join_active_game', (data) => {
                    console.log('Joining active game:', data);
                    setSelectedGame(data.gameType);
                    setActiveLobby({
                        id: data.lobbyId,
                        gameType: data.gameType,
                        isOwner: false
                    });
                    setIsInLobby(true);
                });


                activeSocket.on('game_cancelled', (data) => {
                    setGameInvitation(null);
                    setIsInLobby(false);
                    setActiveLobby(null);

                    // Add system message
                    const systemMessage = {
                        sender: 'System',
                        content: `Game cancelled: ${data.reason}`,
                        time: new Date().toLocaleTimeString(),
                        isSystem: true
                    };
                    setMessages(prev => [...prev, systemMessage]);
                });

            } catch (err) {
                console.error("Error joining room:", err.response?.data || err.message);
                if (err.response.status === 400) {
                    setShowAccessDenied(true)
                }
                hasLoadedRef.current = false;
            }
        };
        if (activeSocket) {
            joinRoom()
        }

        return () => {
            if (activeSocket) {
                console.log('Cleaning up all the socket listeners');
                activeSocket.off('game_invitation');
                activeSocket.off('player_joined_lobby');
                activeSocket.off('player_left_lobby');
                activeSocket.off('lobby_countdown');
                activeSocket.off('game_starting');
                activeSocket.off('game_cancelled');
                activeSocket.off('receive_message');
                activeSocket.off('error');
                activeSocket.off('join_active_game');
                activeSocket.off('game_session_started');
                activeSocket.off('space_shooter_game_start');
                activeSocket.offAny();
            }
        };
    }, [roomID, activeSocket, token, isInLobby]);

    useEffect(() => {
        if (!activeSocket) {
            console.log('No active socket for game events');
            return;
        }

        console.log('Setting up comprehensive game event listeners');

        // Listen for ALL game-related events with detailed logging
        const handleGameStarting = (data) => {
            console.log('GAME_STARTING event received:', data);
            setGameInvitation(null);
            setIsInLobby(false);
            setActiveLobby({
                id: data.lobbyId,
                gameType: data.gameType,
                isOwner: false
            });

            // Immediately join the game lobby
            console.log(`Joining game lobby: ${data.lobbyId}`);
            activeSocket.emit('join_game_lobby', data.lobbyId);

            // Start the game immediately
            console.log(`Launching game: ${data.gameType}`);
            setSelectedGame(data.gameType);
        };

        const handleGameSessionStarted = (data) => {
            console.log('GAME_SESSION_STARTED event received:', data);
            setGameInvitation(null);
            setIsInLobby(false);
            setActiveLobby({
                id: data.lobbyId,
                gameType: data.gameType,
                isOwner: false
            });

            activeSocket.emit('join_game_lobby', data.lobbyId);
            setSelectedGame(data.gameType);
        };

        const handleSpaceShooterGameStart = (data) => {
            console.log('SPACE_SHOOTER_GAME_START event received:', data);
            if (data.gameState === 'starting' || data.gameState === 'active') {
                console.log('Space Shooter game is ready - starting now!');
                setSelectedGame('SpaceShooter');
            }
        };

        // Debug: Log ALL socket events to see what's coming through
        activeSocket.onAny((eventName, ...args) => {
            if (eventName.includes('game') || eventName.includes('lobby') || eventName.includes('start')) {
                console.log(`Socket event [${eventName}]:`, args);
            }
        });

        activeSocket.on('game_starting', handleGameStarting);
        activeSocket.on('game_session_started', handleGameSessionStarted);
        activeSocket.on('space_shooter_game_start', handleSpaceShooterGameStart);

        return () => {
            console.log('Cleaning up comprehensive game listeners');
            activeSocket.off('game_starting', handleGameStarting);
            activeSocket.off('game_session_started', handleGameSessionStarted);
            activeSocket.off('space_shooter_game_start', handleSpaceShooterGameStart);
            activeSocket.offAny();
        };
    }, [activeSocket]);


    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, selectedGame])

    const sendMessage = (e) => {
        e.preventDefault();
        if (message.trim() === "" || !activeSocket) return;

        const messageData = {
            room: roomID,
            content: message
        };

        const localMessage = {
            ...messageData,
            sender: username,
            time: new Date().toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            })
        }

        setMessages((list) => [...list, localMessage])

        activeSocket.emit('send_message', messageData);
        setMessage('')
    };

    const startGame = async (gameType) => {
        try {
            const response = await api.post(`/room/${roomID}/start-game`,
                { gameType },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            setActiveLobby({
                id: response.data.lobbyId,
                gameType,
                isOwner: true
            });
            setIsInLobby(true);
            setShowGames(false);

            // Join the game lobby via socket
            activeSocket.emit('join_game_lobby', response.data.lobbyId);

        } catch (err) {
            console.error("Error starting game:", err);
            alert(err.response?.data?.message || "Error starting game");
        }
    };

    const joinLobby = async () => {
        if (!gameInvitation) return;

        try {
            await api.post(`/lobby/${gameInvitation.lobbyId}/join`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setActiveLobby({
                id: gameInvitation.lobbyId,
                gameType: gameInvitation.gameType,
                isOwner: false
            });
            setIsInLobby(true);
            setGameInvitation(null);

            // Join the game lobby via socket
            activeSocket.emit('join_game_lobby', gameInvitation.lobbyId);

        } catch (err) {
            console.error("Error joining lobby:", err);
            alert(err.response?.data?.message || "Error joining game");
        }
    };

    const leaveLobby = async () => {
        if (!activeLobby) return;

        try {
            await api.post(`/lobby/${activeLobby.id}/leave`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setActiveLobby(null);
            setIsInLobby(false);

            // Leave the game lobby via socket
            activeSocket.emit('leave_game_lobby', activeLobby.id);

        } catch (err) {
            console.error("Error leaving lobby:", err);
        }
    };

    const manualStartGame = (gameType) => {
        console.log('🔄 MANUAL game start triggered:', gameType);
        setSelectedGame(gameType);
        setActiveLobby({
            id: 'manual-test',
            gameType: gameType,
            isOwner: true
        });
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



