import {Link} from "react-router-dom";
import {useNavigate} from "react-router-dom";
import {useAuth} from "../AuthContext.jsx";
import {disconnectSocket} from "../socket.jsx";

const NavBar = () => {
    const {user, setUser, activeSocket} = useAuth();
    const navigate = useNavigate();

    // Logout
    const handleLogout = async () => {
        console.log('Logged out');

        if(activeSocket){
            disconnectSocket();
        }

        try{
            setUser(null);
            navigate('/');
        }catch (err){
            setUser(null);
            navigate('/');
        }
    };

    return (
        <div>
            <nav className={'w-full h-14 bg-black border-b border-gray-600'}>
                <ul className={'flex flex-row gap-6 justify-center text-white font-black h-14'}>
                    <div className={'absolute left-4 h-14 content-center'}>
                        <p>Game Center</p>
                    </div>
                    <li className={'content-center'}><Link to={'/'}>Home</Link></li>
                    <li className={'content-center'}><Link to={'/games'}>Games</Link></li>
                    <li className={'content-center'}><Link to={'/lobby'}>Lobby</Link></li>
                    {/*User not logged in*/}
                    {!user ? (
                        <div className={'absolute right-4 h-14 content-center'}>
                            <a href={'/login'} className={'rounded-full text-xs pl-2.5 pr-2.5 pt-1 pb-1'}>LogIn</a>
                            <a href={'/register'}
                               className={'bg-gray-800 rounded-full pl-2.5 pr-2.5 pt-1 pb-1 text-xs'}>SignUp</a>
                        </div>
                    ) : ( /*User logs in, display their username*/
                        <div className={'absolute right-4 h-14 content-center'}>
                            <span>Welcome, {user.username}</span>
                            <button onClick={handleLogout}
                               className={'bg-gray-800 rounded-full pl-2.5 pr-2.5 pt-1 pb-1 text-xs'}>Sign Out</button>
                        </div>
                    )}
                </ul>
            </nav>
        </div>
    )
}

export default NavBar;




