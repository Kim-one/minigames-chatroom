import Background from './Images/space_background.png';
// import {useNavigate} from "react-router-dom";

const SpaceShooter =({socket, roomID, username, goBack}) =>{
    // const navigate = useNavigate();
    return (
        <div className={'w-full h-[calc(100vh-5.5rem)] bg-center bg-no-repeat bg-cover'} style={{backgroundImage: `url(${Background})`}}>
            <p className={'text-white'} onClick={goBack}>Go Back</p>
        </div>
    )
}

export default SpaceShooter;