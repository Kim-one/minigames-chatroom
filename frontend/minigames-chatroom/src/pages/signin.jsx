import {useNavigate} from "react-router-dom";
import {useState} from "react";
import {useAuth} from "../AuthContext.jsx";
import api from "../api.js";

const SignIn = () =>{
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const {setUser} = useAuth();
    const characters = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
    const charactersLength = characters.length;

    function handleGuestLogin(e){
        e.preventDefault()
        generateRandomUsername(charactersLength)
        
        // navigate('/lobby');
    }

    function generateRandomUsername(length){
        let tempUsername = ''
        for(let i = 0; i < charactersLength; i++){
            tempUsername += characters.charAt(Math.floor(Math.random() * length));
        }

        return tempUsername
    }

     async function handleSubmit(e){
        e.preventDefault();
        console.log(`You entered ${username}, and ${password}.`);
        try{
            const response = await api.post('/login',{
                username,
                password
            })

            const {token,user:userData} = response.data;
            localStorage.setItem('token', token);
            setUser(userData)
            navigate('/lobby');
        } catch (err){
            console.log("Login Error: ", err);
        }
    }

    return (
        <div className={'w-full h-[calc(100vh-3.5rem)] flex flex-col text-white'}>
            <div className={'flex-1 flex min-h-0 relative bg-black items-center justify-center'}>
                <div className={'relative flex flex-col gap-2 w-96 h-96 border border-solid border-gray-600 rounded-3xl'}>
                    <div>
                        <p className={'text-center relative text-2xl font-black'}>Welcome Back!</p>
                        <p className={'text-center text-gray-600'}>Log in to continue your adventure.</p>
                    </div>
                    <div>
                        <form onSubmit={handleSubmit} className={'relative flex flex-col ml-6 mr-6 gap-2'}>
                            <label>Username</label>
                            <input type={'text'} placeholder={'Enter your username.'} value={username} name={"username"}
                                   className={'pl-2 pt-1 pb-1 border border-solid border-gray-600 rounded-lg bg-black focus:outline-0'}
                                   onChange={(e)=>setUsername(e.target.value)}/>
                            <label>Password</label>
                            <input type={'password'} placeholder={'Enter your password.'} value={password} name={"password"}
                                   className={'pl-2 pt-1 pb-1 border border-solid border-gray-600 rounded-lg bg-black focus:outline-0'}
                                   onChange={(e)=>setPassword(e.target.value)}/>
                            <button type={"submit"} className={'bg-blue-500 rounded-full w-full pt-2 pb-2 font-medium'}>Login</button>
                        </form>
                    </div>
                    <div className={'flex flex-row gap-2 items-center ml-6 mr-6'}>
                        <div className={'w-40 h-0 border border-solid border-gray-600'}></div>
                        <span>OR</span>
                        <div className={'w-40 h-0 border border-solid border-gray-600'}></div>
                    </div>
                    <div className={'ml-6 mr-6'}>
                        <button className={'relative border border-solid border-gray-600 rounded-full w-full pb-2 pt-2'}
                                onClick={handleGuestLogin}>Continue as guest</button>
                    </div>
                    <div>
                        <p className={'text-gray-600 text-center'}>Don't have an account?
                            <a href={'/register'} className={'text-blue-600'}> Sign Up</a>
                        </p>
                    </div>
                </div>
            </div>

        </div>
    )
}

export default SignIn;