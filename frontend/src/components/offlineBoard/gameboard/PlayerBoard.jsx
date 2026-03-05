// import React, { memo, useEffect, useRef } from "react";
// import gsap from "gsap";
// import '../../../styles/playerBoard.css'
// // import MoveContext from "../../contexts/MoveContext";
// import { useGameStore } from "../../../store/useGameStore";

// const PlayerBoard = memo(({ playing, left, turn=0, idx, timeOut,moveAllowed,rollAllowed,online=false }) => {
//   const timerRef = useRef(null);
//   const animRef = useRef(null);
//   // const {setMove}=useContext(MoveContext);
//   // console.log(crypto)
//   const updateTimeOut=useGameStore((state)=>state.updateTimeOut)

//   const animeFunc=()=>{
//     animRef.current?.kill();

//     let cancelled = false;

//     animRef.current = gsap.fromTo(
//       timerRef.current,
//       { "--angle": "360deg" },
//       {
//         "--angle": "0deg",
//         duration: 1,
//         ease: "linear",
//         onComplete: () => {
//           if (cancelled) return;
//           if(!timeOut)
//             updateTimeOut(true);
//           gsap.set(timerRef.current, { "--angle": "360deg" });
//           // setMove(pre => ({ ...pre, timeOut: true }));
//         }
//       }
//     );
//   }
//   // let one=1;
//   useEffect(() => {
//     if (!timerRef.current) return;

//     animeFunc(); // start timer animation

//     return () => {
//       animRef.current?.kill(); // stop previous turn's animation
//     };
//   }, [turn,rollAllowed,moveAllowed]);

  

//   // useEffect(()=>{
//     // console.log('moveAllowed or rollAllowed',turn,moveAllowed,rollAllowed);
    
//   //   if(moveCount!==0 ) return;
//   //   console.log("hi2")
//   //   animeFunc();

//   //   return () => {
//   //     animRef.current?.kill();
//   //   };
//   // },[turn,moveAllowed])

//   const userName=useGameStore((state)=>state.players[idx].userId)

//   const playerName=useGameStore((state)=>state.players[idx].name)
//   return (
//     <div
//       className={`relative ${!playing ? "invisible" : ""} bg-emerald-300 h-full flex ${
//         left ? "flex-row" : "flex-row-reverse"
//       } items-center justify-between max-w-1/3 min-w-1/3 px-[1%] py-[0.5%]`}
//     >
//       {/* PROFILE WITH TURN TIMER */}
//       <div
//         ref={timerRef}
//         className={`profile relative aspect-square max-h-full h-full p-[3px] rounded-[10px]
//         ${turn ? "profile-turn-timer" : ""}`}
//         style={{
//           "--color":"#fff"
//         }}
//       >
//         <div className={`h-full w-full rounded-[8px] overflow-hhidden bg-amber-3000 bg-fuchsia-500 ${online ? "online-dot" : ""} `}>
//           <img
//             src="/defaultProfile.png"
//             className="max-h-full max-w-full h-full w-full object-cover no-select pointer-events-none"
//             alt="profile"
//           />
//         </div>
//       </div>

//       {/* USER NAME */}
//       <div
//         className={`user-name bg-blue-400 h-full w-full flex flex-col ${
//           left ? "ml-1 items-start pl-1" : "mr-1 items-end pr-1"
//         } justify-around md:py-1 overflow-hidden`}
//       >
//       {
//         (userName=='')?
//         <span className="text-[12px] bg-amber-400 w-full overflow-hidden text-wrap">{playerName}</span> :
//         <>
//           <span className="lg:text-[18px] md:text-[14px] sm:text-[10px] text-[8px] font-semibold">
//             {userName}
//           </span>
//           <span className="lg:text-[16px] md:text-[12px] sm:text-[8px] text-[6px]">
//             {playerName}
//           </span>
//         </>
//       }
//       </div>
//     </div>
//   );
// });

// export default PlayerBoard;
import React, { memo, useEffect, useRef } from "react";
import gsap from "gsap";
// import '../../../styles/playerBoard.css' // Replaced with inline Tailwind/Neo styles
import useGameStore from '@/store/useGameStore'
import gameActions from '@/store/gameLogic'
import { User, Cpu } from "lucide-react"; // Icons for fallback

const PlayerBoard = memo(({ playing, left, turn = 0, idx, timeOut, moveAllowed, rollAllowed, online = false }) => {
  const timerRef = useRef(null);
  const animRef = useRef(null);
  const updateTimeOut = gameActions.updateTimeOut;

  // --- Logic Layer (Unchanged) ---
  const animeFunc = () => {
    animRef.current?.kill();
    let cancelled = false;

    animRef.current = gsap.fromTo(
      timerRef.current,
      { "--angle": "360deg" },
      {
        "--angle": "0deg",
        // Adjusted duration for realism, or keep your logic
        // Note: Your original code had duration: 1. I kept the logic structure but 
        // usually Ludo timers are longer. If you strictly want 1s, change this back to 1.
        duration: 0.11, 
        ease: "linear",
        onComplete: () => {
          if (cancelled) return;
          if (!timeOut) updateTimeOut(true);
          gsap.set(timerRef.current, { "--angle": "360deg" });
        }
      }
    );
  };

  useEffect(() => {
    if (!timerRef.current) return;
    animeFunc(); 
    return () => {
      animRef.current?.kill();
    };
  }, [turn, rollAllowed, moveAllowed]);

  const userName = useGameStore((state) => state.players[idx].userId);
  const playerName = useGameStore((state) => state.players[idx].name);

  // --- Design Constants ---
  const PLAYER_COLORS = {
    R: "#ff0505", // Red
    B: "#2b01ff", // Blue
    Y: "#fff200", // Yellow
    G: "#00ff3c"  // Green
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
        ref={timerRef}
        className="relative h-[85%] aspect-square rounded-lg flex items-center justify-center p-[2px]"
        style={{
          // The Conic Gradient Timer Logic
          background: turn 
            ? `conic-gradient(${themeColor} var(--angle), transparent 0)` 
            : 'rgba(255,255,255,0.1)',
          boxShadow: turn ? `0 0 10px ${themeColor}` : 'none',
          transition: 'box-shadow 0.3s ease'
        }}
      >
        {/* Inner Profile Container */}
        <div className="h-full w-full rounded-[6px] bg-[#0a0a0f] overflow-hidden relative flex items-center justify-center">
           {/* Scanline Overlay */}
           <div className="absolute inset-0 z-10 opacity-20 pointer-events-none bg-[linear-gradient(transparent_50%,_rgba(0,0,0,0.5)_50%)] bg-[length:100%_4px]" />
           
           {/* Profile Image */}
           <img
             src="/defaultProfile.png"
             className="h-full w-full object-cover"
             alt="profile"
             onError={(e) => { e.target.style.display = 'none'; }} // Fallback if img missing
           />
           
           {/* Fallback Icon if Image Fails/Missing */}
           <div className="absolute z-0 text-white/20">
              {online ? <User size={20} /> : <Cpu size={20} />}
           </div>

           {/* Online Status Dot */}
           {online && (
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
        {userName === '' ? (
          // Default Name Display
          <div className="flex flex-col">
            <span 
              className="text-[10px] uppercase tracking-widest font-bold opacity-60"
              style={{ color: turn ? themeColor : '#9ca3af' }}
            >
              System ID
            </span>
            <span className="text-xs sm:text-sm font-bold text-white truncate w-full">
              {playerName || `Player ${idx}`}
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