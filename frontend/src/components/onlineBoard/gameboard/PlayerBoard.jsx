import React, { memo, useEffect, useRef } from "react";
import gsap from "gsap";
import useGameStore from '@/store/useGameStore';
import { User, ShieldAlert } from "lucide-react"; 

const PlayerBoard = memo(({ playing, left, turn = false, idx, isOnline = false }) => {
  const timerRef = useRef(null);
  const animRef = useRef(null);

  // ✅ Pull the exact start time of the current action from the server state
  const turnStartedAt = useGameStore((state) => state.move.turnStartedAt);

  const animeFunc = () => {
    animRef.current?.kill();
    
    // Total duration of a turn
    const totalDuration = 30; 
    let elapsed = 0;
    
    // Calculate exactly how much time has already passed according to the timestamp
    if (turnStartedAt) {
      elapsed = (Date.now() - turnStartedAt) / 1000;
    }
    
    // Clamp values to prevent weird behavior from minor clock drifts
    elapsed = Math.max(0, Math.min(elapsed, totalDuration));
    const remainingTime = totalDuration - elapsed;
    
    // Calculate the exact angle the ring should start at (360 is full, 0 is empty)
    const startAngle = 360 - (360 * (elapsed / totalDuration));

    // Instantly set the visual ring to the correct starting point
    gsap.set(timerRef.current, { "--angle": `${startAngle}deg` });

    // Only animate if there is actually time left
    if (remainingTime > 0) {
        animRef.current = gsap.to(timerRef.current, {
          "--angle": "0deg",
          duration: remainingTime,
          ease: "none", // "none" ensures a smooth, non-accelerating drain
          onComplete: () => {
            gsap.set(timerRef.current, { "--angle": "360deg" });
          }
        });
    }
  };

  useEffect(() => {
    if (!timerRef.current) return;
    
    if (turn) {
        animeFunc(); 
    } else {
        animRef.current?.kill();
        gsap.set(timerRef.current, { "--angle": "360deg" });
    }

    return () => animRef.current?.kill();
  }, [turn, turnStartedAt]); // ✅ Re-run if the timestamp changes (e.g., player rolled the dice and gets a fresh 30s)

  const userName = useGameStore((state) => state.players[idx]?.userId);
  const playerName = useGameStore((state) => state.players[idx]?.name);
  const playerProfile = useGameStore((state) => state.players[idx]?.profile);
  const isBot = useGameStore((state) => state.players[idx]?.difficulty !== undefined);

  const PLAYER_COLORS = { R: "#ff0505", B: "#2b01ff", Y: "#fff200", G: "#00ff3c" };
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
      <div
        className="relative h-[85%] aspect-square rounded-lg flex items-center justify-center p-[2px]"
        style={{
          background: turn ? `conic-gradient(${themeColor} var(--angle), transparent 0)` : 'rgba(255,255,255,0.1)',
          boxShadow: turn ? `0 0 10px ${themeColor}` : 'none',
          transition: 'box-shadow 0.3s ease'
        }}
        ref={timerRef}
      >
        <div className="h-full w-full rounded-[6px] bg-[#0a0a0f] overflow-hidden relative flex items-center justify-center">
           <div className="absolute inset-0 z-10 opacity-20 pointer-events-none bg-[linear-gradient(transparent_50%,_rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />
           <img
             src={playerProfile || "/defaultProfile.png"}
             className="h-full w-full object-cover"
             alt="profile"
             onError={(e) => { e.target.style.display = 'none'; }} 
           />
           <div className="absolute z-0 text-white/20">
              {isBot ? <ShieldAlert size={20} /> : <User size={20} />}
           </div>
           {playing && isOnline && !isBot && (
             <div className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-[#00ff3c] shadow-[0_0_5px_#00ff3c] z-20" />
           )}
        </div>
      </div>

      <div className={`flex-1 flex flex-col h-full justify-center overflow-hidden ${left ? "items-start pl-1" : "items-end pr-1"}`}>
        {!userName ? (
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-60" style={{ color: turn ? themeColor : '#9ca3af' }}>
              {isBot ? "AI_NODE" : "System ID"}
            </span>
            <span className="text-xs sm:text-sm font-bold text-white truncate w-full">
              {playerName || `Pilot_${idx}`}
            </span>
          </div>
        ) : (
          <>
            <span className="text-[10px] sm:text-xs font-black tracking-wider uppercase truncate w-full"
              style={{ color: turn ? themeColor : 'white', textShadow: turn ? `0 0 10px ${themeColor}` : 'none' }}>
              {userName}
            </span>
            <span className="text-[8px] sm:text-[10px] font-mono text-gray-400 truncate w-full">
              {playerName}
            </span>
          </>
        )}
        <div className={`h-[2px] mt-1 rounded-full transition-all duration-500 ${turn ? "w-full opacity-100" : "w-0 opacity-0"}`}
          style={{ backgroundColor: themeColor, boxShadow: `0 0 8px ${themeColor}` }} />
      </div>
    </div>
  );
});

export default PlayerBoard;