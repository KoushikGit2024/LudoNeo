import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useShallow } from 'zustand/shallow';

import LudoOffline from '@/components/offlineBoard/LudoOffline'; // Adjust paths if necessary
import LudoOnline from '@/components/onlineBoard/LudoOnline';     // Adjust paths if necessary
import GameSetup from '@/components/sharedBoardComponents/GameSetup';

import useUserStore from '@/store/userStore';
import useGameStore from '@/store/useGameStore';

// Assuming you have a global socket instance exported from your API setup
// If you use a context, you can import { useSocket } instead.
import socket from '@/api/socket'; 
import gameActions from '@/store/gameLogic';

const Session = () => {
  const { boardType } = useParams(); // Expected: 'poi', 'pof', 'bot', 'offline', or 'online'
  const navigate = useNavigate();

  // 1. Fetch User Auth Info
  const userInfo = useUserStore(useShallow((state) => state.info));

  // 2. Fetch Game Status
  // "WAITING" = Show Setup | "RUNNING" / "FINISHED" = Show Board
  const gameStatus = useGameStore((state) => state.meta.status); 

  // 3. Determine if the mode requires networking
  const isOnlineMode = boardType === 'poi' || boardType === 'pof' || boardType === 'online';

  // --- AUTHENTICATION GUARD ---
  useEffect(() => {
    if (isOnlineMode && !userInfo?.email) {
      toast.info("Neural link requires Pilot Registration. Please sign in.", { theme: "dark" });
      navigate("/options/signin");
    } else {
      // Connect the socket when the user is verified and in the session!
      socket.connect();
    }

    // Cleanup: disconnect if they leave the Session component completely
    return () => {
      socket.disconnect();
    }
  }, [isOnlineMode, userInfo, navigate]);
  useEffect(()=>{
    return () => {
      gameActions.resetStore();
    }
  },[])

  // --- RENDER ROUTING ---

  // State 1: Game hasn't been initialized yet. Show the setup screen.
  if (gameStatus === "WAITING") {
    return (
      <div className='bg-[#020205] h-screen w-screen flex items-center justify-center overflow-hidden'>
        <GameSetup info={userInfo} />
      </div>
    );
  }

  // State 2: Game is active. Render the appropriate board.
  return (
    <div className='bg-[#020205] h-screen w-screen flex items-center justify-center overflow-hidden'>
      {isOnlineMode ? (
        // Pass the socket down to LudoOnline. 
        // LudoOnline.jsx handles all the sync-state and dice-rolled listeners.
        <LudoOnline socket={socket} />
      ) : (
        <LudoOffline />
      )}
    </div>
  );
};

export default Session;