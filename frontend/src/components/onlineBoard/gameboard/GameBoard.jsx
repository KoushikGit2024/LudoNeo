import React, { memo, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Shield, ChevronRight, Zap, Trophy, Ban } from "lucide-react"; 
import "../../../styles/gameBoard.css"; 
import SlideEffect from '../../../assets/SlideEffect.mp3';
import FinishSound from '../../../assets/FinishSound.mp3';
import gsap from "gsap";
import debounce from '../../../derivedFuncs/debounce.js';
import Cell from "../../sharedBoardComponents/Cell.jsx";
import useGameStore from '@/store/useGameStore'
import gameActions from '@/store/gameLogic'
import { useShallow } from "zustand/shallow";
import piecePath from "../../../contexts/PiecePath.js";
import { AudioContext } from "@/contexts/SoundContext";

const GameBoard = memo(({ socket, gameId, isOnline, moveCount, timeOut, moving, pieceIdxArr, winState }) => {
  
  // =========================================================================
  // ========================== UTILITY LAYER ================================
  // =========================================================================
  const {sound}=useContext(AudioContext);
  const findIdxByref = (color, ref) => {
    let baseStartIdx =
      turn === 'R' ? 79 :
      turn === 'B' ? 83 :
      turn === 'Y' ? 87 :
      91;
    let foundIdx = pieceIdxArr[color].findIndex((el, idx) => {
      if (el === -1) {
        return ref === baseStartIdx - idx;
      }
      else {
        return piecePath[color][el] === ref;
      }
    })
    return foundIdx
  }

  const pathRefs = useRef([]);
  const boardRef = useRef(null);
  const chariotRef = useRef(null);
  const audioRef = useRef(null);
  const audioRefFinish = useRef(null);
  const inputLockedRef = useRef(false);
  
  const { turn, moveAllowed, onBoard, clrR, clrB, clrY, clrG, homeR, homeB, homeY, homeG, winR, winB, winY, winG } = useGameStore(
    useShallow(state => ({
      turn: state.move.turn,
      moveAllowed: state.move.moveAllowed,
      onBoard: state.meta.onBoard,
      clrR: state.players.R.color,
      clrB: state.players.B.color,
      clrY: state.players.Y.color,
      clrG: state.players.G.color,
      homeR: state.players.R.homeCount,
      homeB: state.players.B.homeCount,
      homeY: state.players.Y.homeCount,
      homeG: state.players.G.homeCount,
      winR: state.players.R.winCount,
      winB: state.players.B.winCount,
      winY: state.players.Y.winCount,
      winG: state.players.G.winCount,
    }))
  );

  const COLORS = useMemo(() => ({
    R: clrR, B: clrB, Y: clrY, G: clrG
  }), [clrR, clrB, clrY, clrG]);

  const WinCount = useMemo(() => ({
    R: winR, B: winB, Y: winY, G: winG
  }), [winR, winB, winY, winG]);

  const pieceR = useGameStore(state => state.players.R.pieceRef);
  const pieceB = useGameStore(state => state.players.B.pieceRef);
  const pieceY = useGameStore(state => state.players.Y.pieceRef);
  const pieceG = useGameStore(state => state.players.G.pieceRef);

  const pieceState = {
    R: pieceR, B: pieceB, Y: pieceY, G: pieceG
  }
  
  const [pathPoints, setPathPoints] = useState([])
  const [showChariot, setShowChariotDisplay] = useState(false)
  const [chariotColor, setChariotColor] = useState('R');

  const Homes = useMemo(() => ([
    { keyId: "R", color: COLORS.R, base: 76, bg: "bg-R" },
    { keyId: "B", color: COLORS.B, base: 80, bg: "bg-B" },
    { keyId: "Y", color: COLORS.Y, base: 84, bg: "bg-Y" },
    { keyId: "G", color: COLORS.G, base: 88, bg: "bg-G" },
  ]), [COLORS]);

  const FinishTriangles = useMemo(() => ([
    { color: COLORS.Y, clip: "polygon(0% 0%, 100% 0%, 50% 50%)", align: "flex justify-center pt-1", ref: 74, rotate: "rotate-225" }, 
    { color: COLORS.G, clip: "polygon(100% 0%, 100% 100%, 50% 50%)", align: "flex items-center justify-end pr-1", ref: 75, rotate: "rotate-315" }, 
    { color: COLORS.R, clip: "polygon(100% 100%, 0% 100%, 50% 50%)", align: "flex justify-center items-end pb-1", ref: 72, rotate: "rotate-45" }, 
    { color: COLORS.B, clip: "polygon(0% 100%, 0% 0%, 50% 50%)", align: "flex items-center pl-1", ref: 73, rotate: "rotate-135" },
  ]), [COLORS.R,COLORS.B,COLORS.Y,COLORS.G]);

  const SAFE_CELLS = new Set([1, 9, 14, 22, 27, 35, 40, 48, 52]);
  const homePointer = new Map([
    [12, 0], [25, 90], [38, 180], [51, 270]
  ]);

  const playSound = (playCase = -1) => {
    if (playCase === -1 || !sound) return;
    if (playCase === 1) {
      if (!audioRef.current) return;
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else if (playCase === 2) {
      if (!audioRefFinish.current) return
      audioRefFinish.current.currentTime = 0;
      audioRefFinish.current.play();
    }
  };

  const pathPointCalculator = () => {
    if (!pathRefs.current[0] || !boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    const tempPts = pathRefs.current.map(el => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        cx: rect.left - boardRect.left + (rect.width / 2)-1.8,
        cy: rect.top - boardRect.top + (rect.height / 2)-1.8,
        w: rect.width,
        h: rect.height
      };
    }).filter(Boolean);
    setPathPoints(tempPts);
  };

  useEffect(() => {
    pathPointCalculator();
    const resizeHandler = debounce(pathPointCalculator, 100)
    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, []);


  // =========================================================================
  // ====================== ANIMATION & NETWORK LAYER ========================
  // =========================================================================

  const oneStepAnimation = (from, to) => {
    return new Promise(resolve => {
      if (!pathPoints[from] || !pathPoints[to] || !chariotRef.current) {
        resolve();
        return;
      }
      const targetW = pathPoints[to].w;
      const targetH = pathPoints[to].h;

      gsap.fromTo(
        chariotRef.current,
        {
          x: pathPoints[from].cx - targetW / 2,
          y: pathPoints[from].cy - targetH / 2,
          width: pathPoints[from].w,
          height: pathPoints[from].h
        },
        {
          x: pathPoints[to].cx - targetW / 2,
          y: pathPoints[to].cy - targetH / 2,
          width: pathPoints[to].w,
          height: pathPoints[to].h,
          duration: 0.15, // Smooth animation speed
          ease: "power1.inOut",
          onComplete: resolve
        }
      );
      
      const finalCells = new Set([72, 73, 74, 75]);
      if (finalCells.has(to)) playSound(2);
      else playSound(1);
    });
  };

  // The actual visual runner for the Chariot
  const runChariot = async (idx = -1, refNum = null, stepCount = -1, turnColor = '') => {
    if (idx < 0 || refNum === null || stepCount === -1 || !turnColor) return;
    let from = refNum;
    let to = null;
    setChariotColor(turnColor);
    
    // Server-directed Cut Return
    if (stepCount === -2) {
      const baseStart = turnColor === 'R' ? 79 : turnColor === 'B' ? 83 : turnColor === 'Y' ? 87 : 91;
      to = baseStart - idx;
      setShowChariotDisplay(true);
      await oneStepAnimation(from, to);
      setShowChariotDisplay(false);
      return;
    }

    // Server-directed Forward Move
    let indexVal = pieceIdxArr[turnColor][idx];
    setShowChariotDisplay(true);
    for (let step = 1; step <= stepCount; step++) {
      from = step === 1 ? refNum : piecePath[turnColor][indexVal + step - 1];
      to = piecePath[turnColor][indexVal + step];
      await oneStepAnimation(from, to);
    }
    setShowChariotDisplay(false);
  };

  // 1. EMIT INTENT TO SERVER
  const determineAndProcessClickCell = (refNum) => {
    if (!isOnline || !socket || !moveAllowed || moving || inputLockedRef.current) return;
    
    const pieceCount = pieceState[turn].get(refNum) ?? 0;
    if (!pieceCount) return;
    
    const idx = findIdxByref(turn, refNum);
    if (idx === -1) return;

    inputLockedRef.current = true;
    socket.emit("move-piece", { gameId, color: turn, pieceIdx: idx, refNum });
  };

  // 2. LISTEN FOR SERVER COMMANDS
  useEffect(() => {
    if (!isOnline || !socket) return;

    const handlePieceMoved = async ({ animation, newState }) => {
      inputLockedRef.current = true;
      gameActions.setMoving(true);

      const { color, pieceIdx, fromRef, steps, cutInfo } = animation;

      // Execute forward animation
      await runChariot(pieceIdx, fromRef, steps, color);

      // Execute cut animation if applicable
      if (cutInfo) {
        await runChariot(cutInfo.idx, cutInfo.fromRef, -2, cutInfo.color);
      }

      // Hard sync store to reflect server reality instantly after animations
      gameActions.syncGameState(newState);
      
      gameActions.setMoving(false);
      inputLockedRef.current = false;
    };

    socket.on("piece-moved", handlePieceMoved);
    return () => socket.off("piece-moved", handlePieceMoved);
  }, [socket, isOnline]);


  // =========================================================================
  // =========================  DESIGN & RENDER LAYER ========================
  // =========================================================================

  return (
    <div
      className="boardContainer relative grid gap-[2px] rounded-xl max-w-full max-h-full p-0  shadow-2xl aspect-square"
      style={{ background: '#020205', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}
      ref={boardRef}
    >
      {/* --- STANDARD CELLS (The Grid) --- */}
      {Array.from({ length: 52 }, (_, i) => {
        const isSafe = SAFE_CELLS.has(i);
        const isHomePointer = homePointer.has(i);
        
        let cellBorderColor = 'rgba(255,255,255,0.05)';
        let neonColor = null;
        if (i === 1) neonColor = COLORS.R;
        else if (i === 14) neonColor = COLORS.B;
        else if (i === 27) neonColor = COLORS.Y;
        else if (i === 40) neonColor = COLORS.G;

        return (
          <div
            key={i}
            className={`box${i + 1} relative flex items-center justify-center rounded-[4px] transition-all duration-300 hover:bg-white/10 cursor-pointer box-border`}
            onClick={() => determineAndProcessClickCell(i)}
            
          >
            <div
              className={`cell w-full h-full flex items-center justify-center rounded-[3px] bg-white/5 backdrop-blur-sm border  box-border`}
              style={{
                borderColor: neonColor ? neonColor : cellBorderColor,
                boxShadow: neonColor ? `inset 0 0 15px ${neonColor}33` : 'none',
              }}
              ref={(el) => (pathRefs.current[i] = el)}
            >
              {isSafe && !neonColor && (
                <Shield size={16} className="text-white/20 absolute inset-0 m-auto animate-pulse" />
              )}
              {isSafe && neonColor && (
                 <Shield size={16} color={neonColor} className="absolute inset-0 m-auto animate-pulse" />
              )}
              {isHomePointer && (
                <div className="absolute" style={{ transform: `rotate(${homePointer.get(i)}deg)` }}>
                   <ChevronRight size={20} className="text-white/40" />
                </div>
              )}

              <Cell
                R={pieceState.R.get(i) ?? 0}
                B={pieceState.B.get(i) ?? 0}
                Y={pieceState.Y.get(i) ?? 0}
                G={pieceState.G.get(i) ?? 0}
                activeColor={turn}
                COLORS={COLORS}
                moveAllowed={moveAllowed}
              />
            </div>
          </div>
        );
      })}

      {/* --- TRACKS (The colored paths into home) --- */}
      {["R", "B", "Y", "G"].map((c, i) =>
        [1, 2, 3, 4, 5].map((n, j) => {
          const trackColor = c === 'R' ? COLORS.R : c === 'B' ? COLORS.B : c === 'Y' ? COLORS.Y : COLORS.G;
          return (
            <div
              className={`track${c}${n} relative flex items-center justify-center rounded-[4px] aspect-square`}
              key={`${c}${n}`}
              
            >
              <div
                className={`cell w-full h-full rounded-[3px] flex items-center justify-center bg-black/40 border transition-all`}
                style={{
                  borderColor: trackColor,
                  boxShadow: `inset 0 0 8px ${trackColor}44` // Internal neon glow
                }}
                ref={(el) => (pathRefs.current[i * 5 + j + 52] = el)}
              >
                <div className="absolute w-1 h-1 rounded-full opacity-50" style={{backgroundColor: trackColor}}/>
                <Cell
                  R={pieceState.R.get(i * 5 + j + 52) ?? 0}
                  B={pieceState.B.get(i * 5 + j + 52) ?? 0}
                  Y={pieceState.Y.get(i * 5 + j + 52) ?? 0}
                  G={pieceState.G.get(i * 5 + j + 52) ?? 0}
                  activeColor={turn}
                  COLORS={COLORS}
                  moveAllowed={moveAllowed}
                />
              </div>
            </div>
          );
        })
      )}

      {/* --- HOMES (The 4 Corners) --- */}
      {Homes.map(({ keyId, color, base }) => (
        <div
          className={`home${keyId} relative p-2 flex flex-col items-center justify-center rounded-[10%] bg-black/20 `}
          key={keyId}
        >
          <div
            className={`w-full h-full rounded-[8%] flex items-center justify-center relative overflow-hidden`}
            style={{ border: `1px solid ${color}44`, boxShadow: `inset 0 0 30px ${color}11` }}
          >
            <div className="absolute inset-0 opacity-20" 
                 style={{backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: '20px 20px'}}>
            </div>

            {(winState[keyId] === 0) ? (
              <div className="relative z-10 grid grid-cols-2 grid-rows-2 gap-3 w-[80%] aspect-square">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    ref={el => (pathRefs.current[base + i] = el)}
                    className={`home${keyId}${i + 1} w-auto h-[80%] aspect-square self-center justify-self-center flex items-center justify-center rounded-full border-2 transition-all hover:scale-105 hover:shadow-[0_0_15px_currentColor] cursor-pointer bg-black/40 backdrop-blur-sm`}
                    style={{ borderColor: color, color: color, boxShadow: `0 0 10px ${color}33` }}
                    onClick={() => determineAndProcessClickCell(base + i)}
                  >
                    {!(onBoard.has(keyId)) && <Ban size={10} className="opacity-50 absolute" />}
                    {(onBoard.has(keyId)) && (
                      <Cell
                        R={pieceState.R.get(base + i) ?? 0}
                        B={pieceState.B.get(base + i) ?? 0}
                        Y={pieceState.Y.get(base + i) ?? 0}
                        G={pieceState.G.get(base + i) ?? 0}
                        activeColor={turn}
                        COLORS={COLORS}
                        moveAllowed={moveAllowed}
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                 <div className="absolute inset-0 animate-pulse opacity-20 bg-gradient-to-t from-transparent to-white/10"/>
                 <Trophy size={48} color={color} className="mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"/>
                 <span className="text-2xl font-black" style={{color: color, textShadow: `0 0 10px ${color}`}}>
                    {winState[keyId]}
                 </span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* --- FINISH (Center) --- */}
      <div className="relative finish rounded-xl overflow-hidden m-1 bg-[#050508] border border-white/10 shadow-[inset_0_0_20px_rgba(0,0,0,0.9)]">
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-24 h-24 rounded-full bg-white/5 blur-3xl animate-pulse" />
        </div>
        <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: `radial-gradient(circle at center, white 1px, transparent 1px)`, backgroundSize: '12px 12px' }} />

        <div className="w-full h-full relative">
          {FinishTriangles.map(({ color, clip, align, ref }) => (
            <div
              key={ref}
              className={`absolute inset-0 ${align} transition-all duration-700`}
              style={{ 
                  backgroundColor: color, clipPath: clip,
                  opacity: turn === (ref === 72 ? 'R' : ref === 73 ? 'B' : ref === 74 ? 'Y' : 'G') ? 0.4 : 0.15,
                  filter: turn === (ref === 72 ? 'R' : ref === 73 ? 'B' : ref === 74 ? 'Y' : 'G') ? `drop-shadow(0 0 15px ${color})` : 'none'
              }}
            >
              <div className="w-full h-full bg-gradient-to-br from-white/30 via-transparent to-black/40" />
            </div>
          ))}
          
          {FinishTriangles.map(({ ref, align, rotate }) => (
              <div key={`ref-${ref}`} className={`absolute inset-0 ${align} pointer-events-none p-2`}>
                  <div ref={el => (pathRefs.current[ref] = el)} className={`h-1/3 aspect-square flex items-center justify-center ${rotate}`}>
                      <Cell
                        R={(ref === 72) && WinCount['R']} B={(ref === 73) && WinCount['B']} Y={(ref === 74) && WinCount['Y']} G={(ref === 75) && WinCount['G']}
                        COLORS={COLORS} className="scale-125 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
                      />
                  </div>
              </div>
          ))}
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
            <div className="w-12 h-12 rounded-full border border-white/10 border-t-white/40 animate-spin-slow" />
            <div className="absolute w-1/3 h-1/3 rounded-full bg-[#0a0a0f] border border-white/20 flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
                <Zap className="text-white/80 animate-pulse w-2/3" />
            </div>
        </div>
      </div>

      {/* --- CHARIOT (Animation Layer) --- */}
      <div
        ref={chariotRef}
        className="piece absolute z-[100] pointer-events-none text-white flex items-center justify-center aspect-square"
        style={{
           width: pathPoints[1]?.width || `auto`,
           display: (showChariot) ? "flex" : "none",
           filter: 'drop-shadow(0 0 15px white)'
        }}
      >
        <Cell R={chariotColor === 'R'} B={chariotColor === 'B'} Y={chariotColor === 'Y'} G={chariotColor === 'G'} COLORS={COLORS} />
      </div>

      <audio ref={audioRef} src={SlideEffect} preload="auto" />
      <audio ref={audioRefFinish} src={FinishSound} preload="auto" />
    </div>
  );
});

export default GameBoard;