import {useState} from "react";
import {API_URL} from '../api.js';

const Home = () => {
    const [url, setUrl] = useState(null);

    // async function clearAllUserData()  {
    //     try {
    //         const response = await axios.delete('http://localhost:5005/admin/clear-all-users');
    //
    //         // Log the success message
    //         alert(response.data.message);
    //     } catch (err) {
    //         console.error("Database Clear Failed:", err.response?.data?.message || err.message);
    //         alert("Database Clear FAILED: " + (err.response?.data?.message || "Check console for details."));
    //     }
    // }

    // async function clearAllChatroomsData()  {
    //     try {
    //         const response = await axios.delete('http://localhost:5005/admin/clear-all-rooms');
    //         if (!window.confirm("ARE YOU SURE? This will permanently delete ALL rooms!")) {
    //             return;
    //         }
    //         // Log the success message
    //         alert(response.data.message);
    //     } catch (err) {
    //         console.error("Database Clear Failed:", err.response?.data?.message || err.message);
    //         alert("Database Clear FAILED: " + (err.response?.data?.message || "Check console for details."));
    //     }
    // }

    // async function clearAllMessageData()  {
    //     try {
    //         const response = await axios.delete('http://localhost:5005/admin/clear-all-messages');
    //         if (!window.confirm("ARE YOU SURE? This will permanently delete ALL rooms!")) {
    //             return;
    //         }
    //         // Log the success message
    //         alert(response.data.message);
    //     } catch (err) {
    //         console.error("Database Clear Failed:", err.response?.data?.message || err.message);
    //         alert("Database Clear FAILED: " + (err.response?.data?.message || "Check console for details."));
    //     }
    // }

    return (
        <div className={'bg-black text-white flex justify-center items-center h-[calc(100vh-3.5rem)]'}>
            <button onClick={()=>setUrl(API_URL)}>Click me</button>
            <p className={'text-white'}>{url}</p>
            {/*<div className={'justify-center items-center'}>*/}
                {/*<button onClick={clearAllUserData}>Wipe Database (DEV ONLY)</button>*/}
                {/*<button onClick={clearAllChatroomsData}>Wipe Database</button>*/}
                {/*<button onClick={clearAllMessageData}>Wipe Database</button>*/}
            {/*</div>*/}
        </div>
    )
}

export default Home;