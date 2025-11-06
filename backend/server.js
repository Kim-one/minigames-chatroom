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
const http = require('http');
const server = http.createServer(app)
const { verifyToken } = require('./verifyToken');
const validator = require('validator');

app.use(cors())
dotenv.config()
const io = new Server(server, {
    cors: {
        origin: 'http://localhost:5173',
        methods: ["POST", "GET"]
    }
})
io.sockets.setMaxListeners(50);

app.use(express.json())

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.log("Error Connecting to DB: ", err))

app.get('/users', async (req, res) => {
    try {
        const users = await UserModel.find({});

        return res.status(200).json(users)
    } catch (err) {
        res.status(500).json({ message: "Error fetching users" })
    }

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

const onlineUsers = new Map()

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
app.get('/rooms', async (req, res) => {
    try {
        const rooms = await ChatRoomModel.find({ isPrivate: false });

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

})

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    console.log(`Socket auth attempt: token=${token ? 'present' : 'missing'}`);
    if (!token) {
        console.log('Socket auth failed: No token provided');
        return next(new Error('Authentication error: No token'));
    }
    try {
        const decoded = jwt.verify(token, process.env.SECRET_KEY)
        socket.userId = decoded.id;
        socket.username = decoded.username
        // socket.user = decoded;
        next()
    } catch (err) {
        next(new Error('Invalid Token'));
    }
})

io.on('connection', (socket) => {
    console.log(`User Connected ${socket.id}, ${socket.username}`);

    socket.on('join_room', (roomID) => {
        socket.join(roomID);
        console.log(`User ${socket.id} joined room ${roomID}`);
    });

    // onlineUsers.set(socket.userId, {username: socket.username, socketId: socket.id})
    // io.emit('onlineUsers', Array.from(onlineUsers.values()))

    io.on('connection', (socket) => {
        onlineUsers.set(socket.userId, { username: socket.username, socketId: socket.id })
        io.emit('onlineUsers', Array.from(onlineUsers.values()))
    });

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

    socket.on('disconnect', () => {
        // console.log("User Disconnected")
        onlineUsers.delete(socket.userId)

        io.emit('onlineUsers', Array.from(onlineUsers.values()))
    });
})




const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
    console.log(`Server is running at ${PORT}`)
})


