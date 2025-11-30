import React, { useEffect, useState, useRef } from 'react';

const ImposterGame = ({ socket, lobbyId, username, gameData, onGameEnd }) => {
    const [gameState, setGameState] = useState({
        gameState: 'clue_submission',  // Default until updated
        currentRound: 1,
        maxRounds: 3,
        players: gameData?.players || [],  // From props
        timeLeft: 60
    });

    const [playerInfo, setPlayerInfo] = useState({
        yourRole: null,
        secretWord: null,
        theme: null,
        message: 'Waiting for game to start...'
    });

    const [clues, setClues] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [myClue, setMyClue] = useState('');
    const [selectedVote, setSelectedVote] = useState('');
    const chatEndRef = useRef(null);

    // Socket event handlers
    const handleGameStart = (data) => {
        console.log('Imposter game start data received:', {
            yourRole: data.yourRole,
            hasSecretWord: !!data.secretWord,
            theme: data.theme,
            message: data.message,
            allData: data
        });

        setPlayerInfo(data);

        // Also update game state with players if provided
        if (data.players) {
            setGameState(prev => ({
                ...prev,
                players: data.players
            }));
        }
    };

    const handleGameState = (state) => {
        console.log('Game state update:', state);
        setGameState(state);
    };

    const handleCluesRevealed = (data) => {
        console.log('Clues revealed:', data);
        setClues(data.clues);
    };

    const handleVotingStarted = (data) => {
        console.log('Voting started:', data);
        setSelectedVote('');
    };

    const handleVoteResults = (data) => {
        console.log('Vote results:', data);
        if (data.gameOver) {
            alert(`Game Over: ${data.winners === 'crewmates' ? 'Crewmates Win!' : 'Imposters Win!'}`);
            onGameEnd();
        }
    };

    const handleTimerUpdate = (data) => {
        setGameState(prev => ({ ...prev, timeLeft: data.timeLeft }));
    };

    const handleChatMessage = (message) => {
        setChatMessages(prev => [...prev, message]);
    };

    const handlePlayerSubmitted = (data) => {
        console.log(`${data.username} submitted clue`);
    };

    const handlePlayerVoted = (data) => {
        console.log(`${data.username} voted`);
    };

    const handleGameOver = (data) => {
        console.log('Game over:', data);
        alert(`Game Over: ${data.winners === 'crewmates' ? 'Crewmates Win!' : 'Imposters Win!'}`);
        onGameEnd();
    };

    // Game actions
    const submitClue = () => {
        if (myClue.trim().length === 0) return;
        socket.emit('imposter_submit_clue', { lobbyId, clue: myClue.trim() });
        setMyClue('');
    };

    const submitVote = () => {
        if (!selectedVote) return;
        socket.emit('imposter_submit_vote', { lobbyId, votedFor: selectedVote });
    };

    const sendChatMessage = (message) => {
        if (message.trim().length === 0) return;
        socket.emit('imposter_send_chat', { lobbyId, message: message.trim() });
    };

    useEffect(() => {
        if (!socket || !lobbyId) return;

        console.log('ImposterGame mounted with lobbyId:', lobbyId);
        console.log('Current socket state:', {
            connected: socket.connected,
            id: socket.id,
            username: username
        });

        // Set up socket listeners
        const listeners = {
            'imposter_game_start_word': handleGameStart,
            'imposter_game_state_word': handleGameState,
            'imposter_clues_revealed': handleCluesRevealed,
            'imposter_voting_started': handleVotingStarted,
            'imposter_vote_results': handleVoteResults,
            'imposter_timer_update': handleTimerUpdate,
            'imposter_chat_message': handleChatMessage,
            'imposter_player_submitted': handlePlayerSubmitted,
            'imposter_player_voted': handlePlayerVoted,
            'imposter_game_over': handleGameOver
        };

        // Add all listeners
        Object.entries(listeners).forEach(([event, handler]) => {
            socket.on(event, handler);
        });

        // Request player info with retry logic
        const requestPlayerInfo = () => {
            console.log('Requesting player info...');
            socket.emit('request_player_info', { lobbyId });
        };

        // Request immediately
        requestPlayerInfo();

        // Set up retry in case the first request fails
        const retryTimer = setTimeout(requestPlayerInfo, 1000);

        return () => {
            // Cleanup listeners
            Object.keys(listeners).forEach(event => {
                socket.off(event, listeners[event]);
            });
            clearTimeout(retryTimer);
        };
    }, [socket, lobbyId, username]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    const currentPlayer = gameState.players.find(p => p.username === username);
    const canSubmitClue = currentPlayer?.isAlive && !currentPlayer?.hasSubmittedClue && gameState.gameState === 'clue_submission';
    const canVote = currentPlayer?.isAlive && !currentPlayer?.vote && gameState.gameState === 'voting';
    const alivePlayers = gameState.players.filter(p => p.isAlive);

    return (
        <div className="fixed inset-0 bg-gray-900 text-white flex">
            {/*<div style={{ position: 'absolute', top: 0, right: 0, background: 'red', color: 'white', padding: '10px', zIndex: 1000 }}>*/}
            {/*    Debug: Role: {playerInfo.yourRole || 'unknown'},*/}
            {/*    Theme: {playerInfo.theme || 'none'},*/}
            {/*    Word: {playerInfo.secretWord ? '✓' : '✗'},*/}
            {/*    Msg: {playerInfo.message ? '✓' : '✗'}*/}
            {/*</div>*/}
            {/* Sidebar */}
            <div className="w-1/4 bg-gray-800 p-4 flex flex-col">
                <h2 className="text-xl font-bold mb-4">Imposter Game</h2>
                <div className="mb-6">
                    <p>Round: {gameState.currentRound}/{gameState.maxRounds}</p>
                    <p>Phase: {gameState.gameState.replace('_', ' ')}</p>
                    <p>Time: {gameState.timeLeft}s</p>
                    <p>Theme: {playerInfo.theme || 'Loading...'}</p>
                    {playerInfo.secretWord && (
                        <p className="text-green-400 font-semibold mt-2">
                            Secret Word: {playerInfo.secretWord}
                        </p>
                    )}
                    {playerInfo.yourRole === 'imposter' && (
                        <p className="text-red-400 font-semibold mt-2">
                            You are the IMPOSTER!
                        </p>
                    )}
                    <p className="mt-2">{playerInfo.message}</p>
                </div>
                <div>
                    <h3 className="font-semibold mb-2">Players ({alivePlayers.length})</h3>
                    <div className="space-y-2">
                        {gameState.players.map(player => (
                            <div key={player.username} className={`flex items-center justify-between p-2 rounded ${
                                !player.isAlive ? 'bg-gray-700 text-gray-400' : 'bg-gray-600'
                            }`}>
                                <span>{player.username}</span>
                                <div className="flex items-center space-x-2">
                                    {player.hasSubmittedClue && gameState.gameState === 'clue_submission' && (
                                        <span className="text-green-400">✓</span>
                                    )}
                                    {player.vote && gameState.gameState === 'voting' && (
                                        <span className="text-yellow-400">✓</span>
                                    )}
                                    {!player.isAlive && <span className="text-red-400">💀</span>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <button onClick={onGameEnd} className="mt-auto bg-red-500 px-4 py-2 rounded hover:bg-red-600">
                    Leave Game
                </button>
            </div>

            {/* Main Game Area */}
            <div className="flex-1 flex flex-col">
                {/* Clue Submission */}
                {gameState.gameState === 'clue_submission' && (
                    <div className="p-6 border-b border-gray-700">
                        <h3 className="text-2xl font-bold mb-4">Submit Your Clue</h3>
                        {canSubmitClue ? (
                            <div className="flex space-x-4">
                                <input
                                    type="text"
                                    value={myClue}
                                    onChange={(e) => setMyClue(e.target.value)}
                                    placeholder="Enter a subtle clue (1-50 characters)"
                                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
                                    maxLength={50}
                                />
                                <button onClick={submitClue} className="bg-blue-500 px-6 py-2 rounded hover:bg-blue-600">
                                    Submit Clue
                                </button>
                            </div>
                        ) : (
                            <p className="text-yellow-400">Waiting for other players or phase to start...</p>
                        )}
                    </div>
                )}

                {/* Clues Display */}
                {gameState.gameState === 'discussion' && clues.length > 0 && (
                    <div className="p-6 border-b border-gray-700">
                        <h3 className="text-2xl font-bold mb-4">Round {gameState.currentRound} Clues</h3>
                        <div className="grid grid-cols-2 gap-4">
                            {clues.map((clue, index) => (
                                <div key={index} className="bg-gray-700 p-4 rounded">
                                    <p className="font-semibold">{clue.username}:</p>
                                    <p className="text-gray-300">{clue.clue}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Voting */}
                {gameState.gameState === 'voting' && (
                    <div className="p-6 border-b border-gray-700">
                        <h3 className="text-2xl font-bold mb-4">Vote to Eliminate</h3>
                        <p className="mb-4">Who do you think is the Imposter?</p>
                        {canVote ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap gap-2">
                                    {alivePlayers.map(player => (
                                        <button
                                            key={player.username}
                                            onClick={() => setSelectedVote(player.username)}
                                            className={`px-4 py-2 rounded ${
                                                selectedVote === player.username ? 'bg-blue-500' : 'bg-gray-600 hover:bg-gray-500'
                                            }`}
                                        >
                                            {player.username}
                                        </button>
                                    ))}
                                    <button
                                        onClick={() => setSelectedVote('skip')}
                                        className={`px-4 py-2 rounded ${
                                            selectedVote === 'skip' ? 'bg-yellow-500' : 'bg-gray-600 hover:bg-gray-500'
                                        }`}
                                    >
                                        Skip Vote
                                    </button>
                                </div>
                                {selectedVote && (
                                    <button onClick={submitVote} className="bg-green-500 px-6 py-2 rounded hover:bg-green-600">
                                        Submit Vote for {selectedVote === 'skip' ? 'Skip' : selectedVote}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <p className="text-yellow-400">Waiting for voting to start...</p>
                        )}
                    </div>
                )}

                {/* Chat */}
                <div className="flex-1 flex flex-col p-6">
                    <h3 className="text-xl font-bold mb-4">Discussion</h3>
                    <div className="flex-1 bg-gray-800 rounded p-4 mb-4 overflow-y-auto">
                        {chatMessages.map((msg, index) => (
                            <div key={index} className="mb-2">
                                <span className="font-semibold text-blue-400">{msg.username}:</span>
                                <span className="ml-2">{msg.message}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="flex space-x-4">
                        <input
                            type="text"
                            placeholder="Type your message..."
                            onChange={(e) => {
                                if (e.key === 'Enter') {
                                    sendChatMessage(e.target.value);
                                    e.target.value = '';
                                }
                            }}
                            className="flex-1 bg-gray-700 border border-gray-600 rounded px-4 py-2 focus:outline-none focus:border-blue-500"
                        />
                        <button
                            onClick={(e) => {
                                const input = e.target.previousSibling;
                                sendChatMessage(input.value);
                                input.value = '';
                            }}
                            className="bg-blue-500 px-6 py-2 rounded hover:bg-blue-600"
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImposterGame;

