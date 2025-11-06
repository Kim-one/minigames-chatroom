import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from '../api.js';

const Register = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const rejex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        // alert(`You entered: ${username}, ${email}, and ${password}`);
        // console.log(`You entered ${username}, ${email}, and ${password}.`);

        if (!rejex.test(email)) {
            setError("Please enter a valid email address.")
            return;
        }

        if (password.length < 6) {
            setError("Password must be greater than 6 characters.")
            return;
        }

        try {
            const response = await api.post('/registration', {
                username,
                email,
                password
            });
            navigate('/login');
        } catch (err) {
            console.log("Error sending to backend:", err.response ? err.response.data : err.message);
            setError(err.response?.data?.message);
        }
    }

    return (
        <div className={'w-full h-[calc(100vh-3.5rem)] flex flex-col'}>
            {/*<div className={'h-14'}>NavBar</div>*/}
            {/*<Navbar/>*/}
            <div className={'flex-1 bg-black min-h-0 relative flex justify-center items-center'}>
                <div className={'w-96 border border-gray-600 border-solid rounded-3xl text-white'}>
                    <p className={'text-center font-black text-2xl'}>Welcome</p>
                    <p className={'text-center text-gray-600'}>Register Here.</p>
                    <form onSubmit={handleSubmit} className={'flex flex-col gap-2 ml-6 mr-6'}>
                        <label>Username</label>
                        <input type={'text'} placeholder={'Enter username'} value={username} name={"username"}
                            className={'pl-2 pt-1 pb-1 border border-solid border-gray-600 bg-black focus:outline-0 rounded-lg'}
                            onChange={(e) => setUsername(e.target.value)} />
                        <label>Email</label>
                        <input type={'email'} placeholder={'Enter email address'} value={email} name={"email"}
                            className={'pl-2 pt-1 pb-1 border border-solid border-gray-600 bg-black  focus:outline-0 rounded-lg'}
                            onChange={(e) => setEmail(e.target.value)} />
                        <label>Password</label>
                        <input type={'password'} placeholder={'Enter password'} value={password} name={"password"}
                            className={'pl-2 pt-1 pb-1 border border-solid border-gray-600 bg-black  focus:outline-0 rounded-lg'}
                            onChange={(e) => setPassword(e.target.value)} />
                        {error && (
                            <p className={'text-red-500 text-center'}>{error}</p>
                        )}
                        <button type={'submit'} className={'bg-blue-500 rounded-full pb-1 pt-1'}>Register</button>
                    </form>
                    <br />
                    <p className={'text-center'}>Already have an account? <a href={'/'} className={'text-blue-600'}>Sign in here</a></p>
                    <br />
                </div>
            </div>
        </div>
    )
}

export default Register;