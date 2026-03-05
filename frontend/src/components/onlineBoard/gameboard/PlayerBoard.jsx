import React, { memo, useEffect, useRef } from "react";
import gsap from "gsap";
import useGameStore from '@/store/useGameStore';
import { User } from "lucide-react"; 

const PlayerBoard = memo(({ playing, left, turn = false, idx }) => {
  const timerRef = useRef(null);
  const animRef = useRef(null);

  // --- Animation Logic ---
  // Purely visual. The server tracks the actual 15 seconds and will emit
  // a 'state-sync' or 'turn-skipped' event when time runs out.
  const animeFunc = () => {
    animRef.current?.kill();
    
    // Reset angle before starting new animation
    gsap.set(timerRef.current, { "--angle": "360deg" });

    animRef.current = gsap.to(timerRef.current, {
      "--angle": "0deg",
      duration: 15, // Ensure this matches your backend timeout duration
      ease: "linear",
      onComplete: () => {
        // Animation finished naturally. 
        // We do nothing but reset the visual state. 
        // The server will update the 'turn' prop via Socket.io if the player actually timed out.
        gsap.set(timerRef.current, { "--angle": "360deg" });
      }
    });
  };

  useEffect(() => {
    if (!timerRef.current) return;
    
    // Only animate if it is THIS player's turn
    if (turn) {
        animeFunc(); 
    } else {
        // If not their turn, ensure the ring is full and static
        animRef.current?.kill();
        gsap.set(timerRef.current, { "--angle": "360deg" });
    }

    return () => {
      animRef.current?.kill();
    };
  }, [turn]); // Removed rollAllowed/moveAllowed. Turn transitions are enough for online.

  const userName = useGameStore((state) => state.players[idx].userId);
  const playerName = useGameStore((state) => state.players[idx].name);
  const playerProfile = useGameStore((state) => state.players[idx].profile);

  // --- Design Constants ---
  const PLAYER_COLORS = {
    R: "#ff0505", 
    B: "#2b01ff", 
    Y: "#fff200", 
    G: "#00ff3c"  
  };
  
  const themeColor = PLAYER_COLORS[idx] || "#ffffff";

  return (
    <div
      className={`relative ${!playing ? "invisible opacity-0" : "opacity-100"} 
        transition-all duration-500
        flex ${left ? "flex-row" : "flex-row-reverse text-right"} 
        items-center justify-between 
        w-full h-full max-h-full px-2 py-1 gap-2
        rounded-xl border
      `}
      style={{
        backgroundColor: turn ? `${themeColor}11` : 'rgba(255,255,255,0.02)',
        borderColor: turn ? themeColor : 'rgba(255,255,255,0.1)',
        boxShadow: turn ? `0 0 15px ${themeColor}22, inset 0 0 10px ${themeColor}11` : 'none',
      }}
    >
      
      {/* === PROFILE IMAGE & TIMER RING === */}
      <div
        className="relative h-[85%] aspect-square rounded-lg flex items-center justify-center p-[2px]"
        style={{
          // We apply the custom property '--angle' dynamically using GSAP via the ref below
          background: turn 
            ? `conic-gradient(${themeColor} var(--angle), transparent 0)` 
            : 'rgba(255,255,255,0.1)',
          boxShadow: turn ? `0 0 10px ${themeColor}` : 'none',
          transition: 'box-shadow 0.3s ease'
        }}
        ref={timerRef}
      >
        {/* Inner Profile Container */}
        <div className="h-full w-full rounded-[6px] bg-[#0a0a0f] overflow-hidden relative flex items-center justify-center">
           {/* Scanline Overlay */}
           <div className="absolute inset-0 z-10 opacity-20 pointer-events-none bg-[linear-gradient(transparent_50%,_rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />
           
           {/* Profile Image */}
           <img
             src={playerProfile || "/defaultProfile.png"}
             className="h-full w-full object-cover"
             alt="profile"
             onError={(e) => { e.target.style.display = 'none'; }} 
           />
           
           {/* Fallback Icon if Image Fails/Missing */}
           <div className="absolute z-0 text-white/20">
              <User size={20} />
           </div>

           {/* Online Status Dot (Always true for active players in online mode) */}
           {playing && (
             <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#00ff00] z-20" />
           )}
        </div>
      </div>

      {/* === USER INFO HUD === */}
      <div
        className={`flex-1 flex flex-col h-full justify-center overflow-hidden
          ${left ? "items-start pl-1" : "items-end pr-1"}
        `}
      >
        {!userName ? (
          // Default Name Display
          <div className="flex flex-col">
            <span 
              className="text-[10px] uppercase tracking-widest font-bold opacity-60"
              style={{ color: turn ? themeColor : '#9ca3af' }}
            >
              System ID
            </span>
            <span className="text-xs sm:text-sm font-bold text-white truncate w-full">
              {playerName || `Pilot_${idx}`}
            </span>
          </div>
        ) : (
          // Logged In User Display
          <>
            <span 
              className="text-[10px] sm:text-xs font-black tracking-wider uppercase truncate w-full"
              style={{ 
                color: turn ? themeColor : 'white',
                textShadow: turn ? `0 0 10px ${themeColor}` : 'none'
              }}
            >
              {userName}
            </span>
            <span className="text-[8px] sm:text-[10px] font-mono text-gray-400 truncate w-full">
              {playerName}
            </span>
          </>
        )}
        
        {/* Active Turn Indicator Line */}
        <div 
          className={`h-[2px] mt-1 rounded-full transition-all duration-500 ${turn ? "w-full opacity-100" : "w-0 opacity-0"}`}
          style={{ backgroundColor: themeColor, boxShadow: `0 0 8px ${themeColor}` }}
        />
      </div>
    </div>
  );
});

export default PlayerBoard;