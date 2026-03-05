// import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
// import { Volume2, VolumeX, Zap } from 'lucide-react'; 

// import GameBoard from './gameboard/GameBoard.jsx';
// import Dice from './gameboard/Dice';
// import PlayerBoard from './gameboard/PlayerBoard';
// import useGameStore from '@/store/useGameStore'
// // import gameActions from '@/store/gameLogic'
// import { useShallow } from 'zustand/shallow';
// import ErrorBoundary from '../../ErrorBoundary';
// import { toast, ToastContainer,Bounce } from 'react-toastify'
// import "react-toastify/dist/ReactToastify.css";

// const LudoOffline = memo(() => {
//   const [screen, setScreen] = useState(window.innerWidth <= window.innerHeight);
//   const [clicked, setClicked] = useState(null);
//   const [sound, allowSound] = useState(false);
  
//   const ref = useRef(null);
  
//   // --- STORE SUBSCRIPTIONS ---
//   const turn = useGameStore(state => state.move.turn);
//   const playersSet = useGameStore(state => state.meta?.onBoard);
//   const curColor = useGameStore(state => state.players[state.move.turn].color);
//   const moveObj = useGameStore(useShallow(state => state.move));
//   const homeCount = useGameStore(state => state.players[state.move.turn].homeCount);
//   const winPosn = useGameStore(state => state.players[state.move.turn].winPosn);
//   const rollAllowed = useGameStore(state => state.move.rollAllowed);
//   const pieceState = useGameStore(state => state.pieceState);

//   const { pieceIdxR, pieceIdxB, pieceIdxY, pieceIdxG } = useGameStore(useShallow(state => ({
//     pieceIdxR: state.players.R.pieceIdx,
//     pieceIdxB: state.players.B.pieceIdx,
//     pieceIdxY: state.players.Y.pieceIdx,
//     pieceIdxG: state.players.G.pieceIdx,
//   })));

//   const pieceIdx = useMemo(() => ({
//     R: pieceIdxR, B: pieceIdxB, Y: pieceIdxY, G: pieceIdxG
//   }), [pieceIdxR, pieceIdxB, pieceIdxY, pieceIdxG]);

//   const winLast = useGameStore(state => state.meta.winLast);
//   const playerCount = useGameStore(state => state.meta.playerCount);
//   const timeOut = useGameStore((state) => state.move.timeOut);

//   const { winR, winB, winY, winG } = useGameStore(useShallow(state => ({
//     winR: state.players.R.winPosn,
//     winB: state.players.B.winPosn,
//     winY: state.players.Y.winPosn,
//     winG: state.players.G.winPosn,
//   })));

//   const winState = useMemo(() => ({
//     R: winR, B: winB, Y: winY, G: winG,
//   }), [winR, winB, winY, winG]);

//   useEffect(() => {
//     const handleResize = () => {
//       setScreen(window.innerWidth < window.innerHeight);
//     };
//     window.addEventListener('resize', handleResize);
//     return () => window.removeEventListener('resize', handleResize);
//   }, []);

//   return (
//     <div className="w-full h-full min-h-screen bg-[#050502] flex items-center justify-center relative">
      
//       {/* Background Ambience */}
//       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020205] to-[#020205] z-0 pointer-events-none" />
//       <div className="absolute inset-0 z-0 opacity-10" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>

//       {/* --- SOUND TOGGLE --- */}
//       <div 
//         className="absolute z-50 top-2 left-2 sm:top-4 sm:left-4"
//         onClick={() => allowSound(pre => !pre)}
//       >
//         <button className={`
//           flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all duration-300
//           ${sound 
//             ? 'bg-[#00ff3c]/10 border-[#00ff3c]/50 text-[#00ff3c] shadow-[0_0_15px_rgba(0,255,60,0.3)]' 
//             : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}
//         `}
//         >
//           {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
//           <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase hidden sm:block">
//             {sound ? 'ON' : 'OFF'}
//           </span>
//         </button>
//       </div>

//       {/* --- MAIN GAME CONTAINER --- */}
//       <div
//         ref={ref}
//         className={`relative z-10 flex flex-col items-center justify-between transition-all duration-300
//           ${screen
//             ? 'w-full max-w-[500px] aspect-[12/16] py-2 px-1' // Mobile Portrait
//             : 'h-full max-h-[95vh] aspect-[1/1] py-4 bgg-amber-400'       // Desktop/Tablet
//           }
//         `}
//       >
        
//         {/* === TOP ROW (Player B | Dice | Player Y) === */}
//         {/* Changed h-[15%] to h-[10%] sm:h-[12%] to reduce size */}
//         <div className='flex flex-row items-center justify-between w-full h-[10%] sm:h-[10%] px-1 gap-2 sm:gap-4'>  
//           <div className="h-full flex-1 max-w-[35%] min-w-0">
//              <PlayerBoard
//                playing={playersSet?.has('B')}
//                idx={'B'}
//                left={true}
//                turn={moveObj.turn === 'B'}
//                timeOut={timeOut}
//                moveAllowed={moveObj.moveAllowed}
//                rollAllowed={moveObj.rollAllowed}
//                moveCount={moveObj.moveCount}
//              />
//           </div>

//           {/* --- DICE CORE --- */}
//           {/* Constrained max height so it doesn't get too big on tablets */}
//           <div className="relative h-full aspect-square max-h-[80px] sm:max-h-[100px] flex items-center justify-center group flex-shrink-0">
//             <div 
//               className="absolute inset-0 rounded-xl opacity-40 blur-lg transition-colors duration-500"
//               style={{ backgroundColor: curColor }}
//             />
            
//             <div 
//               className="dice-cover relative z-10 w-full h-full flex items-center justify-center rounded-xl bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/10 transition-all duration-300 shadow-xl"
//               style={{
//                 borderColor: curColor,
//                 boxShadow: `inset 0 0 15px ${curColor}15`
//               }}
//             >
//                {/* Tech decorative corners */}
//                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l opacity-50" style={{borderColor: curColor}}/>
//                <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r opacity-50" style={{borderColor: curColor}}/>

//               <Dice
//                 turn={turn}
//                 pieceIdx={pieceIdx}
//                 winPosn={winPosn}
//                 ticks={moveObj.ticks}
//                 homeCount={homeCount}
//                 rollAllowed={rollAllowed}
//                 moveAllowed={moveObj.moveAllowed}
//                 timeOut={timeOut}
//                 gameFinished={playerCount === winLast}
//                 winState={winState}
//                 sound={sound}
//               />
//             </div>
//           </div>

//           <div className="h-full flex-1 max-w-[35%] min-w-0">
//             <PlayerBoard
//               playing={playersSet?.has('Y')}
//               idx={'Y'}
//               left={false}
//               turn={moveObj.turn === 'Y'}
//               timeOut={timeOut}
//               moveAllowed={moveObj.moveAllowed}
//               rollAllowed={moveObj.rollAllowed}
//               moveCount={moveObj.moveCount}
//             />
//           </div>
//         </div>

//         {/* === MIDDLE (Game Board) === */}
//         {/* Optimized flex-grow to take remaining space */}
//         <div className={`
//           relative flex items-center justify-center flex-1 w-full overflow-hidden my-1
//         `}>
//           <div className="relative aspect-square w-full h-auto max-h-full max-w-full flex items-center justify-center">
//             {/* Holo-Table Effect */}
//             <div className="absolute inset-0 rounded-lg bg-black/40 shadow-2xl backdrop-blur-sm border border-white/5"></div>
            
//             <div 
//               className={`
//                 z-10 p-1 aspect-square flex-none
//                 ${screen 
//                   ? 'w-full max-w-full h-auto'  // Portrait: Width is the limiter -> Fill width, auto height
//                   : 'h-full max-h-full w-auto'  // Landscape: Height is the limiter -> Fill height, auto width
//                 }
//               `}
//             >
//               <ErrorBoundary>
//                 <GameBoard
//                   clicked={clicked}
//                   setClicked={setClicked}
//                   moveCount={moveObj.moveCount}
//                   pieceState={pieceState}
//                   timeOut={timeOut}
//                   moving={moveObj.moving}
//                   pieceIdxArr={pieceIdx}
//                   winState={winState}
//                   sound={sound}
//                 />
//               </ErrorBoundary>
//             </div>
//           </div>
//         </div>

//         {/* === BOTTOM ROW (Player R | Deco | Player G) === */}
//         {/* Changed h-[15%] to h-[10%] sm:h-[12%] */}
//         <div className='flex flex-row items-center justify-between w-full h-[10%] sm:h-[10%] px-1 gap-2 sm:gap-4'>
//           <div className="h-full flex-1 max-w-[35%] min-w-0">
//             <PlayerBoard
//               playing={playersSet?.has('R')}
//               idx={'R'}
//               left={true}
//               turn={moveObj.turn === 'R'}
//               timeOut={timeOut}
//               moveAllowed={moveObj.moveAllowed}
//               rollAllowed={moveObj.rollAllowed}
//               moveCount={moveObj.moveCount}
//             />
//           </div>

//           {/* Decorative Spacer */}
//           <div className="hidden sm:flex flex-col items-center justify-center opacity-30 w-[20%]">
//              <Zap size={18} className="text-white animate-pulse" />
//              <span className="text-[8px] tracking-[0.3em] text-white font-mono mt-0.5">NEO</span>
//           </div>

//           <div className="h-full flex-1 max-w-[35%] min-w-0">
//             <PlayerBoard
//               playing={playersSet?.has('G')}
//               idx={'G'}
//               left={false}
//               turn={moveObj.turn === 'G'}
//               timeOut={timeOut}
//               moveAllowed={moveObj.moveAllowed}
//               rollAllowed={moveObj.rollAllowed}
//               moveCount={moveObj.moveCount}
//             />
//           </div>
//         </div>

//       </div>
//       {/* <ToastContainer
//       position="bottom-left"
//       autoClose={5000}
//       hideProgressBar={false}
//       newestOnTop={false}
//       closeOnClick={false}
//       rtl={false}
//       pauseOnFocusLoss
//       draggable
//       pauseOnHover
//       theme="dark"
//       transition={"Bounce"}
//       /> */}
//     </div>
//   )
// });

// LudoOffline.displayName = 'LudoOffline';

// export default LudoOffline;
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, VolumeX, Zap, Trophy, ChevronRight } from 'lucide-react'; 
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import GameBoard from './gameboard/GameBoard.jsx';
import Dice from './gameboard/Dice';
import PlayerBoard from './gameboard/PlayerBoard';
import useGameStore from '@/store/useGameStore'
import gameActions from '@/store/gameLogic'
import { useShallow } from 'zustand/shallow';
import ErrorBoundary from '../../ErrorBoundary';
import GradientText from '@/components/customComponents/GradientText';

const LudoOffline = memo(() => {
  const navigate = useNavigate();
  const [screen, setScreen] = useState(window.innerWidth <= window.innerHeight);
  const [clicked, setClicked] = useState(null);
  const [sound, allowSound] = useState(false);
  
  const ref = useRef(null);
  
  // --- STORE SUBSCRIPTIONS ---
  const turn = useGameStore(state => state.move.turn);
  const playersSet = useGameStore(state => state.meta?.onBoard);
  const curColor = useGameStore(state => state.players[state.move.turn].color);
  const moveObj = useGameStore(useShallow(state => state.move));
  const homeCount = useGameStore(state => state.players[state.move.turn].homeCount);
  const winPosn = useGameStore(state => state.players[state.move.turn].winPosn);
  const rollAllowed = useGameStore(state => state.move.rollAllowed);
  const {pieceStateR, pieceStateB, pieceStateY, pieceStateG } = useGameStore(useShallow(state => {
    return {
      pieceStateR: state.players.R.pieceState,
      pieceStateB: state.players.B.pieceState,
      pieceStateY: state.players.Y.pieceState,
      pieceStateG: state.players.G.pieceState,
    } 
  }));

  const pieceState = useMemo(() => ({
    R: pieceStateR,
    B: pieceStateB,
    Y: pieceStateY,
    G: pieceStateG,
  }), [pieceStateR, pieceStateB, pieceStateY, pieceStateG]);

  // Status & Leaderboard Data
  const gameStatus = useGameStore(state => state.meta.status);
  const playersData = useGameStore(state => state.players);

  const { pieceIdxR, pieceIdxB, pieceIdxY, pieceIdxG } = useGameStore(useShallow(state => ({
    pieceIdxR: state.players.R.pieceIdx,
    pieceIdxB: state.players.B.pieceIdx,
    pieceIdxY: state.players.Y.pieceIdx,
    pieceIdxG: state.players.G.pieceIdx,
  })));

  const pieceIdx = useMemo(() => ({
    R: pieceIdxR, B: pieceIdxB, Y: pieceIdxY, G: pieceIdxG
  }), [pieceIdxR, pieceIdxB, pieceIdxY, pieceIdxG]);

  const winLast = useGameStore(state => state.meta.winLast);
  const playerCount = useGameStore(state => state.meta.playerCount);
  const timeOut = useGameStore((state) => state.move.timeOut);

  const { winR, winB, winY, winG } = useGameStore(useShallow(state => ({
    winR: state.players.R.winPosn,
    winB: state.players.B.winPosn,
    winY: state.players.Y.winPosn,
    winG: state.players.G.winPosn,
  })));

  const winState = useMemo(() => ({
    R: winR, B: winB, Y: winY, G: winG,
  }), [winR, winB, winY, winG]);

  const isFinished = gameStatus === "FINISHED";
  console.log(isFinished)
  useEffect(() => {
    const handleResize = () => {
      setScreen(window.innerWidth < window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleReturnToDash = () => {
    gameActions.resetStore();
    navigate('/dashboard');
  };

  // console.log(pieceIdx/)

  return (
    <div className="w-full h-full min-h-screen bg-[#050502] flex items-center justify-center relative overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020205] to-[#020205] z-0 pointer-events-none" />
      <div className="absolute inset-0 z-0 opacity-10" style={{backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px'}}></div>

      {/* --- SOUND TOGGLE --- */}
      <div className="absolute z-50 top-2 left-2 sm:top-4 sm:left-4" onClick={() => allowSound(pre => !pre)}>
        <button className={`flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md transition-all duration-300
          ${sound ? 'bg-[#00ff3c]/10 border-[#00ff3c]/50 text-[#00ff3c] shadow-[0_0_15px_rgba(0,255,60,0.3)]' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'}`}
        >
          {sound ? <Volume2 size={14} /> : <VolumeX size={14} />}
          <span className="text-[10px] sm:text-xs font-bold tracking-widest uppercase hidden sm:block">
            {sound ? 'ON' : 'OFF'}
          </span>
        </button>
      </div>

      {/* --- MAIN GAME CONTAINER (Blurs and locks when finished) --- */}
      <div
        ref={ref}
        className={`relative z-10 flex flex-col items-center justify-between transition-all duration-500
          ${screen ? 'w-full max-w-[500px] aspect-[12/16] py-2 px-1' : 'h-full max-h-[95vh] aspect-[1/1] py-4'}
          ${isFinished ? 'pointer-events-none blur-md opacity-40 scale-95' : ''} 
        `}
      >
        <div className='flex flex-row items-center justify-between w-full h-[10%] sm:h-[10%] px-1 gap-2 sm:gap-4'>  
          <div className="h-full flex-1 max-w-[35%] min-w-0">
             <PlayerBoard playing={playersSet?.has('B')} idx={'B'} left={true} turn={moveObj.turn === 'B'} timeOut={timeOut} moveAllowed={moveObj.moveAllowed} rollAllowed={moveObj.rollAllowed} moveCount={moveObj.moveCount}/>
          </div>
          <div className="relative h-full aspect-square max-h-[80px] sm:max-h-[100px] flex items-center justify-center group flex-shrink-0">
            <div className="absolute inset-0 rounded-xl opacity-40 blur-lg transition-colors duration-500" style={{ backgroundColor: curColor }} />
            <div className="dice-cover relative z-10 w-full h-full flex items-center justify-center rounded-xl bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/10 transition-all duration-300 shadow-xl" style={{ borderColor: curColor, boxShadow: `inset 0 0 15px ${curColor}15` }}>
               <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l opacity-50" style={{borderColor: curColor}}/>
               <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r opacity-50" style={{borderColor: curColor}}/>
              <Dice turn={turn} pieceIdx={pieceIdx} winPosn={winPosn} ticks={moveObj.ticks} homeCount={homeCount} rollAllowed={rollAllowed} moveAllowed={moveObj.moveAllowed} timeOut={timeOut} gameFinished={isFinished} winState={winState} sound={sound}/>
            </div>
          </div>
          <div className="h-full flex-1 max-w-[35%] min-w-0">
            <PlayerBoard playing={playersSet?.has('Y')} idx={'Y'} left={false} turn={moveObj.turn === 'Y'} timeOut={timeOut} moveAllowed={moveObj.moveAllowed} rollAllowed={moveObj.rollAllowed} moveCount={moveObj.moveCount} />
          </div>
        </div>

        <div className={`relative flex items-center justify-center flex-1 w-full overflow-hidden my-1`}>
          <div className="relative aspect-square w-full h-auto max-h-full max-w-full flex items-center justify-center">
            <div className="absolute inset-0 rounded-lg bg-black/40 shadow-2xl backdrop-blur-sm border border-white/5"></div>
            <div className={`z-10 p-1 aspect-square flex-none ${screen ? 'w-full max-w-full h-auto' : 'h-full max-h-full w-auto'}`}>
              <ErrorBoundary>
                <GameBoard
                  moveCount={moveObj.moveCount}
                  timeOut={timeOut}
                  moving={moveObj.moving}
                  pieceIdxArr={pieceIdx}
                  winState={winState}
                  sound={sound}
                />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        <div className='flex flex-row items-center justify-between w-full h-[10%] sm:h-[10%] px-1 gap-2 sm:gap-4'>
          <div className="h-full flex-1 max-w-[35%] min-w-0">
            <PlayerBoard playing={playersSet?.has('R')} idx={'R'} left={true} turn={moveObj.turn === 'R'} timeOut={timeOut} moveAllowed={moveObj.moveAllowed} rollAllowed={moveObj.rollAllowed} moveCount={moveObj.moveCount}/>
          </div>
          <div className="hidden sm:flex flex-col items-center justify-center opacity-30 w-[20%]">
             <Zap size={18} className="text-white animate-pulse" />
             <span className="text-[8px] tracking-[0.3em] text-white font-mono mt-0.5">NEO</span>
          </div>
          <div className="h-full flex-1 max-w-[35%] min-w-0">
            <PlayerBoard playing={playersSet?.has('G')} idx={'G'} left={false} turn={moveObj.turn === 'G'} timeOut={timeOut} moveAllowed={moveObj.moveAllowed} rollAllowed={moveObj.rollAllowed} moveCount={moveObj.moveCount}/>
          </div>
        </div>
      </div>

      {/* --- LEADERBOARD OVERLAY --- */}
      <AnimatePresence>
        {isFinished && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#0a0a0f] border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-[0_0_50px_rgba(0,255,60,0.1)] flex flex-col items-center relative overflow-hidden"
            >
              {/* Decorative Header */}
              <GradientText colors={["#00ff3c", "#ffffff"]} className="text-3xl sm:text-4xl font-black tracking-tighter uppercase mb-2">
                MISSION_COMPLETE
              </GradientText>
              <p className="text-[10px] text-gray-500 font-mono tracking-[0.3em] uppercase mb-8">Grid Protocol Terminated</p>

              {/* Ranks List */}
              <div className="w-full space-y-3 mb-8">
                {Array.from(playersSet || [])
                  .map(color => playersData[color])
                  .sort((a, b) => {
                    // Sort un-finished players to the bottom
                    if (a.winPosn === 0) return 1;
                    if (b.winPosn === 0) return -1;
                    return a.winPosn - b.winPosn;
                  })
                  .map((player, idx) => {
                    
                    // NEW: Determine Trophy Color and Glow based on Rank
                    const trophyStyle = 
                      player.winPosn === 1 ? "text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]" :   // Gold
                      player.winPosn === 2 ? "text-[#C0C0C0] drop-shadow-[0_0_12px_rgba(192,192,192,0.8)]" : // Silver
                      player.winPosn === 3 ? "text-[#CD7F32] drop-shadow-[0_0_12px_rgba(205,127,50,0.8)]" :  // Copper
                      null;

                    return (
                      <div 
                        key={player.color} 
                        className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden group"
                      >
                        <div className="absolute inset-0 opacity-10" style={{ backgroundColor: player.color }} />
                        <div className="flex items-center gap-4 relative z-10">
                          <span className="text-2xl font-black" style={{ color: player.color }}>
                            {player.winPosn !== 0 ? `#${player.winPosn}` : '-'}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold uppercase text-white">{player.name || player.userId}</span>
                            <span className="text-[8px] font-mono text-gray-500 tracking-widest">Node_{player.color}</span>
                          </div>
                        </div>
                        
                        {/* NEW: Render Colored Trophy */}
                        {trophyStyle && (
                          <Trophy size={24} className={`opacity-90 relative z-10 ${trophyStyle}`} />
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Return Action */}
              <button 
                onClick={handleReturnToDash}
                className="w-full py-4 bg-[#00ff3c] text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-xl hover:shadow-[0_0_25px_#00ff3c] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                RETURN_TO_DASHBOARD <ChevronRight size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
});

LudoOffline.displayName = 'LudoOffline';
export default LudoOffline;