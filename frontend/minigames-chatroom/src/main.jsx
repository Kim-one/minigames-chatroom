import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import Home from './pages/Home.jsx'
import {BrowserRouter, Route, Routes} from "react-router-dom";
import Games from "./pages/Game.jsx";
import Register from "./pages/register.jsx";
import GameLobby from "./pages/lobby.jsx";
import CreateChatroom from "./pages/createChatroom.jsx";
import SignIn from "./pages/signin.jsx";
import NavBar from "./pages/navbar.jsx";
import {AuthProvider} from "./AuthContext.jsx";
import ChatRoom from "./pages/chatRoom.jsx";

createRoot(document.getElementById('root')).render(
  <StrictMode>
      <BrowserRouter>
          <AuthProvider>
              <div className={'flex flex-col min-h-screen'}>
                  <NavBar/>
                  <main>
                      <Routes>
                          <Route path={'/'} element={<Home/>}></Route>
                          <Route path={'/games'} element={<Games/>}></Route>
                          <Route path={'/register'} element={<Register/>}></Route>
                          <Route path={'/login'} element={<SignIn/>}></Route>
                          <Route path={'/lobby'} element={<GameLobby/>}></Route>
                          <Route path={'/createChatroom'} element={<CreateChatroom/>}></Route>
                          <Route path={'/rooms/:roomID'} element={<ChatRoom/>}></Route>
                      </Routes>
                  </main>
              </div>
          </AuthProvider>
      </BrowserRouter>
  </StrictMode>,
)
