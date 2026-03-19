import React, { useEffect } from 'react';
import { createBrowserRouter, RouterProvider, Outlet, Link } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";

//------- Pages & Components -------
import Dashboard from './pages/Dashboard';
import Session from './pages/Session';
import Options from './pages/Options';
import GameSetup from './pages/GameSetup';
import api from './api/axiosConfig';
import { updateUserInfo } from './store/userActions';

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
 * LUDONEO 404 COMPONENT
 * Styled to match the dark, glowing aesthetic of the app.
 */
// import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    // Added font-mono for that classic terminal/fallout feel
    <div className="flex flex-col items-center justify-center space-y-6 text-center z-10 p-6 font-mono">
      
      {/* Toxic Green / Radioactive Neon Text */}
      <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 drop-shadow-[0_0_25px_rgba(16,185,129,0.7)]">
        404
      </h1>
      
      {/* System Warning Subheading */}
      <h2 className="text-2xl font-semibold tracking-[0.2em] text-emerald-50 uppercase border-b border-emerald-500/30 pb-2">
        OUT OF BOUNDS
      </h2>
      
      {/* Glitch/Terminal Themed Paragraph */}
      <p className="text-emerald-400/80 max-w-sm text-sm leading-relaxed">
        The page you are looking for does not exist.  
      </p>
      
      {/* Cyberpunk/Terminal Return Button */}
      <Link 
        to="/" 
        className="mt-6 px-8 py-3 rounded-sm text-sm font-bold tracking-widest text-emerald-400 border border-emerald-500/50 bg-emerald-900/10 backdrop-blur-sm transition-all duration-300 hover:bg-emerald-500/20 hover:text-emerald-300 hover:shadow-[0_0_20px_rgba(16,185,129,0.5)] hover:-translate-y-1"
      >
        {"[ RETURN TO DASHBOARD ]"}
      </Link>
    </div>
  );
};

/**
 * ROOT LAYOUT
 */
const RootLayout = () => {
  useEffect(() => {
    getUser();
  }, []);

  return (
    <main className='bg-[#000000] flex flex-col items-center justify-center p-0 m-0 w-screen h-screen md:overflow-hidden relative'>
      <Outlet /> 

      <div className="fixed z-[99999]">
        <ToastContainer 
           position="top-right" 
           autoClose={3000} 
           theme="dark" 
           toastClassName="!bg-[#0a0a0f] !text-white !border !border-white/10 !shadow-2xl" 
        />
      </div>
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
        element: <Dashboard />, 
      },
      {
        path: "dashboard",
        element: <Dashboard />,
      },
      {
        path: "setup/:boardType", 
        element: <GameSetup />, 
      },
      {
        path: "session/:boardType",
        element: <Session />,
      },
      {
        path: "session/:boardType/:gameId",
        element: <Session />,
      },
      {
        path: "options/:subOption",
        element: <Options />,
      },
      // ✅ FALLOUT ROUTE: Catches anything that doesn't match above
      {
        path: "*",
        element: <NotFound />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;