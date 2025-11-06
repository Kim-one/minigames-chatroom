import {useState} from "react";
import {useNavigate} from "react-router-dom";
import api from "../api.js";

const CreateChatroom=()=>{
    const [chatroomName, setChatroomName] = useState('');
    const [description, setDescription] = useState('');
    const [isPrivate, setIsPrivate] = useState(false);
    const navigate = useNavigate();
    const [users, setUsers]= useState([]);
    const [selectedUsers, setSelectedUsers] = useState([])

    async function handleSubmit(e) {
        e.preventDefault();
        const token = localStorage.getItem('token');

        if (!token) {
            // Check if token exists before trying to use it in the header
            alert("You must be logged in to create a chatroom.");
            return;
        }

        await api.post('/create-chatroom', {
            chatroomName,
            description,
            isPrivate,
            invitedUsers: selectedUsers
        },
            {headers: { Authorization: `Bearer ${token}`}}
            );

        navigate('/lobby')
    }

    const fetchUsers = async (token)=>{
        try{
            const usersRes = await  api.get('/users', {
                headers: {Authorization: `Bearer ${token}`}
            });
            setUsers(usersRes.data);
        } catch (err){
            console.log("Error fetching users")
        }
    }

    const handlePrivateClick = async ()=>{
        setIsPrivate(true);
        const token = localStorage.getItem('token');
        if(token){
            await fetchUsers(token)
        }else{
            alert("Please login to create private chatroom")
        }
    }

    const toggleUserSelection = (username)=>{
        setSelectedUsers(prevSelected=>
            prevSelected.includes(username)
                ? prevSelected.filter(user => user !== username)
                : [...prevSelected,username]
        );
    };

    return(
        <div className={'flex flex-col h-screen w-full absolute inset-0'}>
            <div className={'flex flex-1 bg-black items-center justify-center relative'}>
                <div className={'w-5/12 h-3/4 relative flex flex-col gap-6 items-center justify-center'}>
                    <div className={'flex flex-col gap-1 items-center  relative'}>
                        <p className={'text-white text-3xl font-bold'}>Create a New Chatroom</p>
                        <p className={'text-gray-700 font-semibold'}>Let's Build a space for you and your friends to hang out.</p>
                    </div>
                    <form onSubmit={handleSubmit} className={'flex flex-col gap-6 border border-solid border-gray-700 rounded-3xl p-8'}>
                        <input name={'chatroomName'} value={chatroomName}
                               onChange={(e)=>setChatroomName(e.target.value)}
                               className={'bg-gray-950 text-gray-500 border border-solid border-gray-700 w-96 rounded-md pb-1 pt-1 pl-2 focus:outline-none placeholder-gray-500'} placeholder={'Chatroom Name'}/>
                        <textarea placeholder={'Description'} name={'description'} value={description} onChange={(e)=>setDescription(e.target.value)}
                            className={'bg-gray-950 text-gray-500 border border-solid border-gray-700 focus:outline-none w-96 pb-20 pt-1 pl-2 pr-2 rounded-md resize-none overflow-y-auto no-scrollbar placeholder-gray-500'}></textarea>
                        <div className={'flex flex-row gap-3'}>
                            <button type={'button'} onClick={()=>{setIsPrivate(false);setSelectedUsers([]);setUsers([])}}
                                    className={'flex-auto bg-blue-400 text-blue-800 border-gray-500 border pt-2 pb-2 pl-4 pr-4 rounded'}>Public</button>
                            <button type={'button'} onClick={handlePrivateClick}
                                    className={'flex-auto bg-black text-white border-gray-500 border pt-2 pb-2 pl-4 pr-4 rounded'}>Private</button>
                        </div>
                        {isPrivate && users.length > 0&&(
                            <div className={'text-white border border-gray-700'}>
                                <h3 className={'text-center'}>Add users</h3>
                                {users.map((user)=>(
                                    <div key={user.username} className={'flex flex-row gap-1'}>
                                        <input type={'checkbox'}
                                               className={'focus:ring-blue-500'}
                                               checked={selectedUsers.includes(user.username)}
                                               onChange={()=>toggleUserSelection(user.username)}/>
                                        <p className={selectedUsers.includes(user.username)?'font-bold':''}>{user.username}</p>

                                    </div>
                                ))}
                                {/*<p className={'text-sm mt-3 text-gray-400'}>*/}
                                {/*    Selected: {selectedUsers.length} users */}
                                {/*</p>*/}
                            </div>
                        )}
                        <button className={'text-white font-semibold rounded-full bg-blue-500 pt-2 pb-2'} type={'submit'}>
                            Create Chatroom
                        </button>
                        <button className={'text-white font-semibold rounded-full bg-gray-400 pt-2 pb-2'} type={'button'} onClick={()=>navigate('/lobby')}>Cancel</button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default CreateChatroom;