import {useEffect, useState, useRef} from "react";
import {HiPlusSm} from "react-icons/hi";
import {IoIosSearch} from "react-icons/io";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../AuthContext.jsx";
import api from '../api.js';

const GameLobby =()=>{
    // const [users, setUsers] = useState([]);
    const [chatrooms, setChatrooms] = useState([]);
    const [loading, setLoading] = useState(null)
    const navigate = useNavigate();
    const [onlineUsers, setOnlineUsers] = useState([]);
    const token = localStorage.getItem('token');
    const {activeSocket} = useAuth();
    const hasFetchedRooms = useRef(false)

    useEffect(() => {
        if(!activeSocket){
            return
        }

        activeSocket.on('onlineUsers',(users)=>{
            setOnlineUsers(users)
        })

        activeSocket.on('request_online_users',(users)=>{
            setOnlineUsers(users)
        })

        activeSocket.emit('request_online_users');

        return ()=>{
            activeSocket.off('onlineUsers')
        }
    }, [activeSocket]);

    useEffect(()=>{
        if(hasFetchedRooms.current){
            return
        }

        const fetchChatRooms = async()=>{
            try{
                const response = await api.get('/rooms',{
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });
                setChatrooms(response.data)
                setLoading(false)
                hasFetchedRooms.current = true
            } catch(err){
                console.log("Error: ", err);
            }
        }
        if(token){
            fetchChatRooms();
        }
    },[token]);

    function createChatRoom(){
        navigate('/createChatroom');
    }

    const openChat = (roomID)=>{
        navigate(`/rooms/${roomID}`)
    }

    return (
        <div className={'w-full h-[calc(100vh-3.5rem)]  flex flex-col text-white'}>
            {/* Game Lobby */}
            <div className={'bg-black flex flex-row relative flex-1 gap-6'}>
                {/*  Display Active Users - Left Column*/}
                <div className={'w-1/4 border border-blue-800'}>
                    <h1>Active users</h1>
                    <ul>
                        {onlineUsers.map((users, index)=>(
                            <div key={index} className={'flex flex-col'}>
                                <span>{users.username}</span>
                                <span className={'text-green-600 text-xs'}>Online</span>
                            </div>
                        ))}
                    </ul>
                </div>
                {/*Main Section - Right Column*/}
                <div className={'flex flex-1 flex-col p-4 space-y-4 border border-white'}>
                    {/*Top section*/}
                    <div className={'flex p-4 border border-gray-400 justify-evenly content-center items-center'}>
                        <div className={'-left-20 relative'}>
                            <p className={'text-3xl font-bold dark:text-white'}>Chat Rooms</p>
                        </div>
                        <div className={'flex flex-row relative'}>
                            <span className={'relative left-10 top-3'}><IoIosSearch className={'size-6'}/></span>
                            <input type={'text'} placeholder={'Search users or chat rooms...'}
                                   className={'bg-black border border-gray-400 rounded-full h-12 pl-12 pr-16'}/>
                        </div>
                        <div className={'relative'}>
                            <button onClick={createChatRoom} className={'bg-blue-500 rounded-full pt-2 pb-2 pl-4 pr-4 flex place-self-end items-center content-evenly'}>
                                <span><HiPlusSm className={'size-6'}/></span><p>Create New</p>
                            </button>
                        </div>
                    </div>
                    {/*Bottom section*/}
                    <div className={'flex-1  border border-gray-400 p-4 rounded shadow'}>
                        Main Content - Display Chat Rooms
                        {chatrooms.length>0 ? (
                            chatrooms.map((chats)=>(
                                <div key={chats._id} className={'w-12 text-center border-white border border-solid rounded-full'}>
                                    <p onClick={()=>openChat(chats._id)}>{chats.chatroomName}</p>
                                </div>
                            ))
                        ):(
                            <p>No chats rooms created as yet!</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default GameLobby;




