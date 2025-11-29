const mongoose = require('mongoose');

const gameLobbySchema = new mongoose.Schema({
    roomId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ChatRoom',
        required: true
    },
    gameType: {
        type: String,
        required: true,
        enum: ['SpaceShooter', 'Imposter']
    },
    owner:{
        type: String,
        required: true,
    },
    players:[{
        username: String,
        socketId: String,
        joinedAt: {
            type: Date,
            default: Date.now
        }
    }],
    status: {
        type: String,
        enum: ['waiting', 'starting', 'active', 'finished'],
        default: 'waiting',
    },
    maxPlayers:{
        type: Number,
        required: true
    },
    minPlayers:{
        type: Number,
        required: true
    },
    countdownEnds: Date,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('GameLobby', gameLobbySchema);