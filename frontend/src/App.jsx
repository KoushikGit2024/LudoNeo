// import { useState } from 'react'
import { Route, Routes } from 'react-router-dom'

//-------Pages-------
import Home from './pages/Home'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import Session from './pages/Session'
import ElectricBorder from './components/customComponents/ElectricBorder'
import Options from './pages/Options'
import { ToastContainer } from 'react-toastify'
import "react-toastify/dist/ReactToastify.css";
import {useEffect} from 'react'
import api from './api/axiosConfig'
import { updateUserInfo } from './store/userActions'
import GameSetup from './components/sharedBoardComponents/GameSetup'
// import LudoOffline from './components/LudoOffline'
// import LudoGame from './assets/New'
//---------------------------------------
const getUser = async () => {
  const res =await api.get("/api/auth/me");
  // console.log(res.data);
  updateUserInfo(res.data.user);
}

function App() {

  useEffect(()=>{
    getUser();
  }, []);

  return (
    <main className='bg-[#000000] flex flex-col items-center justify-center p-0 m-0 w-screen h-screen md:overflow-hidden'>
      {/* <div className='min-h-full bg-amber-300 min-w-full'> */}
        <Routes>
          <Route path='/' element={<GameSetup/>}/>
          <Route path='/profile' element={<Profile/>}/>
          <Route path='/dashboard' element={<Dashboard/>}/>
          <Route path='/session/:boardType' element={<Session/>}/>
          <Route path='/options/:subOption' element={<Options/>}/>
        </Routes>  
        
      {/* </div> */}
    </main>
  )
}

export default App
