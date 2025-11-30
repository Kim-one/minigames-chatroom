import { useEffect, useState } from 'react';
import api from '../api.js';

const GameLobby = ({ lobbyId, gameType, isOwner, onLeave, username, socket }) => {
    const [lobbyInfo, setLobbyInfo] = useState(null);
    const [countdown, setCountdown] = useState(30);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const getToken=()=>{
        return localStorage.getItem('token');
    }

    useEffect(() => {
        const fetchLobbyInfo = async () => {
            try {
                // console.log('Fetching lobby info for:', lobbyId);
                const token = getToken();

                if(!token){
                    setError('No authentication token found');
                    setLoading(false);
                    return;
                }

                // const response = await api.get(`/lobby/${lobbyId}`);
                const response = await api.get(`/lobby/${lobbyId}`, {
                    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
                });

                // console.log('Lobby API Response:', response.data);

                if (response.data && typeof response.data === 'object') {
                    setLobbyInfo(response.data);
                    setError(null);

                    const countdownEnds = response.data.countdownEnds || response.data.countDownEnds;
                    if (countdownEnds) {
                        const timeLeft = Math.max(0, Math.ceil((new Date(countdownEnds) - new Date()) / 1000));
                        setCountdown(timeLeft);
                    }
                } else {
                    throw new Error('Invalid lobby data received');
                }
            } catch (err) {
                console.error("Error fetching lobby info:", err);
                console.log('Error details:', err.response?.data);
                setError('Failed to load lobby information');
            } finally {
                setLoading(false);
            }
        };

        fetchLobbyInfo();
        const interval = setInterval(fetchLobbyInfo, 2000);

        return () => clearInterval(interval);
    }, [lobbyId]);

    useEffect(() => {
        if (!socket) {
            console.log('Socket not available for real-time updates');
            return;
        }

        console.log('Setting up socket listeners for lobby');

        // Listen for real-time player updates
        const handleLobbyPlayersUpdated = (data) => {
            console.log('Lobby players updated:', data);
            setLobbyInfo(prev => prev ? {
                ...prev,
                players: data.players
            } : prev);
        };

        const handleLobbyStateUpdate = (lobbyData) => {
            console.log('Full lobby state update:', lobbyData);
            setLobbyInfo(lobbyData);
        };

        const handlePlayerJoined = (data) => {
            console.log('Player joined lobby:', data);
            // Refresh lobby info when a player joins
            fetchLobbyInfo();
        };

        const handlePlayerLeft = (data) => {
            console.log('Player left lobby:', data);
            // Refresh lobby info when a player leaves
            fetchLobbyInfo();
        };

        const handleLobbyCountdown = (data) => {
            console.log('Lobby countdown update:', data);
            setCountdown(Math.ceil(data.timeLeft / 1000));
        };

        // Set up all socket listeners
        socket.on('lobby_players_updated', handleLobbyPlayersUpdated);
        socket.on('lobby_state_update', handleLobbyStateUpdate);
        socket.on('player_joined_lobby', handlePlayerJoined);
        socket.on('player_left_lobby', handlePlayerLeft);
        socket.on('lobby_countdown', handleLobbyCountdown);

        // Request current lobby state
        socket.emit('request_lobby_state', lobbyId);

        // Clean up socket listeners
        return () => {
            console.log('Cleaning up socket listeners');
            socket.off('lobby_players_updated', handleLobbyPlayersUpdated);
            socket.off('lobby_state_update', handleLobbyStateUpdate);
            socket.off('player_joined_lobby', handlePlayerJoined);
            socket.off('player_left_lobby', handlePlayerLeft);
            socket.off('lobby_countdown', handleLobbyCountdown);
        };
    }, [socket, lobbyId]);

    useEffect(() => {
        if (countdown <= 0) return;

        const timer = setTimeout(() => {
            setCountdown(prev => Math.max(0, prev - 1));
        }, 1000);

        return () => clearTimeout(timer);
    }, [countdown]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                        <p>Loading lobby...</p>
                        {!socket && (
                            <p className="text-yellow-400 text-sm mt-2">Real-time updates unavailable</p>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
                    <div className="text-center text-red-400">
                        <p className="mb-4">{error}</p>
                        <button
                            onClick={onLeave}
                            className="bg-red-500 px-4 py-2 rounded hover:bg-red-600"
                        >
                            Leave Lobby
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (!lobbyInfo) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
                <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
                    <div className="text-center text-red-400">
                        <p>Lobby not found</p>
                        <button
                            onClick={onLeave}
                            className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 mt-4"
                        >
                            Leave Lobby
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // SAFE DATA ACCESS
    const players = lobbyInfo.players || [];
    const playerCount = players.length;
    const minPlayers = lobbyInfo.minPlayers || 0;
    const maxPlayers = lobbyInfo.maxPlayers || 0;
    const owner = lobbyInfo.owner || '';

    // console.log('Rendering lobby with data:', {
    //     players,
    //     playerCount,
    //     minPlayers,
    //     maxPlayers,
    //     owner,
    //     currentUser: username,
    //     hasSocket: !!socket
    // });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
            <div className="bg-gray-800 p-6 rounded-lg max-w-md w-full">
                <h3 className="text-xl font-bold mb-4">
                    {gameType} Game Lobby {isOwner && '(Owner)'}
                </h3>

                {!socket && (
                    <div className="bg-yellow-900 border border-yellow-600 rounded p-3 mb-4">
                        <p className="text-yellow-200 text-sm">
                            ⚠️ Real-time updates unavailable. Lobby may not update automatically.
                        </p>
                    </div>
                )}

                <div className="mb-4">
                    <p className="text-lg">Time remaining: <span className="font-bold">{countdown}s</span></p>
                    <p>Players: <span className="font-bold">{playerCount}/{maxPlayers}</span></p>
                    <p>Minimum required: <span className="font-bold">{minPlayers}</span></p>
                    {playerCount < minPlayers && (
                        <p className="text-yellow-400 mt-2">
                            Need {minPlayers - playerCount} more player{minPlayers - playerCount !== 1 ? 's' : ''} to start
                        </p>
                    )}
                </div>

                <div className="mb-4">
                    <h4 className="font-bold mb-2">Players in Lobby:</h4>
                    {players.length === 0 ? (
                        <p className="text-gray-400">No players in lobby yet</p>
                    ) : (
                        <ul className="space-y-2">
                            {players.map((player, index) => (
                                <li key={player.username || index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                                    <div className="flex items-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                                        <span>{player.username}</span>
                                        {player.username === owner && ' 👑'}
                                    </div>
                                    {player.username === username && (
                                        <span className="text-blue-400 text-sm">(You)</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div className="mt-6">
                    <button
                        onClick={onLeave}
                        className="bg-red-500 px-4 py-2 rounded hover:bg-red-600 w-full"
                    >
                        Leave Lobby
                    </button>
                </div>
                <div className="mt-4 text-xs text-gray-400">
                    <p>Lobby ID: {lobbyId}</p>
                    <p>Real-time: {socket ? 'Connected' : 'Disabled'}</p>
                </div>
            </div>
        </div>
    );
};

export default GameLobby;