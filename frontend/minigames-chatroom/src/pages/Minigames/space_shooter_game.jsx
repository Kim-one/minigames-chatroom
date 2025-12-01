import React, { useEffect, useRef, useState } from 'react';

const SpaceShooter = ({ socket, lobbyId, username, onGameEnd }) => {
    const canvasRef = useRef(null);
    const [gameState, setGameState] = useState(null);
    const [scores, setScores] = useState([]);
    const [gameOver, setGameOver] = useState(false);
    const [winner, setWinner] = useState('');

    // Player movement
    const keys = useRef({});
    const playerRef = useRef({ x: 400, y: 500 });
    const animationFrameRef = useRef();

    const handleGameState = (state) => {
        console.log('Received game state:', state);
        console.log('Players in game state:', state.players.map(p => ({
            username: p.username,
            alive: p.isAlive,
            position: `(${p.x}, ${p.y})`
        })));

        setGameState(state);

        // Update local player position from server state
        const player = state.players.find(p => p.username === username);
        if (player) {
            playerRef.current.x = player.x;
            playerRef.current.y = player.y;
            console.log(`Updated local player position to (${player.x}, ${player.y})`);
        } else {
            console.log('Player not found in received game state for:', username);
        }
    };

    const handlePlayerMoved = (data) => {
        // Update specific player position when they move
        setGameState(prevState => {
            if (!prevState) return prevState;

            return {
                ...prevState,
                players: prevState.players.map(player =>
                    player.username === data.username
                        ? { ...player, x: data.x, y: data.y }
                        : player
                )
            };
        });
    };
    const handleGameOver = (data) => {
        setGameOver(true);
        setWinner(data.winner);
        setScores(data.scores);

        // Auto-return to chat after 5 seconds
        setTimeout(() => {
            onGameEnd();
        }, 5000);
    };

    const processMovement = () => {
        if (!socket || !gameState) {
            return;
        }

        const player = gameState.players.find(p => p.username === username);
        if (!player || !player.isAlive) {
            return;
        }

        const speed = 5;
        let newX = player.x;
        let newY = player.y;
        let moved = false;

        // Check all possible movement key combinations
        const movement = {
            left: keys.current['ArrowLeft'] || keys.current['a'] || keys.current['A'],
            right: keys.current['ArrowRight'] || keys.current['d'] || keys.current['D'],
            up: keys.current['ArrowUp'] || keys.current['w'] || keys.current['W'],
            down: keys.current['ArrowDown'] || keys.current['s'] || keys.current['S']
        };

        if (movement.left) {
            newX = Math.max(0, newX - speed);
            moved = true;
        }
        if (movement.right) {
            newX = Math.min(750, newX + speed);
            moved = true;
        }
        if (movement.up) {
            newY = Math.max(0, newY - speed);
            moved = true;
        }
        if (movement.down) {
            newY = Math.min(550, newY + speed);
            moved = true;
        }

        if (moved) {
            console.log('Movement -', {
                x: newX,
                y: newY,
                movement
            });

            // Emit movement to server
            socket.emit('space_shooter_player_move', {
                lobbyId,
                x: newX,
                y: newY
            });

            // Update local state for immediate feedback
            player.x = newX;
            player.y = newY;
            setGameState({...gameState});
        }
    };

    // Game loop for smooth input
    const gameLoop = () => {
        // handlePlayerInput();
        animationFrameRef.current = requestAnimationFrame(gameLoop);
    };


    useEffect(() => {
        if (!socket) {
            console.log(' No socket available');
            return;
        }

        console.log('Space Shooter component mounted', {
            username,
            lobbyId,
            socketConnected: socket.connected
        });

        // Set up socket listeners
        socket.on('space_shooter_game_state', handleGameState);
        socket.on('space_shooter_player_moved', handlePlayerMoved);
        socket.on('space_shooter_game_over', handleGameOver);

        socket.emit('join_game_lobby', lobbyId);
        socket.emit('space_shooter_player_ready', { lobbyId });

        console.log('Joined game lobby and signaled readiness');

        setTimeout(() => {
            const input = document.getElementById('gameInput');
            if (input) {
                input.focus();
                console.log('Game input field focused');
            }
        }, 1000);

        const gameLoop = () => {
            processMovement();
            animationFrameRef.current = requestAnimationFrame(gameLoop);
        };

        animationFrameRef.current = requestAnimationFrame(gameLoop);

        return () => {
            console.log('Clean up');

            socket.off('space_shooter_game_state', handleGameState);
            socket.off('space_shooter_player_moved', handlePlayerMoved);
            socket.off('space_shooter_game_over', handleGameOver);

            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [socket, lobbyId, username]);

    // Drawing functions
    const drawStars = (ctx) => {
        ctx.fillStyle = '#fff';
        for (let i = 0; i < 50; i++) {
            const x = (i * 17) % 800;
            const y = (i * 23) % 600;
            ctx.fillRect(x, y, 1, 1);
        }
    };

    const drawPlayer = (ctx, player) => {
        if (!player.isAlive) {
            // Draw dead player as wreckage
            ctx.fillStyle = '#666';
            ctx.fillRect(player.x, player.y, player.width, player.height);
            return;
        }

        // Player ship body
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, player.width, player.height);

        // Player ship details
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(player.x + player.width/2 - 5, player.y, 10, 10); // Cockpit

        // Engine glow
        ctx.fillStyle = '#ffff00';
        ctx.fillRect(player.x + player.width/2 - 5, player.y + player.height, 10, 8);

        // Health bar
        const healthWidth = (player.health / 100) * player.width;
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(player.x, player.y - 10, player.width, 5);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(player.x, player.y - 10, healthWidth, 5);

        // Player name
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.username, player.x + player.width/2, player.y - 15);
    };

    const drawEnemy = (ctx, enemy) => {
        // Enemy ship
        ctx.fillStyle = enemy.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);

        // Health bar for enemies with more than 1 health
        if (enemy.maxHealth > 1) {
            const healthWidth = (enemy.health / enemy.maxHealth) * enemy.width;
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(enemy.x, enemy.y - 8, enemy.width, 3);
            ctx.fillStyle = '#ffff00';
            ctx.fillRect(enemy.x, enemy.y - 8, healthWidth, 3);
        }
    };

    const drawBullet = (ctx, bullet, color) => {
        ctx.fillStyle = color;
        ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    };

    const drawHUD = (ctx, players) => {
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'left';

        // Scores
        ctx.fillText('Scores:', 10, 30);
        players.forEach((player, index) => {
            const yPos = 50 + (index * 25);
            const text = `${player.username}: ${player.score} ${player.health > 0 ? `❤️${player.health}` : '💀'}`;
            ctx.fillStyle = player.isAlive ? player.color : '#666';
            ctx.fillText(text, 10, yPos);
        });

        // Game over display
        if (gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
            ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);

            ctx.fillStyle = '#fff';
            ctx.font = '32px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('GAME OVER', 400, 200);
            ctx.font = '24px Arial';
            ctx.fillText(`Winner: ${winner}`, 400, 250);
            ctx.font = '18px Arial';
            ctx.fillText('Returning to chat in 5 seconds...', 400, 300);
        }
    };

    useEffect(() => {
        if (!gameState || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        drawStars(ctx);

        gameState.players.forEach(player => {
            drawPlayer(ctx, player);
        });

        gameState.enemies.forEach(enemy => {
            drawEnemy(ctx, enemy);
        });

        gameState.playerBullets.forEach(bullet => {
            drawBullet(ctx, bullet, bullet.color);
        });
        gameState.enemyBullets.forEach(bullet => {
            drawBullet(ctx, bullet, '#ff6b6b');
        });

        drawHUD(ctx, gameState.players);

    }, [gameState]);

    if (gameOver) {
        return (
            <div className="fixed inset-0 bg-black flex items-center justify-center">
                <div className="bg-gray-800 p-8 rounded-lg text-center">
                    <h2 className="text-3xl font-bold mb-4">Game Over!</h2>
                    <h3 className="text-2xl text-yellow-400 mb-6">Winner: {winner}</h3>
                    <div className="mb-6">
                        <h4 className="text-xl mb-2">Final Scores:</h4>
                        {scores.map((score, index) => (
                            <div key={index} className={`text-lg ${score.isWinner ? 'text-green-400 font-bold' : 'text-white'}`}>
                                {score.username}: {score.score} points
                            </div>
                        ))}
                    </div>
                    <p className="text-gray-400">Returning to chat room...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black flex flex-col items-center justify-center">
            <div className="mb-4 text-center">
                <h1 className="text-3xl font-bold text-white mb-2">Space Shooter</h1>
                <div className="bg-gray-800 p-4 rounded-lg mb-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p className={socket ? 'text-green-400' : 'text-red-400'}>
                                Socket: {socket ? 'Connected' : 'Disconnected'}
                            </p>
                            <p className={gameState ? 'text-green-400' : 'text-yellow-400'}>
                                GameState: {gameState ? 'Loaded' : 'Loading...'}
                            </p>
                        </div>
                        <div>
                            <p className="text-blue-400">Username: {username}</p>
                            <p className="text-purple-400">Lobby: {lobbyId}</p>
                        </div>
                    </div>

                    {gameState && (
                        <div className="mt-2 p-2 bg-gray-700 rounded">
                            <p className="text-green-400">
                                Players: {gameState.players.filter(p => p.isAlive).length}/{gameState.players.length} alive
                            </p>
                            <p className="text-white">
                                Your position: {gameState.players.find(p => p.username === username)?.x ?? 'N/A'},
                                {gameState.players.find(p => p.username === username)?.y ?? 'N/A'}
                            </p>
                        </div>
                    )}
                </div>
                <p className="text-gray-400">Use WASD/Arrow Keys to move, Spacebar to shoot</p>
                <p className="text-yellow-400 text-sm">Check browser console for detailed debug info</p>
            </div>
            <input
                type="text"
                className="absolute opacity-0 w-1 h-1"
                id="gameInput"
                autoFocus
                onBlur={(e) => {
                    setTimeout(() => e.target.focus(), 100);
                }}
                onKeyDown={(e) => {
                    e.preventDefault();
                    const key = e.key;
                    console.log('Key DOWN:', key, 'Code:', e.code);
                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key)) {
                        keys.current[key] = true;
                        console.log('Movement key pressed:', key);
                        processMovement();
                    }
                    if (key === ' ') {
                        console.log('Spacebar - shooting');
                        socket.emit('space_shooter_player_shoot', { lobbyId });
                    }
                }}
                onKeyUp={(e) => {
                    e.preventDefault();
                    const key = e.key;
                    console.log('Key UP:', key);
                    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'W', 'A', 'S', 'D'].includes(key)) {
                        keys.current[key] = false;
                    }
                }}
            />
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={600}
                    className="border-2 border-gray-600 bg-black"
                    onClick={() => {
                        document.getElementById('gameInput')?.focus();
                    }}
                />
                <div className="absolute top-2 left-2 bg-black bg-opacity-70 p-2 rounded text-white text-sm">
                    Click on game area to focus for keyboard input
                </div>
            </div>
            <div className="mt-4 text-white">
                <button
                    onClick={onGameEnd}
                    className="bg-red-500 px-4 py-2 rounded hover:bg-red-600"
                >
                    Leave Game
                </button>
            </div>
        </div>
    );
};

export default SpaceShooter;