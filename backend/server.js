const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const UserModel = require('./models/Users');
const ChatRoomModel = require('./models/chatroomModel');
const MessagesModel = require('./models/Messages');
const app = express();

const { Server } = require("socket.io");
const http = require(`http`);
const server = http.createServer(app)
const { verifyToken } = require('./verifyToken');
const validator = require('validator');

const GameLobbyModel = require('./models/GameLobbyModel');


dotenv.config();

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

const io = new Server(server, {
    cors: {
        origin: process.env.CLIENT_URL,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
        credentials: true,
    },
    transports:['websocket', 'polling'],
    pingTimeout:60000,
    pingInterval:25000,
    cookie:false
})

io.sockets.setMaxListeners(50);

app.use(express.json())

app.use(cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// app.use((req, res, next) => {
//     if (req.method === 'OPTIONS') {
//         console.log('Preflight Request:');
//         console.log('URL:', req.url);
//         console.log('Headers:', req.headers);
//         console.log('Origin:', req.headers.origin);
//
//         res.header('Access-Control-Allow-Origin', process.env.CLIENT_URL);
//         res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
//         res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
//         res.header('Access-Control-Allow-Credentials', 'true');
//         res.status(200).send();
//     } else {
//         next();
//     }
// });
//
//
// app.use((req, res, next) => {
//     if (req.method === 'OPTIONS') {
//         console.log('🛫 OPTIONS Preflight Request:');
//         console.log('  URL:', req.url);
//         console.log('  Headers:', req.headers);
//         console.log('  Origin:', req.headers.origin);
//     }
//     next();
// });

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log("Error Connecting to DB: ", err));


app.use((req, res, next) => {
    const originalJson = res.json;
    res.json = function(data) {
        if (data && data.message === "No token provided") {
            console.log('No token provided error detected!');
            console.log('Route:', req.method, req.url);
            console.log('Headers:', req.headers);
            console.log('Query:', req.query);
            console.log('Body:', req.body);
        }
        originalJson.call(this, data);
    };
    next();
});

app.get('/users', async (req, res) => {
    try {
        const users = await UserModel.find({});

        return res.status(200).json(users)
    } catch (err) {
        res.status(500).json({ message: "Error fetching users" })
    }

})

app.post('/registration', async (req, res) => {
    const { username, email, password } = req.body;

    try {
        const salt = await bcrypt.genSalt(10)
        const hashedPassword = await bcrypt.hash(password, salt);

        if (!validator.isEmail(email)) {
            res.status(400).json({ message: "Invalid email" })
        }

        const newUser = await UserModel.create({
            username,
            email,
            password: hashedPassword
        });

        return res.status(201).json(newUser);
    } catch (err) {
        return res.status(400).json({ message: "Error registering user. ", err })
    }
})

app.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await UserModel.findOne({ username }).select('+password');
        if (!user) {
            return res.status(400).json({ message: "Username or password is incorrect." })
        }
        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) {
            return res.status(400).json({ message: "Incorrect Password" })
        }
        const token = jwt.sign(
            { id: user._id, username: user.username },
            process.env.SECRET_KEY,
            { expiresIn: '1h' }
        );
        const userResponse = { id: user._id, username: user.username, email: user.password };
        return res.json({
            message: "Login Successful",
            token: token,
            user: userResponse
        })
    } catch (err) {
        console.log("Error Logging in ", err)
        res.status(500).json({ message: "Server error during login" })
    }
})

// *************CHAT ROOM FUNCTIONS**************//

const onlineUsers = new Map();
const activeLobbies = new Map();

// Create chat rooms
app.post('/create-chatroom', verifyToken, async (req, res) => {
    const { chatroomName, description, isPrivate, invitedUsers } = req.body;
    // const username = req.user.username;

    const username = req.user?.username;

    console.log("Request body:", req.body);
    console.log("User:", req.user);

    console.log(`backend received ${chatroomName},${description}, ${isPrivate} and ${invitedUsers}`)
    try {
        const newRoom = await ChatRoomModel.create({
            chatroomName,
            description,
            isPrivate: isPrivate || false,
            owner: username,
            members: [username],
            invitedUsers: invitedUsers
        })

        res.status(200).json(newRoom);
    } catch (err) {
        console.error("Error creating room:", err);

        if (err.code === 11000) {
            return res.status(400).json({ message: "Chatroom name already exists" });
        }

        res.status(400).json({
            message: "Error creating room",
            error: err.message,
        });
    }
})

app.post('/room/:roomID/join', verifyToken, async (req, res) => {
    const { roomID } = req.params;
    const username = req.user?.username;

    console.log(`Join request: roomID=${roomID}, user=${username}`);

    try {
        const room = await ChatRoomModel.findById(roomID)

        if (!room) {
            res.status(400).json({ message: "Room does not exist" })
        }

        if (room.isPrivate && !room.invitedUsers.includes(username) && !room.members.includes(username)) {
            res.status(400).json({ message: "User not allowed in private room" })
        } else {
            const updateResult = await ChatRoomModel.updateOne(
                { _id: roomID },
                { $addToSet: { members: username } }
            );
            if (updateResult.modifiedCount > 0) {
                console.log(`Added ${username} to room ${room.chatroomName}`);
            } else {
                console.log(`${username} is already a member of room ${room.chatroomName}`);
            }

            res.status(200).json({ message: "Joined room successfully", room });
        }

    } catch (err) {
        res.status(400).json({ message: "Error joining room" });
    }
})

// Retrieves Chat rooms
app.get('/rooms',verifyToken, async (req, res) => {
    const username = req.user?.username

    if(!username){
        return res.status(401).json({message:"User not authorised"})
    }

    try {

        const rooms = await ChatRoomModel.find({
            $or: [
                {members: username},
                {invitedUsers: username}]
        });

        res.status(200).json(rooms)

    } catch {
        res.status(400).json({ message: "Error getting rooms" })
    }
})

// Get specific room info
app.get('/room/:roomID', verifyToken, async (req, res) => {
    const { roomID } = req.params;
    try {
        const room = await ChatRoomModel.findById(roomID);
        if (!room) return res.status(404).json({ message: "Room not found" });
        res.status(200).json(room);
    } catch (err) {
        res.status(400).json({ message: "Error fetching room" });
    }
});

app.get('/room/:roomID/messages', verifyToken, async (req, res) => {
    try {
        const message = await MessagesModel.find({ room: req.params.roomID }).sort({ createdAt: 1 })
        res.status(200).json(message)
    } catch (err) {
        res.status(400).json({ message: "Error fetching messages,", err })
    }

});

// app.options('/room/:roomID/start-game', cors({
//     origin: process.env.CLIENT_URL,
//     credentials: true,
//     methods: ["POST", "OPTIONS"],
//     allowedHeaders: ['Content-Type', 'Authorization']
// }));
app.post('/room/:roomID/start-game', verifyToken, async (req, res)=>{
    console.log('/room/:roomID/start-game route hit!');
    console.log('Room ID:', req.params.roomID);
    console.log('User making request:', req.user?.username);
    console.log('Request body:', req.body);
    console.log('Headers:', req.headers);

    const {roomID} = req.params;
    const {gameType} = req.body;
    const username = req.user?.username;

    try{
        console.log('Trying to find room')
        const room = await ChatRoomModel.findById(roomID);
        if(!room){
            return res.status(404).json({message: "Room not found"});
        }

        console.log('Searching for owner')

        if(room.owner !== username){
            return res.status(403).json({message: 'Only room owner can start games'});
        }
        console.log('owner found');

        console.log('checking for exiting lobbies')
        const existingLobby = await GameLobbyModel.findOne({
            roomId: roomID,
            status: {$in: ['waiting', 'starting', 'active']}
        });

        if(existingLobby){
            return res.status(400).json({message: 'Game already in progress'});
        }
        console.log('no lobbies found')

        console.log('validating game type')
        const gameConfig = {
            SpaceShooter: {minPlayers: 2, maxPlayers: 4},
            Imposter: {minPlayers: 3, maxPlayers: 10}
        };

        const config = gameConfig[gameType];
        if(!config){
            return res.status(400).json({message: 'Invalid game type'});
        }

        const countdownEnds = new Date(Date.now()+ 30000);

        const newLobby = await GameLobbyModel.create({
            roomId: roomID,
            gameType,
            owner: username,
            players: [{
                username: username,
                socketId: null,
                joinedAt: new Date()
            }],
            maxPlayers: config.maxPlayers,
            minPlayers: config.minPlayers,
            countdownEnds,
            status: 'waiting'
        });

        const ownerSocketId = Array.from(io.sockets.sockets.values()).find(socket => socket.username === username)?.id;

        if(ownerSocketId){
            await GameLobbyModel.findByIdAndUpdate(newLobby._id,{
                $set: {"players.0.socketId":ownerSocketId}
            });
            console.log(`Updated socket owner ID to ${ownerSocketId}`)
        }

        activeLobbies.set(roomID, newLobby._id);

        io.to(roomID).emit('game_invitation', {
            lobbyId: newLobby._id,
            gameType,
            startedBy: username,
            countdownEnds: countdownEnds.getTime(),
            minPlayers: config.minPlayers,
            maxPlayers: config.maxPlayers
        });

        // Start countdown
        startLobbyCountdown(newLobby._id, roomID);

        res.status(200).json({
            message: "Game started successfully",
            lobbyId: newLobby._id
        });

    }catch (err){
        console.error("Error starting game:", err);
        res.status(500).json({ message: "Error starting game" });
    }
});

app.post('/lobby/:lobbyId/join', verifyToken, async (req, res) => {
    const { lobbyId } = req.params;
    const username = req.user?.username;

    try {
        console.log('Joining lobby:', { lobbyId, username });
        const lobby = await GameLobbyModel.findById(lobbyId);
        if (!lobby) {
            console.log('Lobby not found');
            return res.status(404).json({ message: "Lobby not found" });
        }

        // Ensure players array exists
        if (!lobby.players) {
            lobby.players = [];
        }

        // Check if player already in lobby
        const alreadyJoined = lobby.players.some(player => player && player.username === username);
        if (alreadyJoined) {
            return res.status(400).json({ message: "Already joined lobby" });
        }

        // Check if lobby is full
        if (lobby.players.length >= lobby.maxPlayers) {
            return res.status(400).json({ message: "Lobby is full" });
        }

        // Check if game already started
        if (lobby.status !== 'waiting') {
            return res.status(400).json({ message: "Game already started" });
        }

        // Add player to lobby with proper structure
        lobby.players.push({
            username: username,
            socketId: null,
            joinedAt: new Date()
        });
        await lobby.save();

        console.log('Player joined lobby:', { username, playerCount: lobby.players.length });

        // Broadcast player joined
        io.to(lobby.roomId.toString()).emit('player_joined_lobby', {
            lobbyId,
            username,
            playerCount: lobby.players.length,
            minPlayers: lobby.minPlayers
        });

        res.status(200).json({ message: "Joined lobby successfully" });

    } catch (err) {
        console.error("Error joining lobby:", err);
        res.status(500).json({
            message: "Error joining lobby",
            error: err.message
        });
    }
});

app.post('/lobby/:lobbyId/leave', verifyToken, async (req, res) => {
    const { lobbyId } = req.params;
    const username = req.user?.username;

    try {
        const lobby = await GameLobbyModel.findById(lobbyId);
        if (!lobby) {
            return res.status(404).json({ message: "Lobby not found" });
        }

        // Remove player from lobby
        lobby.players = lobby.players.filter(player => player.username !== username);
        await lobby.save();

        // Broadcast player left
        io.to(lobby.roomId.toString()).emit('player_left_lobby', {
            lobbyId,
            username,
            playerCount: lobby.players.length
        });

        // If owner leaves and there are other players, assign new owner
        if (lobby.owner === username && lobby.players.length > 0) {
            lobby.owner = lobby.players[0].username;
            await lobby.save();

            io.to(lobby.roomId.toString()).emit('lobby_owner_changed', {
                lobbyId,
                newOwner: lobby.owner
            });
        }

        // If no players left, delete lobby
        if (lobby.players.length === 0) {
            await GameLobbyModel.findByIdAndDelete(lobbyId);
            activeLobbies.delete(lobby.roomId.toString());
        }

        res.status(200).json({ message: "Left lobby successfully" });

    } catch (err) {
        console.error("Error leaving lobby:", err);
        res.status(500).json({ message: "Error leaving lobby" });
    }
});

// Get lobby info
app.get('/lobby/:lobbyId', verifyToken, async (req, res) => {
    const { lobbyId } = req.params;

    try {
        const lobby = await GameLobbyModel.findById(lobbyId);
        if (!lobby) {
            return res.status(404).json({ message: "Lobby not found" });
        }

        res.status(200).json(lobby);
    } catch (err) {
        console.error("Error fetching lobby:", err);
        res.status(500).json({ message: "Error fetching lobby" });
    }
});

// Countdown function
// function startLobbyCountdown(lobbyId, roomId) {
//     const checkLobby = async () => {
//         try {
//             const lobby = await GameLobbyModel.findById(lobbyId);
//             if (!lobby) return;
//
//             const now = new Date();
//             const timeLeft = lobby.countdownEnds - now;
//
//             // Broadcast countdown update every second
//             io.to(roomId).emit('lobby_countdown', {
//                 lobbyId,
//                 timeLeft: Math.max(0, timeLeft),
//                 playerCount: lobby.players.length,
//                 minPlayers: lobby.minPlayers
//             });
//
//             io.to(`lobby_${lobbyId}`).emit('lobby_countdown', {
//                 lobbyId,
//                 timeLeft: Math.max(0, timeLeft),
//                 playerCount: lobby.players.length,
//                 minPlayers: lobby.minPlayers
//             });
//
//             if (timeLeft <= 0) {
//                 // Countdown ended, start game if enough players
//                 if (lobby.players.length >= lobby.minPlayers) {
//                     lobby.status = 'active';
//                     await lobby.save();
//
//                     io.to(roomId).emit('game_starting', {
//                         lobbyId,
//                         gameType: lobby.gameType,
//                         players: lobby.players
//                     });
//
//                     io.to(`lobby_${lobbyId}`).emit('game_starting', {
//                         lobbyId,
//                         gameType: lobby.gameType,
//                         players: lobby.players
//                     });
//
//                     // Start the actual game
//                     startGameSession(lobby);
//                 } else {
//                     // Not enough players, cancel game
//                     lobby.status = 'finished';
//                     await lobby.save();
//
//                     io.to(roomId).emit('game_cancelled', {
//                         lobbyId,
//                         reason: `Not enough players. Need at least ${lobby.minPlayers} players.`
//                     });
//
//                     activeLobbies.delete(roomId);
//                 }
//                 return;
//             }
//
//             // Continue countdown
//             setTimeout(() => checkLobby(), 1000);
//         } catch (err) {
//             console.error("Error in lobby countdown:", err);
//         }
//     };
//
//     // Start countdown
//     setTimeout(() => checkLobby(), 1000);
// }

function startLobbyCountdown(lobbyId, roomId) {
    console.log(`Staring countdown for lobby ${lobbyId}, room ${roomId}`);

    let countdownActive = true;

    const checkLobby = async () => {
        if (!countdownActive) {
            console.log(`Countdown stopped for lobby ${lobbyId}`);
            return;
        }

        try {
            console.log(`Checking lobby ${lobbyId} countdown...`);
            const lobby = await GameLobbyModel.findById(lobbyId);

            if (!lobby) {
                console.log(`Lobby ${lobbyId} not found - stopping countdown`);
                countdownActive = false;
                return;
            }

            lobby.players.forEach(player => {
                if (player.socketId) {
                    console.log(`TEST: Emitting directly to ${player.username} (${player.socketId})`);
                    io.to(player.socketId).emit('game_starting_test', {
                        lobbyId: lobby._id,
                        gameType: lobby.gameType,
                        message: 'DIRECT TO SOCKET'
                    });
                }
            });

            const now = new Date();
            const timeLeft = lobby.countdownEnds - now;

            console.log(`Lobby ${lobbyId}: ${Math.ceil(timeLeft / 1000)}s left (${timeLeft}ms)`);
            console.log(`Countdown ends at: ${lobby.countdownEnds.toISOString()}`);
            console.log(`Current time: ${now.toISOString()}`);

            // Broadcast countdown update
            io.to(roomId).emit('lobby_countdown', {
                lobbyId,
                timeLeft: Math.max(0, timeLeft),
                playerCount: lobby.players.length,
                minPlayers: lobby.minPlayers
            });

            if (timeLeft <= 0) {
                console.log(`COUNTDOWN ENDED for lobby ${lobbyId}`);
                console.log(`Players: ${lobby.players.length}, Required: ${lobby.minPlayers}`);

                countdownActive = false; // Stop the countdown

                // Countdown ended, start game if enough players
                if (lobby.players.length >= lobby.minPlayers) {
                    console.log(`Starting game - enough players`);

                    try {
                        // Update lobby status
                        lobby.status = 'active';
                        await lobby.save();
                        console.log(`Lobby status updated to 'active'`);

                        console.log(`Emitting game_starting to room ${roomId}`);
                        console.log("DEBUG - About to emit game_starting:");
                        console.log("Room ID:", roomId);
                        console.log("Game Type:", lobby.gameType);
                        console.log("Players:", lobby.players.length);

                        const roomSockets = io.sockets.adapter.rooms.get(roomId);
                        console.log("   Sockets in room:", roomSockets ? Array.from(roomSockets) : "ROOM NOT FOUND");
                        console.log("   Current socket count in room:", roomSockets ? roomSockets.size : 0);
                        io.to(roomId).emit('game_starting', {
                            lobbyId,
                            gameType: lobby.gameType,
                            players: lobby.players
                        });

                        io.to(`lobby_${lobbyId}`).emit('game_starting',{
                            lobbyId,
                            gameType: lobby.gameType,
                            players: lobby.players
                        })

                        console.log(`Calling startGameSession`);
                        startGameSession(lobby);
                    } catch (saveErr) {
                        console.error(`Error saving lobby:`, saveErr);
                    }
                } else {
                    // Not enough players, cancel game
                    console.log(`Cancelling game - not enough players`);
                    try {
                        lobby.status = 'finished';
                        await lobby.save();

                        io.to(roomId).emit('game_cancelled', {
                            lobbyId,
                            reason: `Not enough players. Need at least ${lobby.minPlayers} players.`
                        });

                        activeLobbies.delete(roomId);
                    } catch (saveErr) {
                        console.error(`Error cancelling game:`, saveErr);
                    }
                }
                return;
            }

            // Continue countdown if time still left
            if (countdownActive) {
                console.log(`Scheduling next countdown check for lobby ${lobbyId}`);
                setTimeout(() => checkLobby(), 1000);
            }
        } catch (err) {
            console.error("Error in lobby countdown:", err);
            countdownActive = false;
        }
    };

    // Start the countdown
    console.log(`Launching countdown for lobby ${lobbyId}`);
    checkLobby();
}
//
// function handleCountdownEnd(lobby, roomId) {
//     console.log(`🎯 Handling countdown end for lobby ${lobby._id}`);
//
//     if (lobby.players.length >= lobby.minPlayers) {
//         console.log(`Starting game immediately`);
//         lobby.status = 'active';
//         lobby.save().then(() => {
//             io.to(roomId).emit('game_starting', {
//                 lobbyId: lobby._id,
//                 gameType: lobby.gameType,
//                 players: lobby.players
//             });
//             startGameSession(lobby);
//         });
//     } else {
//         console.log(`Not enough players`);
//         lobby.status = 'finished';
//         lobby.save().then(() => {
//             io.to(roomId).emit('game_cancelled', {
//                 lobbyId: lobby._id,
//                 reason: `Not enough players. Need at least ${lobby.minPlayers} players.`
//             });
//         });
//     }
// }

function startGameSession(lobby) {
    console.log("Starting Game session for lobby: ", lobby._id.toString());

    const chatRoom = lobby.roomId.toString();
    const gameLobbyRoom = `lobby_${lobby._id}`;


    io.to(chatRoom).emit('game_session_started', {
        lobbyId: lobby._id,
        gameType: lobby.gameType,
        players: lobby.players
    });

    io.to(gameLobbyRoom).emit('game_session_started', {
        lobbyId: lobby._id,
        gameType: lobby.gameType,
        players: lobby.players
    });

    console.log('Initializing game:', lobby.gameType);
    if (lobby.gameType === 'SpaceShooter') {
        initializeSpaceShooterGame(lobby);
    } else if (lobby.gameType === 'Imposter') {
        initializeImposterGame(lobby);
    }
}

// io.use((socket, next) => {
//     const token = socket.handshake.auth?.token;
//     console.log(`Socket auth attempt: token=${token ? 'present' : 'missing'}`);
//     if (!token) {
//         console.log('Socket auth failed: No token provided');
//         return next(new Error('Authentication error: No token'));
//     }
//     try {
//         const decoded = jwt.verify(token, process.env.SECRET_KEY)
//         socket.userId = decoded.id;
//         socket.username = decoded.username
//         next()
//     } catch (err) {
//         next(new Error('Invalid Token'));
//     }
// })

io.use((socket, next) => {
    console.log('=== SOCKET.IO AUTHENTICATION ===');
    console.log('Socket ID:', socket.id);
    console.log('Handshake headers:', socket.handshake.headers);
    console.log('Handshake auth:', socket.handshake.auth);
    console.log('Handshake query:', socket.handshake.query);

    const tokenFromAuth = socket.handshake.auth?.token;
    const tokenFromQuery = socket.handshake.query?.token;
    const authHeader = socket.handshake.headers?.authorization;

    console.log('Token from auth:', tokenFromAuth ? `Present (${tokenFromAuth.length} chars)` : 'Missing');
    console.log('Token from query:', tokenFromQuery ? `Present (${tokenFromQuery.length} chars)` : 'Missing');
    console.log('Auth header:', authHeader ? `Present (${authHeader.length} chars)` : 'Missing');

    let token = tokenFromAuth || tokenFromQuery;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
        console.log('Extracted token from Authorization header');
    }

    console.log('Final token to verify:', token ? `Present (${token.length} chars)` : 'MISSING');

    if (!token) {
        console.log('No token found in any location');
        return next(new Error('No token provided'));
    }

    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        console.log('Successful for user:', decoded.username);
        socket.userId = decoded.id;
        socket.username = decoded.username;
        next();
    } catch (err) {
        console.log('Token verification error:', err.message);
        next(new Error('Invalid Token'));
    }
});

// Space Shooter socket event handlers
const spaceShooterGames = new Map();

function initializeSpaceShooterGame(lobby) {
    console.log(`Initializing Space Shooter game for lobby ${lobby._id}`);

    lobby.players.forEach(player =>{
        console.log(`Player: ${player}, socket ID:${player.socketId}`);
        const roomSocket = io.sockets.adapter.rooms.get(`lobby_${lobby._id}`) || new Set();
        console.log(`Socket in room lobby_${lobby._id}`, Array.from(roomSocket));
        if(!player.socketId){
            console.log(`Player ${player.username} has not socket ID!`);
        }else if(!roomSocket.has(player.socketId)){
            console.log(`Player ${player.username} is not in room`);
        }else{
            console.log(`Player ${player.username} properly connected!`)
        }

    })

    // Create game state with proper socket IDs
    const gameState = {
        players: lobby.players.map((player, index) => ({
            id: player.socketId,
            username: player.username,
            x: 400 + (index * 100),
            y: 500,
            width: 50,
            height: 50,
            health: 100,
            score: 0,
            color: getPlayerColor(index),
            lastShot: 0,
            isAlive: true
        })),
        enemies: [],
        enemyBullets: [],
        playerBullets: [],
        gameStartTime: Date.now(),
        isActive: true,
        lastEnemySpawn: Date.now(),
        enemySpawnRate: 2000,
        gameLoop: null
    };

    spaceShooterGames.set(lobby._id.toString(), gameState);

    const chatRoom = lobby.roomId.toString();
    const gameLobbyRoom = `lobby_${lobby._id}`;



    // Start the game loop
    startSpaceShooterGameLoop(lobby._id.toString());

    // Notify all players that game is starting
    io.to(chatRoom).emit('space_shooter_game_start', {
        lobbyId: lobby._id,
        players: gameState.players,
        gameState: 'starting'
    });

    io.to(gameLobbyRoom).emit('space_shooter_game_start', {
        lobbyId: lobby._id,
        players: gameState.players,
        gameState: 'starting'
    });

    console.log(`Space Shooter game started for lobby ${lobby._id} with players:`, gameState.players);
}

function getPlayerColor(index) {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
    return colors[index % colors.length];
}

function startSpaceShooterGameLoop(lobbyId) {
    const gameLoop = setInterval(() => {
        const gameState = spaceShooterGames.get(lobbyId);
        if (!gameState || !gameState.isActive) {
            clearInterval(gameLoop);
            return;
        }

        updateGameState(lobbyId, gameState);

        // Broadcast game state to all players
        io.to(`lobby_${lobbyId}`).emit('space_shooter_game_state', {
            players: gameState.players,
            enemies: gameState.enemies,
            playerBullets: gameState.playerBullets,
            enemyBullets: gameState.enemyBullets,
            timestamp: Date.now()
        });

    }, 1000 / 60); // 60 FPS

    // Store the interval ID
    const gameState = spaceShooterGames.get(lobbyId);
    if (gameState) {
        gameState.gameLoop = gameLoop;
    }
}

function updateGameState(lobbyId, gameState) {
    const now = Date.now();

    // Spawn new enemies
    if (now - gameState.lastEnemySpawn > gameState.enemySpawnRate) {
        spawnEnemy(gameState);
        gameState.lastEnemySpawn = now;
    }

    // Update enemy positions
    updateEnemies(gameState);

    // Update bullet positions
    updateBullets(gameState);

    // Enemy shooting logic
    enemyShooting(gameState, now);

    // Check collisions
    checkCollisions(gameState);

    // Check game over condition
    checkGameOver(lobbyId, gameState);
}

function spawnEnemy(gameState) {
    const enemyTypes = [
        { width: 40, height: 40, health: 1, speed: 2, color: '#ff6b6b', score: 10 },
        { width: 60, height: 60, health: 2, speed: 1, color: '#ff9ff3', score: 20 },
        { width: 30, height: 30, health: 1, speed: 3, color: '#feca57', score: 15 }
    ];

    const enemyType = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];

    const enemy = {
        id: Math.random().toString(36).substr(2, 9),
        x: Math.random() * 700,
        y: -50,
        width: enemyType.width,
        height: enemyType.height,
        health: enemyType.health,
        maxHealth: enemyType.health,
        speed: enemyType.speed,
        color: enemyType.color,
        scoreValue: enemyType.score,
        lastShot: 0,
        shootRate: 3000 + Math.random() * 2000 // Shoot every 3-5 seconds
    };

    gameState.enemies.push(enemy);
}

function updateEnemies(gameState) {
    gameState.enemies = gameState.enemies.filter(enemy => {
        enemy.y += enemy.speed;

        // Remove enemies that go off screen
        return enemy.y <= 600;
    });
}

function updateBullets(gameState) {
    // Update player bullets (moving up)
    gameState.playerBullets = gameState.playerBullets.filter(bullet => {
        bullet.y -= 8;
        return bullet.y > 0;
    });

    // Update enemy bullets (moving down)
    gameState.enemyBullets = gameState.enemyBullets.filter(bullet => {
        bullet.y += 6;
        return bullet.y < 600;
    });
}

function enemyShooting(gameState, now) {
    gameState.enemies.forEach(enemy => {
        if (now - enemy.lastShot > enemy.shootRate) {
            // Find closest player
            const closestPlayer = gameState.players
                .filter(player => player.isAlive)
                .reduce((closest, player) => {
                    const distance = Math.sqrt(
                        Math.pow(enemy.x - player.x, 2) + Math.pow(enemy.y - player.y, 2)
                    );
                    return !closest || distance < closest.distance ?
                        { player, distance } : closest;
                }, null);

            if (closestPlayer && closestPlayer.distance < 400) {
                // Shoot at player
                const angle = Math.atan2(
                    closestPlayer.player.y - enemy.y,
                    closestPlayer.player.x - enemy.x
                );

                gameState.enemyBullets.push({
                    id: Math.random().toString(36).substr(2, 9),
                    x: enemy.x + enemy.width / 2,
                    y: enemy.y + enemy.height,
                    width: 4,
                    height: 12,
                    color: '#ff6b6b',
                    vx: Math.cos(angle) * 4,
                    vy: Math.sin(angle) * 4
                });

                enemy.lastShot = now;
            }
        }
    });
}

function checkCollisions(gameState) {
    // Player bullets vs Enemies
    gameState.playerBullets = gameState.playerBullets.filter(bullet => {
        let hit = false;

        gameState.enemies = gameState.enemies.filter(enemy => {
            if (checkCollision(bullet, enemy)) {
                enemy.health--;
                if (enemy.health <= 0) {
                    // Find player who shot this bullet and give them points
                    const player = gameState.players.find(p => p.id === bullet.playerId);
                    if (player) {
                        player.score += enemy.scoreValue;
                    }
                    return false; // Remove enemy
                }
                hit = true;
            }
            return true;
        });

        return !hit;
    });

    // Enemy bullets vs Players
    gameState.enemyBullets = gameState.enemyBullets.filter(bullet => {
        let hit = false;

        gameState.players.forEach(player => {
            if (player.isAlive && checkCollision(bullet, player)) {
                player.health -= 10;
                if (player.health <= 0) {
                    player.isAlive = false;
                    player.health = 0;
                }
                hit = true;
            }
        });

        return !hit;
    });

    // Enemies vs Players (collision)
    gameState.enemies = gameState.enemies.filter(enemy => {
        let hit = false;

        gameState.players.forEach(player => {
            if (player.isAlive && checkCollision(enemy, player)) {
                player.health -= 20;
                if (player.health <= 0) {
                    player.isAlive = false;
                    player.health = 0;
                }
                hit = true;
            }
        });

        return !hit;
    });
}

function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width &&
        obj1.x + obj1.width > obj2.x &&
        obj1.y < obj2.y + obj2.height &&
        obj1.y + obj1.height > obj2.y;
}

function checkGameOver(lobbyId, gameState) {
    const alivePlayers = gameState.players.filter(player => player.isAlive).length;

    if (alivePlayers === 0) {
        // All players dead, game over
        gameState.isActive = false;

        // Calculate winner
        const winner = gameState.players.reduce((prev, current) =>
            (prev.score > current.score) ? prev : current
        );

        io.to(`lobby_${lobbyId}`).emit('space_shooter_game_over', {
            winner: winner.username,
            scores: gameState.players.map(player => ({
                username: player.username,
                score: player.score,
                isWinner: player.username === winner.username
            }))
        });

        // Clean up game state
        if (gameState.gameLoop) {
            clearInterval(gameState.gameLoop);
        }
        spaceShooterGames.delete(lobbyId);
    }
}


const imposterGames = new Map();

const GAME_THEMES = {
    animals: ['Lion', 'Elephant', 'Dolphin', 'Eagle', 'Kangaroo', 'Penguin', 'Tiger', 'Giraffe'],
    food: ['Pizza', 'Sushi', 'Taco', 'Burger', 'Pasta', 'Salad', 'Ice Cream', 'Sandwich'],
    countries: ['France', 'Japan', 'Brazil', 'Canada', 'Australia', 'Egypt', 'Italy', 'Mexico'],
    professions: ['Doctor', 'Teacher', 'Chef', 'Artist', 'Engineer', 'Musician', 'Athlete', 'Scientist'],
    movies: ['Star Wars', 'Titanic', 'Avatar', 'Inception', 'Frozen', 'Jaws', 'Matrix', 'Toy Story']
};

function initializeImposterGame(lobby) {
    console.log(`Initializing Imposter game for lobby ${lobby._id}`);

    // Select random theme and word
    const themes = Object.keys(GAME_THEMES);
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    const words = GAME_THEMES[randomTheme];
    const secretWord = words[Math.floor(Math.random() * words.length)];

    console.log(`Selected theme: ${randomTheme}, secret word: ${secretWord}`);

    const players = lobby.players.map(player => ({
        username: player.username,
        socketId: player.socketId,
        isAlive: true,
        role: 'crewmate',
        hasSubmittedClue: false,
        clue: '',
        vote: null,
        isReady: false
    }));

    const imposterCount = Math.max(1, Math.floor(players.length / 5));
    const imposters = [];

    for (let i = 0; i < imposterCount; i++) {
        let randomPlayer;
        do {
            randomPlayer = players[Math.floor(Math.random() * players.length)];
        } while (imposters.includes(randomPlayer.username));

        randomPlayer.role = 'imposter';
        imposters.push(randomPlayer.username);
    }

    const gameState = {
        players,
        imposters,
        secretWord,
        theme: randomTheme,
        currentRound: 1,
        maxRounds: 3,
        gameState: 'clue_submission', // clue_submission, discussion, voting, results
        clues: [],
        votes: {},
        chat: [],
        startTime: Date.now(),
        isActive: true,
        timer: null,
        roundTimer: 60 // 60 seconds per phase
    };

    imposterGames.set(lobby._id.toString(), gameState);


    players.forEach(player => {
        const playerInfo = {
            lobbyId: lobby._id.toString(),
            players: gameState.players.map(p => ({
                username: p.username,
                role: p.role,
                isAlive: p.isAlive
            })),
            theme: gameState.theme,
            currentRound: gameState.currentRound,
            gameState: gameState.gameState,
            yourRole: player.role,
            message: player.role === 'imposter'
                ? `You are the IMPOSTER! The theme is: ${gameState.theme}. Try to blend in by guessing what the secret word might be based on other players' clues.`
                : `You are a CREWMATE! The secret word is: ${gameState.secretWord}. Give subtle clues without revealing the word directly.`
        };

        // Add secret word only for crewmates
        if (player.role === 'crewmate') {
            playerInfo.secretWord = gameState.secretWord;
        }

        // Store player info for later requests
        gameState.playerInfo = gameState.playerInfo || {};
        gameState.playerInfo[player.username] = playerInfo;
    });

    broadcastImposterGameState(lobby._id.toString());

    startImposterRoundTimer(lobby._id.toString());

    console.log(`Imposter game started for lobby ${lobby._id.toString()}`);
}

function startImposterRoundTimer(lobbyId) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState || !gameState.isActive) return;

    if (gameState.timer) {
        clearInterval(gameState.timer);
    }

    gameState.timer = setInterval(() => {
        gameState.roundTimer--;

        // Broadcast timer update
        io.to(`lobby_${lobbyId.toString()}`).emit('imposter_timer_update', {
            timeLeft: gameState.roundTimer,
            phase: gameState.gameState
        });

        if (gameState.roundTimer <= 0) {
            handlePhaseTimeout(lobbyId);
        }
    }, 1000);
}

function handlePhaseTimeout(lobbyId) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState || !gameState.isActive) return;

    console.log(`Phase timeout for ${gameState.gameState} in lobby ${lobbyId}`);

    switch (gameState.gameState) {
        case 'clue_submission':
            // Auto-submit empty clues for players who didn't submit
            let autoSubmitted = false;
            gameState.players.forEach(player => {
                if (!player.hasSubmittedClue && player.isAlive) {
                    player.clue = '(no clue submitted)';
                    player.hasSubmittedClue = true;
                    autoSubmitted = true;
                    console.log(`Auto-submitted clue for ${player.username}`);
                }
            });

            // Give a brief delay before moving to discussion
            setTimeout(() => {
                startDiscussionPhase(lobbyId);
            }, 2000);
            break;

        case 'discussion':
            // Give a brief delay before moving to voting
            setTimeout(() => {
                startVotingPhase(lobbyId);
            }, 2000);
            break;

        case 'voting':
            // Process votes immediately
            processVotes(lobbyId);
            break;
    }
}

function startDiscussionPhase(lobbyId) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState) return;

    gameState.gameState = 'discussion';
    gameState.roundTimer = 60; // 1 minutes for discussion

    // Reveal all clues to everyone
    const revealedClues = gameState.players
        .filter(player => player.isAlive)
        .map(player => ({
            username: player.username,
            clue: player.clue
        }));

    io.to(`lobby_${lobbyId}`).emit('imposter_clues_revealed', {
        clues: revealedClues,
        round: gameState.currentRound
    });

    broadcastImposterGameState(lobbyId);
    startImposterRoundTimer(lobbyId);

    console.log(`Discussion phase started for lobby ${lobbyId}`);
}

function startVotingPhase(lobbyId) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState) return;

    gameState.gameState = 'voting';
    gameState.roundTimer = 30; // 30 seconds for voting
    gameState.votes = {};

    const alivePlayers = gameState.players.filter(p => p.isAlive).map(p => p.username);

    io.to(`lobby_${lobbyId}`).emit('imposter_voting_started', {
        players: alivePlayers,
        round: gameState.currentRound
    });

    broadcastImposterGameState(lobbyId);
    startImposterRoundTimer(lobbyId);

    console.log(`Voting phase started for lobby ${lobbyId}`);
}

function processVotes(lobbyId) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState) return;

    const voteCounts = {};
    const alivePlayers = gameState.players.filter(p => p.isAlive);

    // Count votes
    Object.values(gameState.votes).forEach(votedFor => {
        voteCounts[votedFor] = (voteCounts[votedFor] || 0) + 1;
    });

    const maxVotes = Math.max(...Object.values(voteCounts));
    const votedPlayers = Object.keys(voteCounts).filter(player => voteCounts[player] === maxVotes);

    let result;

    if (votedPlayers.length === 1 && votedPlayers[0] !== 'skip') {
        // Player was voted out
        const ejectedPlayer = gameState.players.find(p => p.username === votedPlayers[0]);
        if (ejectedPlayer) {
            ejectedPlayer.isAlive = false;

            if (ejectedPlayer.role === 'imposter') {
                // Crewmates win!
                result = {
                    ejectedPlayer: ejectedPlayer.username,
                    role: 'imposter',
                    gameOver: true,
                    winners: 'crewmates',
                    message: `${ejectedPlayer.username} was the IMPOSTER! Crewmates win!`
                };
            } else {
                // Crewmate was voted out
                result = {
                    ejectedPlayer: ejectedPlayer.username,
                    role: 'crewmate',
                    gameOver: false,
                    message: `${ejectedPlayer.username} was a CREWMATE! The game continues.`
                };

                // Check if imposter wins (only one crewmate left)
                const aliveCrewmates = gameState.players.filter(p => p.isAlive && p.role === 'crewmate').length;
                const aliveImposters = gameState.players.filter(p => p.isAlive && p.role === 'imposter').length;

                if (aliveCrewmates <= aliveImposters) {
                    result.gameOver = true;
                    result.winners = 'imposters';
                    result.message = `The IMPOSTER wins! Only ${aliveCrewmates} crewmate(s) remain.`;
                }
            }
        }
    } else {
        // Skip vote or tie
        result = {
            ejectedPlayer: null,
            gameOver: false,
            message: 'No one was voted out. The game continues.'
        };
    }

    // Broadcast results
    io.to(`lobby_${lobbyId}`).emit('imposter_vote_results', result);

    if (result.gameOver) {
        endImposterGame(lobbyId, result.winners);
    } else {
        // Start next round
        startNextRound(lobbyId);
    }
}

function startNextRound(lobbyId) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState) return;

    gameState.currentRound++;
    gameState.gameState = 'clue_submission';
    gameState.roundTimer = 60;

    // Reset player states for new round
    gameState.players.forEach(player => {
        if (player.isAlive) {
            player.hasSubmittedClue = false;
            player.clue = '';
            player.vote = null;
        }
    });

    gameState.clues = [];
    gameState.votes = {};

    io.to(`lobby_${lobbyId}`).emit('imposter_new_round', {
        round: gameState.currentRound,
        maxRounds: gameState.maxRounds
    });

    broadcastImposterGameState(lobbyId);
    startImposterRoundTimer(lobbyId);

    console.log(`Round ${gameState.currentRound} started for lobby ${lobbyId}`);
}

function endImposterGame(lobbyId, winners) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState) return;

    gameState.isActive = false;

    if (gameState.timer) {
        clearInterval(gameState.timer);
    }

    const finalScores = gameState.players.map(player => ({
        username: player.username,
        role: player.role,
        isWinner: (winners === 'crewmates' && player.role === 'crewmate') ||
            (winners === 'imposters' && player.role === 'imposter')
    }));

    io.to(`lobby_${lobbyId}`).emit('imposter_game_over', {
        winners: winners,
        secretWord: gameState.secretWord,
        theme: gameState.theme,
        scores: finalScores
    });

    imposterGames.delete(lobbyId);

    console.log(`Imposter game ended for lobby ${lobbyId}. Winners: ${winners}`);
}

function broadcastImposterGameState(lobbyId) {
    const gameState = imposterGames.get(lobbyId);
    if (!gameState || !gameState.isActive) return;

    const publicGameState = {
        gameState: gameState.gameState,
        currentRound: gameState.currentRound,
        maxRounds: gameState.maxRounds,
        players: gameState.players.map(p => ({
            username: p.username,
            isAlive: p.isAlive,
            hasSubmittedClue: p.hasSubmittedClue,
            role: p.role // Reveal roles only at game end
        })),
        timeLeft: gameState.roundTimer
    };

    // CHANGED: Use new event name to avoid conflicts
    io.to(`lobby_${lobbyId}`).emit('imposter_game_state_word', publicGameState);
}

io.on('connection', (socket) => {
    console.log(`User Connected ${socket.id}, ${socket.username}`);

    socket.on('join_room', (roomID, callback) => {
        socket.join(roomID);
        console.log(`User ${socket.id} joined room ${roomID}`);
        if(callback){
            callback({status: 'ok', roomId: roomID});
        }

        socket.emit('join_room', {roomId: roomID});

        console.log(`User ${socket.id} joined room ${roomID}`);
        console.log(`Room ${roomID} now has:`, io.sockets.adapter.rooms.get(roomID)?.size || 0, 'sockets');
    });

    onlineUsers.set(socket.userId, {username: socket.username, socketId: socket.id})
    io.emit('onlineUsers', Array.from(onlineUsers.values()))

    socket.on('request_online_users', () => {
        socket.emit('onlineUsers', Array.from(onlineUsers.values()));
    });

    socket.on('send_message', async (messageData) => {
        try {
            // save to database
            const newMessage = await MessagesModel.create({
                room: messageData.room,
                sender: socket.username,
                content: messageData.content
            })

            // emit the saved message with timestamp
            const fullMessage = {
                ...messageData,
                sender: socket.username,
                time: new Date(newMessage.createdAt).toLocaleTimeString()
            }
            socket.to(messageData.room).emit('receive_message', fullMessage);
            socket.emit('message_sent', fullMessage);
            console.log("Message saved to DB and broad casted to chat.")
        } catch (err) {
            console.log("Error sending message")
            socket.emit('error', 'failed to send message')
        }
    });

    socket.on('leave_game_lobby', async (lobbyId) => {
        socket.leave(`lobby_${lobbyId}`);
        console.log(`User ${socket.username} left game lobby ${lobbyId}`);
    });

    // SPACE SHOOTER
    socket.on('space_shooter_player_ready', (data) => {
        // Player is ready, no specific action needed for now
        console.log(`Player ${socket.username} ready for space shooter`);
    });

    socket.on('space_shooter_player_move', (data) => {
        console.log('Received movement from client:', {
            username: socket.username,
            lobbyId: data.lobbyId,
            x: data.x,
            y: data.y,
            timestamp: new Date().toISOString()
        });

        const gameState = spaceShooterGames.get(data.lobbyId);
        if (!gameState) {
            console.log('Game state not found');
            return;
        }

        const player = gameState.players.find(p => p.username === socket.username);
        if (player && player.isAlive) {
            player.x = data.x;
            player.y = data.y;

            console.log(`Updated player ${player.username} to (${player.x}, ${player.y})`);

            // Broadcast to all clients
            io.to(`lobby_${data.lobbyId}`).emit('space_shooter_player_moved', {
                username: player.username,
                x: player.x,
                y: player.y,
                isAlive: player.isAlive
            });
        }
    });

    socket.on('space_shooter_player_shoot', (data) => {
        const gameState = spaceShooterGames.get(data.lobbyId);
        if (!gameState || !gameState.isActive) return;

        const player = gameState.players.find(p => p.id === socket.id);
        if (player && player.isAlive) {
            const now = Date.now();
            if (now - player.lastShot > 500) { // Rate limit shooting
                gameState.playerBullets.push({
                    id: Math.random().toString(36).substr(2, 9),
                    x: player.x + player.width / 2 - 2,
                    y: player.y,
                    width: 4,
                    height: 12,
                    color: player.color,
                    playerId: player.id
                });
                player.lastShot = now;
            }
        }
    });

    socket.on('space_shooter_score', (data) => {
        // Broadcast score update
        socket.to(data.roomID).emit('space_shooter_score_update', {
            username: data.username,
            score: data.score
        });
    });

    socket.on('space_shooter_game_over', (data) => {
        console.log('Game over for player:', data.username);
        // Handle game over logic
    });

    // IMPOSTER GAME
    socket.on('imposter_ready', (data) => {
        console.log('Player ready for imposter:', data.username);
    });

    socket.on('imposter_task_complete', (data) => {
        const gameState = imposterGames.get(data.roomID);
        if (!gameState) return;

        const player = gameState.players.find(p => p.username === data.username);
        if (player) {
            player.completedTasks++;

            // Check if all tasks are completed
            const totalTasks = gameState.players
                .filter(p => p.role === 'crewmate')
                .reduce((sum, p) => sum + p.completedTasks, 0);

            const requiredTasks = gameState.players.filter(p => p.role === 'crewmate').length * 3;

            if (totalTasks >= requiredTasks) {
                gameState.gameState = 'gameover';
                io.to(`lobby_${data.roomID}`).emit('imposter_game_over', {
                    winners: 'crewmates',
                    reason: 'All tasks completed'
                });
            }

            io.to(`lobby_${data.roomID}`).emit('imposter_tasks', gameState.players.map(p => ({
                username: p.username,
                completedTasks: p.completedTasks
            })));
        }
    });

    socket.on('imposter_report', (data) => {
        const gameState = imposterGames.get(data.roomID);
        if (!gameState) return;

        gameState.gameState = 'discussion';
        gameState.votes = {};

        io.to(`lobby_${data.roomID}`).emit('imposter_game_state', {
            state: 'discussion',
            players: gameState.players
        });
    });

    socket.on('imposter_chat_send', (data) => {
        socket.to(data.roomID).emit('imposter_chat', data.message);
    });

    socket.on('imposter_vote', (data) => {
        const gameState = imposterGames.get(data.roomID);
        if (!gameState) return;

        gameState.votes[data.username] = data.votedFor;

        io.to(`lobby_${data.roomID}`).emit('imposter_votes', gameState.votes);

        // Check if all players have voted
        const alivePlayers = gameState.players.filter(p => p.isAlive).length;
        if (Object.keys(gameState.votes).length >= alivePlayers) {
            // Process votes
            const voteCounts = {};
            Object.values(gameState.votes).forEach(votedFor => {
                voteCounts[votedFor] = (voteCounts[votedFor] || 0) + 1;
            });

            const maxVotes = Math.max(...Object.values(voteCounts));
            const ejected = Object.keys(voteCounts).find(player => voteCounts[player] === maxVotes);

            if (ejected) {
                const ejectedPlayer = gameState.players.find(p => p.username === ejected);
                if (ejectedPlayer) {
                    ejectedPlayer.isAlive = false;

                    // Check win conditions
                    const aliveImposters = gameState.players.filter(p => p.role === 'imposter' && p.isAlive).length;
                    const aliveCrewmates = gameState.players.filter(p => p.role === 'crewmate' && p.isAlive).length;

                    if (aliveImposters === 0) {
                        gameState.gameState = 'gameover';
                        io.to(`lobby_${data.roomID}`).emit('imposter_game_over', {
                            winners: 'crewmates',
                            reason: 'All imposters eliminated'
                        });
                    } else if (aliveImposters >= aliveCrewmates) {
                        gameState.gameState = 'gameover';
                        io.to(`lobby_${data.roomID}`).emit('imposter_game_over', {
                            winners: 'imposters',
                            reason: 'Imposters outnumber crewmates'
                        });
                    } else {
                        gameState.gameState = 'tasks';
                    }
                }
            }

            gameState.votes = {};
        }
    });

    socket.on('imposter_kill', (data) => {
        const gameState = imposterGames.get(data.roomID);
        if (!gameState) return;

        const killer = gameState.players.find(p => p.username === data.killer);
        const target = gameState.players.find(p => p.username === data.target);

        if (killer && target && killer.role === 'imposter' && target.isAlive) {
            target.isAlive = false;

            // Check win conditions
            const aliveImposters = gameState.players.filter(p => p.role === 'imposter' && p.isAlive).length;
            const aliveCrewmates = gameState.players.filter(p => p.role === 'crewmate' && p.isAlive).length;

            if (aliveImposters === 0) {
                gameState.gameState = 'gameover';
                io.to(`lobby_${data.roomID}`).emit('imposter_game_over', {
                    winners: 'crewmates',
                    reason: 'All imposters eliminated'
                });
            } else if (aliveImposters >= aliveCrewmates) {
                gameState.gameState = 'gameover';
                io.to(`lobby_${data.roomID}`).emit('imposter_game_over', {
                    winners: 'imposters',
                    reason: 'Imposters outnumber crewmates'
                });
            }

            io.to(`lobby_${data.roomID}`).emit('imposter_game_state', {
                state: gameState.gameState,
                players: gameState.players
            });
        }
    });

    socket.on('imposter_submit_clue', (data) => {
        const gameState = imposterGames.get(data.lobbyId);
        if (!gameState || gameState.gameState !== 'clue_submission') return;

        const player = gameState.players.find(p => p.username === socket.username);
        if (!player || !player.isAlive || player.hasSubmittedClue) return;

        // Validate clue (not empty and reasonable length)
        const clue = data.clue.trim();
        if (clue.length === 0 || clue.length > 50) {
            socket.emit('imposter_error', { message: 'Clue must be between 1 and 50 characters' });
            return;
        }

        player.clue = clue;
        player.hasSubmittedClue = true;

        console.log(`Player ${player.username} submitted clue: "${clue}"`);

        // Notify everyone
        io.to(`lobby_${data.lobbyId}`).emit('imposter_player_submitted', {
            username: player.username
        });

        // Check if all players have submitted clues
        const allSubmitted = gameState.players
            .filter(p => p.isAlive)
            .every(p => p.hasSubmittedClue);

        if (allSubmitted) {
            startDiscussionPhase(data.lobbyId);
        } else {
            broadcastImposterGameState(data.lobbyId);
        }
    });

    socket.on('imposter_submit_vote', (data) => {
        const gameState = imposterGames.get(data.lobbyId);
        if (!gameState || gameState.gameState !== 'voting') return;

        const player = gameState.players.find(p => p.username === socket.username);
        if (!player || !player.isAlive) return;

        const validPlayers = gameState.players.filter(p => p.isAlive).map(p => p.username);
        validPlayers.push('skip');

        if (!validPlayers.includes(data.votedFor)) {
            socket.emit('imposter_error', { message: 'Invalid vote' });
            return;
        }

        gameState.votes[player.username] = data.votedFor;
        player.vote = data.votedFor;

        console.log(`Player ${player.username} voted for: ${data.votedFor}`);

        // Notify everyone
        io.to(`lobby_${data.lobbyId}`).emit('imposter_player_voted', {
            username: player.username
        });

        // Check if all players have voted
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        if (Object.keys(gameState.votes).length >= alivePlayers.length) {
            processVotes(data.lobbyId);
        } else {
            broadcastImposterGameState(data.lobbyId);
        }
    });

    socket.on('imposter_send_chat', (data) => {
        const gameState = imposterGames.get(data.lobbyId);
        if (!gameState || !gameState.isActive) return;

        const player = gameState.players.find(p => p.username === socket.username);
        if (!player || !player.isAlive) return;

        // Validate chat message
        const message = data.message.trim();
        if (message.length === 0 || message.length > 200) {
            socket.emit('imposter_error', { message: 'Message must be between 1 and 200 characters' });
            return;
        }

        const chatMessage = {
            username: player.username,
            message: message,
            timestamp: Date.now(),
            round: gameState.currentRound
        };

        gameState.chat.push(chatMessage);

        // Broadcast to all players
        io.to(`lobby_${data.lobbyId}`).emit('imposter_chat_message', chatMessage);

        console.log(`${player.username}: ${message}`);
    });

    socket.on('join_game_lobby', async (lobbyId) => {
        try {
            console.log(`User ${socket.username} joining game lobby ${lobbyId}`);
            const lobby = await GameLobbyModel.findById(lobbyId);

            if (lobby) {
                // Update player's socket ID in lobby
                const player = lobby.players.find(p => p.username === socket.username);
                if (player) {
                    player.socketId = socket.id;
                    await lobby.save();
                } else {
                    // If player isn't in the lobby yet, add them
                    lobby.players.push({
                        username: socket.username,
                        socketId: socket.id,
                        joinedAt: new Date()
                    });
                    await lobby.save();

                    // Broadcast the updated player list
                    io.to(`lobby_${lobbyId}`).emit('lobby_players_updated', {
                        players: lobby.players,
                        playerCount: lobby.players.length
                    });
                }

                socket.join(`lobby_${lobbyId}`);
                const activeImposterGame = imposterGames.get(lobbyId);
                if (activeImposterGame && activeImposterGame.isActive) {
                    let player = activeImposterGame.players.find(p => p.username === socket.username);
                    if (!player) {

                        player = {
                            username: socket.username,
                            socketId: socket.id,
                            isAlive: true,
                            role: 'crewmate',
                            hasSubmittedClue: false,
                            clue: '',
                            vote: null
                        };
                        activeImposterGame.players.push(player);
                        console.log(`Added late joiner ${socket.username} to Imposter game ${lobbyId}`);
                    } else {
                        player.socketId = socket.id;
                    }

                    const playerInfo = {
                        lobbyId,
                        players: activeImposterGame.players.map(p => ({ username: p.username, role: p.role })),
                        theme: activeImposterGame.theme,
                        currentRound: activeImposterGame.currentRound,
                        gameState: activeImposterGame.gameState
                    };
                    if (player.role === 'imposter') {
                        playerInfo.yourRole = 'imposter';
                        playerInfo.message = `You are the IMPOSTER! The theme is: ${activeImposterGame.theme}. 
                        Try to blend in by guessing what the secret word might be based on other players' clues.`;
                    } else {
                        playerInfo.yourRole = 'crewmate';
                        playerInfo.secretWord = activeImposterGame.secretWord;
                        playerInfo.message = `You are a CREWMATE! The secret word is: ${activeImposterGame.secretWord}. 
                        Give subtle clues without revealing the word directly.`;
                    }
                    console.log(`Emitting to ${socket.username} (socket ${socket.id}):`, playerInfo);
                    socket.emit('imposter_game_start_word', playerInfo);
                    // Emit current game state
                    const publicGameState = {
                        gameState: activeImposterGame.gameState,
                        currentRound: activeImposterGame.currentRound,
                        maxRounds: activeImposterGame.maxRounds,
                        players: activeImposterGame.players.map(p => ({
                            username: p.username,
                            isAlive: p.isAlive,
                            hasSubmittedClue: p.hasSubmittedClue,
                            role: p.role
                        })),
                        timeLeft: activeImposterGame.roundTimer
                    };
                    socket.emit('imposter_game_state_word', publicGameState);
                    console.log(`Sent Imposter data to ${socket.username}`);
                }

                console.log(`User ${socket.username} joined game lobby ${lobbyId}`);

                // Send current lobby state to the joining player
                socket.emit('lobby_state_update', lobby);
            }
        } catch (err) {
            console.error("Error joining game lobby:", err);
        }
    });

    socket.on('request_player_info', async (data) => {
        console.log('Requesting player info for:', socket.username, 'lobby:', data.lobbyId);

        const gameState = imposterGames.get(data.lobbyId);
        if (!gameState || !gameState.isActive) {
            console.log('No active game found for lobby:', data.lobbyId);
            return;
        }

        const player = gameState.players.find(p => p.username === socket.username);
        if (!player) {
            console.log('Player not found in game:', socket.username);
            return;
        }

        const playerInfo = {
            lobbyId: data.lobbyId,
            players: gameState.players.map(p => ({
                username: p.username,
                role: p.role,
                isAlive: p.isAlive
            })),
            theme: gameState.theme,
            currentRound: gameState.currentRound,
            gameState: gameState.gameState,
            yourRole: player.role,
            message: player.role === 'imposter'
                ? `You are the IMPOSTER! The theme is: ${gameState.theme}. Try to blend in.`
                : `You are a CREWMATE! The secret word is: ${gameState.secretWord}. Give subtle clues.`
        };

        if (player.role === 'crewmate') {
            playerInfo.secretWord = gameState.secretWord;
        }

        console.log(`Sending player info to ${socket.username}:`, {
            role: playerInfo.yourRole,
            hasSecretWord: !!playerInfo.secretWord
        });

        socket.emit('imposter_game_start_word', playerInfo);
    });


    // Add a new event to request lobby state
    socket.on('request_lobby_state', async (lobbyId) => {
        try {
            const lobby = await GameLobbyModel.findById(lobbyId);
            if (lobby) {
                socket.emit('lobby_state_update', lobby);
            }
        } catch (err) {
            console.error("Error sending lobby state:", err);
        }
    });

    socket.on('disconnect', () => {
        // console.log("User Disconnected")
        onlineUsers.delete(socket.userId)

        io.emit('onlineUsers', Array.from(onlineUsers.values()))
    });
})

// Add this function to clean up old lobbies
async function cleanupOldLobbies() {
    try {
        const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000); // 20 minutes ago

        const oldLobbies = await GameLobbyModel.find({
            $or: [
                { status: 'finished' },
                { createdAt: { $lt: twentyMinutesAgo } }
            ]
        });

        for (const lobby of oldLobbies) {
            console.log('Clean up old lobby:', lobby._id);
            await GameLobbyModel.findByIdAndDelete(lobby._id);
            activeLobbies.delete(lobby.roomId.toString());
        }

        console.log(`Cleaned up ${oldLobbies.length} old lobbies`);
    } catch (err) {
        console.error('Error cleaning up old lobbies:', err);
    }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldLobbies, 60 * 10 * 1000);

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`)
})





// app.delete('/admin/clear-all-users', async (req, res) => {
//     try {
//         const result = await UserModel.deleteMany({});
//         res.status(200).json({
//             message: `Successfully cleared ${result.countDocuments()} users from the database.`
//         });
//
//     } catch (err) {
//         console.error("Error clearing database:", err);
//         res.status(500).json({ message: 'Failed to clear all users.' });
//     }
// });
//
// app.delete('/admin/clear-all-rooms', async (req, res) => {
//     try {
//         const result = await ChatRoomModel.findByIdAndDelete({});
//         res.status(200).json({
//             message: `Successfully cleared ${result.countDocuments()} users from the database.`
//         });
//
//     } catch (err) {
//         console.error("Error clearing database:", err);
//         res.status(500).json({ message: 'Failed to clear all users.' });
//     }
// });

// app.delete('/admin/clear-all-messages', async (req, res) => {
//     try {
//         const result = await MessagesModel.deleteMany({});
//
//         res.status(200).json({
//             message: `Successfully cleared ${result.countDocuments()} users from the database.`
//         });
//
//     } catch (err) {
//         console.error("Error clearing database:", err);
//         res.status(500).json({ message: 'Failed to clear all users.' });
//     }
// });
