const mongoose = require('mongoose');

const MessagesModule = new mongoose.Schema({
    room:{
        type: mongoose.Schema.ObjectId,
        ref: 'ChatRoom',
        required: true
    },
    sender:{
        type:String,
        required: true
    },
    content:{
        type:String,
        required: true
    }
},{timestamps: true})

module.exports = mongoose.model("Message", MessagesModule)