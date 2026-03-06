// // import { useState } from 'react'
// import { Route, Routes } from 'react-router-dom'

// //-------Pages-------
// import Home from './pages/Home'
// // import Profile from './pages/Profile'
// import Dashboard from './pages/Dashboard'
// import Session from './pages/Session'
// import ElectricBorder from './components/customComponents/ElectricBorder'
// import Options from './pages/Options'
// import { ToastContainer } from 'react-toastify'
// import "react-toastify/dist/ReactToastify.css";
// import {useEffect} from 'react'
// import api from './api/axiosConfig'
// import { updateUserInfo } from './store/userActions'
// import GameSetup from './components/sharedBoardComponents/GameSetup'
// // import LudoOffline from './components/LudoOffline'
// // import LudoGame from './assets/New'
// //---------------------------------------
// const getUser = async () => {
//   const res =await api.get("/api/auth/me");
//   // console.log(res.data);
//   updateUserInfo(res.data.user);
// }

// function App() {

//   useEffect(()=>{
//     getUser();
//   }, []);

//   return (
//     <main className='bg-[#000000] flex flex-col items-center justify-center p-0 m-0 w-screen h-screen md:overflow-hidden'>
//       {/* <div className='min-h-full bg-amber-300 min-w-full'> */}
//         <Routes>
//           <Route path='/' element={<GameSetup/>}/>
//           {/* <Route path='/profile' element={<Profile/>}/> */}
//           <Route path='/dashboard' element={<Dashboard/>}/>
//           <Route path='/session/:boardType' element={<Session/>}/>
//           <Route path='/options/:subOption' element={<Options/>}/>
//         </Routes>  
        
//       {/* </div> */}
//     </main>
//   )
// }

// export default App
import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";

//------- Pages & Components -------
import Dashboard from './pages/Dashboard';
import Session from './pages/Session';
import Options from './pages/Options';
import GameSetup from './pages/GameSetup';
import api from './api/axiosConfig';
import { updateUserInfo } from './store/userActions';
// import GameSetup from './pages/GameSetup';
// Authentication Logic
const getUser = async () => {
  try {
    const res = await api.get("/api/auth/me");
    if (res.data?.user) {
      updateUserInfo(res.data.user);
    }
  } catch (err) {
    console.error("Auth sync failed or no active session.");
  }
};

/**
 * ROOT LAYOUT
 * This component wraps all routes. 
 * It handles the global styles, Toast notifications, and initial Auth check.
 */
const RootLayout = () => {
  useEffect(() => {
    getUser();
  }, []);

  return (
    <main className='bg-[#000000] flex flex-col items-center justify-center p-0 m-0 w-screen h-screen md:overflow-hidden relative'>
      {/* All matched child routes render here */}
      <Outlet /> 

      {/* Global Toast Notifications */}
      <ToastContainer 
        position="bottom-right"
        theme="dark"
        autoClose={3000}
        hideProgressBar={false}
      />
    </main>
  );
};

// Define the Data Router
const router = createBrowserRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      {
        index: true,
        element: <Dashboard />, // Changed to Dashboard so '/' doesn't crash GameSetup
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        // 1. ADDED THIS NEW ROUTE! Now GameSetup gets the :boardType param
        path: "setup/:boardType", 
        element: <GameSetup />, 
      },
      {
        path: "session/:boardType",
        element: <Session />,
      },
      {
        path: "options/:subOption",
        element: <Options />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;