const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
    chatroomName:{
        type: String,
        required: true,
        unique: true,
        index:true
    },
    description:{
        type:String,
        required: true
    },
    isPrivate:{
        type: Boolean,
        default: false
    },
    joinCode:{
        type:String,
        default: null
    },
    owner:{
        type: String,
        ref: 'User',
        required: true
    },
    members:[{
        type: String,
        ref: 'User'
    }],
    invitedUsers:[{
        type: String,
        ref:'User'
    }],
}, {timestamps:true});

module.exports = mongoose.model("ChatRoom", ChatSchema);