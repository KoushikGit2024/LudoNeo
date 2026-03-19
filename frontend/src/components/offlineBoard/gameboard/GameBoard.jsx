import React, { memo, useEffect, useMemo, useRef, useState, useContext} from "react";
import { Shield, ChevronRight, Zap, Trophy, Ban } from "lucide-react"; 
import "../../../styles/gameBoard.css"; 
import SlideEffect from '../../../assets/SlideEffect.mp3';
import FinishSound from '../../../assets/FinishSound.mp3';
import gsap from "gsap";
import debounce from '../../../derivedFuncs/debounce.js';
import Cell from "../../sharedBoardComponents/Cell.jsx";
import useGameStore from '@/store/useGameStore';
import gameActions from '@/store/gameLogic';
import { useShallow } from "zustand/shallow";
import piecePath from "../../../contexts/PiecePath.js";
import { AudioContext } from "@/contexts/SoundContext";

const GameBoard = memo(({ moveCount, timeOut, moving, pieceIdxArr, winState }) => {
  const { sound } = useContext(AudioContext);
  
  const findIdxByref = (color, ref) => {
    let baseStartIdx = color === 'R' ? 79 : color === 'B' ? 83 : color === 'Y' ? 87 : 91;
    let foundIdx = pieceIdxArr[color].findIndex((el, idx) => {
      if (el === -1) {
        return ref === baseStartIdx - idx;
      } else {
        return piecePath[color][el] === ref;
      }
    });
    return foundIdx;
  };

  const pathRefs = useRef([]);
  const boardRef = useRef(null);
  const chariotRef = useRef(null);
  const audioRef = useRef(null);
  const audioRefFinish = useRef(null);
  
  const { turn, moveAllowed, onBoard, clrR, clrB, clrY, clrG, winR, winB, winY, winG } = useGameStore(
    useShallow(state => ({
      turn: state.move.turn,
      moveAllowed: state.move.moveAllowed,
      onBoard: state.meta.onBoard,
      clrR: state.players.R?.color,
      clrB: state.players.B?.color,
      clrY: state.players.Y?.color,
      clrG: state.players.G?.color,
      winR: state.players.R?.winCount,
      winB: state.players.B?.winCount,
      winY: state.players.Y?.winCount,
      winG: state.players.G?.winCount,
    }))
  );

  const botDifficulty = useGameStore(state => state.players[turn]?.difficulty);

  const COLORS = useMemo(() => ({
    R: clrR, B: clrB, Y: clrY, G: clrG
  }), [clrR, clrB, clrY, clrG]);

  const WinCount = useMemo(() => ({
    R: winR, B: winB, Y: winY, G: winG
  }), [winR, winB, winY, winG]);

  // pieceRef is strictly a Map in the new logic
  const pieceState = {
    R: useGameStore(state => state.players.R?.pieceRef),
    B: useGameStore(state => state.players.B?.pieceRef),
    Y: useGameStore(state => state.players.Y?.pieceRef),
    G: useGameStore(state => state.players.G?.pieceRef)
  };
  
  const transferTurn = gameActions.transferTurn;
  const [pathPoints, setPathPoints] = useState([]);
  const pathPointsRef = useRef([]); // 🐛 FIX: Added mutable ref to fix stale closures
  const [showChariot, setShowChariotDisplay] = useState(false);
  const [chariotColor, setChariotColor] = useState('R');

  const Homes = useMemo(() => ([
    { keyId: "R", color: COLORS.R, base: 76 },
    { keyId: "B", color: COLORS.B, base: 80 },
    { keyId: "Y", color: COLORS.Y, base: 84 },
    { keyId: "G", color: COLORS.G, base: 88 },
  ]), [COLORS]);

  const FinishTriangles = useMemo(() => ([
    { color: COLORS.Y, clip: "polygon(0% 0%, 100% 0%, 50% 50%)", align: "flex justify-center pt-1", ref: 74, rotate: "rotate-225" }, 
    { color: COLORS.G, clip: "polygon(100% 0%, 100% 100%, 50% 50%)", align: "flex items-center justify-end pr-1", ref: 75, rotate: "rotate-315" }, 
    { color: COLORS.R, clip: "polygon(100% 100%, 0% 100%, 50% 50%)", align: "flex justify-center items-end pb-1", ref: 72, rotate: "rotate-45" }, 
    { color: COLORS.B, clip: "polygon(0% 100%, 0% 0%, 50% 50%)", align: "flex items-center pl-1", ref: 73, rotate: "rotate-135" },
  ]), [COLORS]);

  const SAFE_CELLS = new Set([1, 9, 14, 22, 27, 35, 40, 48]);
  const homePointer = new Map([ [12, 0], [25, 90], [38, 180], [51, 270] ]);

  const playSound = (playCase = -1) => {
    if (playCase === -1 || !sound) return;
    if (playCase === 1 && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play();
    } else if (playCase === 2 && audioRefFinish.current) {
      audioRefFinish.current.currentTime = 0;
      audioRefFinish.current.play();
    }
  };

  const pathPointCalculator = () => {
    if (!pathRefs.current[0] || !boardRef.current) return;
    const boardRect = boardRef.current.getBoundingClientRect();
    
    const tempPts = [];
    pathRefs.current.forEach((el, index) => {
      if (el) {
        const rect = el.getBoundingClientRect();
        tempPts[index] = {
          cx: rect.left - boardRect.left + (rect.width / 2) - 1.8,
          cy: rect.top - boardRect.top + (rect.height / 2) - 1.8,
          w: rect.width,
          h: rect.height
        };
      }
    });
    setPathPoints(tempPts);
    pathPointsRef.current = tempPts; // 🐛 FIX: Sync the calculated points to the ref immediately
  };

  useEffect(() => {
    pathPointCalculator();
    const resizeHandler = debounce(pathPointCalculator, 100);
    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, []);

  const oneStepAnimation = (from, to) => {
    return new Promise(resolve => {
      // 🐛 FIX: Read coordinates from the mutable ref, not the stale state closure
      const pts = pathPointsRef.current;

      if (!pts[from] || !pts[to] || !chariotRef.current) {
        resolve();
        return;
      }
      const targetW = pts[to].w;
      const targetH = pts[to].h;

      gsap.fromTo(
        chariotRef.current,
        {
          x: pts[from].cx - targetW / 2,
          y: pts[from].cy - targetH / 2,
          width: pts[from].w,
          height: pts[from].h
        },
        {
          x: pts[to].cx - targetW / 2,
          y: pts[to].cy - targetH / 2,
          width: pts[to].w,
          height: pts[to].h,
          duration: 0.5, 
          ease: "power1.inOut",
          onComplete: resolve
        }
      );
      
      const finalCells = new Set([72, 73, 74, 75]);
      if (finalCells.has(to)) playSound(2);
      else playSound(1);
    });
  };

  const setMoving = gameActions.setMoving;
  const reRoll = useRef(1);
  const inputLockedRef = useRef(false);

  const runChariot = async (idx = -1, refNum = null, stepCount = -1, turnColor = '') => {
    if (idx < 0 || refNum === null || stepCount === -1 || !turnColor) return;
    let from = refNum;
    let to = null;
    setChariotColor(turnColor);
    
    if (stepCount === -2) {
      const baseStart = turnColor === 'R' ? 79 : turnColor === 'B' ? 83 : turnColor === 'Y' ? 87 : 91;
      to = baseStart - idx;
      gameActions.updatePieceState(turnColor, idx, from, -1, 0);
      setShowChariotDisplay(true);
      setMoving(true);
      await oneStepAnimation(from, to);
      setMoving(false);
      setShowChariotDisplay(false);
      gameActions.updatePieceState(turnColor, idx, to, +1, -2);
      reRoll.current = turnColor === turn && moveCount !== 6 ? 1 : 2;
      return;
    }

    let indexVal = pieceIdxArr[turnColor][idx];
    gameActions.updatePieceState(turnColor, idx, refNum, -1, 0);
    setShowChariotDisplay(true);
    setMoving(true);
    for (let step = 1; step <= stepCount; step++) {
      from = step === 1 ? refNum : piecePath[turnColor][indexVal + step - 1];
      to = piecePath[turnColor][indexVal + step];
      gameActions.updatePieceState(turnColor, idx, null, 0, 1);
      await oneStepAnimation(from, to);
    }
    setMoving(false);
    setShowChariotDisplay(false);
    gameActions.updatePieceState(turnColor, idx, to, +1, 0);
    afterPieceMove(turnColor, idx, to, refNum);
  };

  const afterPieceMove = async (curColor = '', curArrIdx = -1, curPieceRef = -1, prePieceRef = -1) => {
    if (!curColor || curArrIdx < 0 || curPieceRef < 0 || prePieceRef < 0) return;
    
    // Get fresh state after animation to ensure Map is up to date
    const freshState = useGameStore.getState().players;
    const currentPieceState = {
      R: freshState.R?.pieceRef,
      B: freshState.B?.pieceRef,
      Y: freshState.Y?.pieceRef,
      G: freshState.G?.pieceRef
    };

    if (!SAFE_CELLS.has(curPieceRef)) {
      let myCount = currentPieceState[curColor].get(curPieceRef) ?? 0;
      let opponentTotal = 0;
      let maxOpponentCount = 0;
      let maxOpponentColor = '';

      // ✅ ADDED ONBOARD CHECK: Ensures we don't calculate Skeleton ghost players
      for (const color of ['R', 'B', 'Y', 'G']) {
        if (color === curColor || !onBoard.has(color)) continue;
        
        const cnt = currentPieceState[color].get(curPieceRef) ?? 0;
        opponentTotal += cnt;
        if (cnt > maxOpponentCount) {
          maxOpponentCount = cnt;
          maxOpponentColor = color;
        }
      }

      if (opponentTotal === 1) {
        const cutIdx = findIdxByref(maxOpponentColor, curPieceRef);
        if (cutIdx !== -1) {
          await runChariot(cutIdx, curPieceRef, -2, maxOpponentColor);
          reRoll.current = 2;
        }
      }
      else if (myCount < maxOpponentCount && maxOpponentCount === opponentTotal) {
        await runChariot(curArrIdx, curPieceRef, -2, curColor);
        reRoll.current = 2;
      }
      else if (myCount >= opponentTotal && opponentTotal > 0) {
        for (const color of ['R', 'B', 'Y', 'G']) {
          if (color === curColor || !onBoard.has(color)) continue;
          
          let cnt = currentPieceState[color].get(curPieceRef) ?? 0;
          while (cnt-- > 0) {
            const cutIdx = findIdxByref(color, curPieceRef);
            if (cutIdx !== -1) {
              await runChariot(cutIdx, curPieceRef, -2, color);
              reRoll.current = 2;
            }
          }
        }
      }
    }

    if (SAFE_CELLS.has(prePieceRef)) return;
    let myCount = currentPieceState[curColor].get(prePieceRef) ?? 0;
    if (myCount === 0) return;
    
    let opponentTotal = 0;
    let maxOpponentCount = 0;
    let maxOpponentColor = '';
    
    // ✅ ADDED ONBOARD CHECK
    for (const color of ['R', 'B', 'Y', 'G']) {
      if (color === curColor || !onBoard.has(color)) continue;
      
      const cnt = currentPieceState[color].get(prePieceRef) ?? 0;
      opponentTotal += cnt;
      if (cnt > maxOpponentCount) {
        maxOpponentCount = cnt;
        maxOpponentColor = color;
      }
    }
    
    if (myCount < maxOpponentCount && maxOpponentCount === opponentTotal) {
      await runChariot(curArrIdx, prePieceRef, -2, curColor);
    }
  };

  const determineAndProcessClickCell = async (refNum) => {
    if (!moveAllowed || moving || inputLockedRef.current) return;
    inputLockedRef.current = true;
    reRoll.current = 1;
    
    const pieceCount = pieceState[turn].get(refNum) ?? 0;
    if (!pieceCount) {
      inputLockedRef.current = false;
      return;
    }
    
    const idx = findIdxByref(turn, refNum);
    if (idx === -1) {
      inputLockedRef.current = false;
      return;
    }
    
    let steps = moveCount;
    if (pieceIdxArr[turn][idx] === -1 && moveCount !== 6) {
      inputLockedRef.current = false;
      return;
    }
    if (pieceIdxArr[turn][idx] === -1) steps = 1;
    if (moveCount === 6) reRoll.current = 0;
    if (56 - pieceIdxArr[turn][idx] < moveCount) {
      inputLockedRef.current = false;
      return;
    }

    await runChariot(idx, refNum, steps, turn);
    setTimeout(() => {
      transferTurn(reRoll.current);
      inputLockedRef.current = false;
    }, 600);
  };

  const smartAutoMovePieces = (diff) => {
    const pieces = pieceIdxArr[turn];
    const movable = [];

    pieces.forEach((v, idx) => {
      if ((v !== -1 && 56 - v >= moveCount) || (v === -1 && moveCount === 6)) {
        movable.push(idx);
      }
    });

    if (movable.length === 0) return;

    let selectedIdx = movable[Math.floor(Math.random() * movable.length)]; 

    if (diff !== 'easy') {
      let bestScore = -Infinity;

      for (let idx of movable) {
        let score = 0;
        let v = pieces[idx];
        let targetRef = -1;

        if (v === -1 && moveCount === 6) {
          targetRef = (turn === 'R' ? 79 : turn === 'B' ? 83 : turn === 'Y' ? 87 : 91) - idx;
          score += 50; 
        } else {
          targetRef = piecePath[turn][v + moveCount];
          if (v + moveCount === 56) score += 100; 
          if (SAFE_CELLS.has(targetRef)) score += 30; 
        }

        if (targetRef !== -1 && !SAFE_CELLS.has(targetRef)) {
           let opponentCount = 0;
           let isMyPieceThere = (pieceState[turn]?.get(targetRef) || 0) > 0;
           
           // ✅ ADDED ONBOARD CHECK
           for (const c of ['R', 'B', 'Y', 'G']) {
             if (c !== turn && onBoard.has(c)) {
               opponentCount += (pieceState[c]?.get(targetRef) || 0);
             }
           }
           if (opponentCount === 1 && !isMyPieceThere) score += 80; 
        }

        if (diff === 'medium') score += Math.random() * 50;

        if (score > bestScore) {
          bestScore = score;
          selectedIdx = idx;
        }
      }
    }

    const ref = pieces[selectedIdx] === -1
      ? (turn === 'R' ? 79 : turn === 'B' ? 83 : turn === 'Y' ? 87 : 91) - selectedIdx
      : piecePath[turn][pieces[selectedIdx]];

    determineAndProcessClickCell(ref);
  };

  useEffect(() => {
    if (!timeOut || moving || !moveAllowed) return;
    smartAutoMovePieces('easy'); 
  }, [timeOut, moving, moveAllowed]);

  useEffect(() => {
    if (botDifficulty && moveAllowed && !moving && !inputLockedRef.current) {
      const thinkDelay = botDifficulty === 'hard' ? 600 : botDifficulty === 'medium' ? 1000 : 1500;
      
      const timer = setTimeout(() => {
        smartAutoMovePieces(botDifficulty);
      }, thinkDelay);

      return () => clearTimeout(timer);
    }
  }, [botDifficulty, moveAllowed, moving, turn, moveCount]);

  return (
    <div
      className="boardContainer relative grid gap-[2px] rounded-xl max-w-full max-h-full p-0 shadow-2xl aspect-square"
      style={{ background: '#020205', boxShadow: '0 0 50px rgba(0,0,0,0.8)' }}
      ref={boardRef}
    >
      {/* --- STANDARD CELLS --- */}
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
              className={`cell w-full h-full flex items-center justify-center rounded-[3px] bg-white/5 backdrop-blur-sm border box-border`}
              style={{
                borderColor: neonColor ? neonColor : cellBorderColor,
                boxShadow: neonColor ? `inset 0 0 15px ${neonColor}33` : 'none',
              }}
              ref={(el) => (pathRefs.current[i] = el)}
            >
              {isSafe && !neonColor && <Shield size={16} className="text-white/20 absolute inset-0 m-auto animate-pulse" />}
              {isSafe && neonColor && <Shield size={16} color={neonColor} className="absolute inset-0 m-auto animate-pulse" />}
              {isHomePointer && (
                <div className="absolute" style={{ transform: `rotate(${homePointer.get(i)}deg)` }}>
                   <ChevronRight size={20} className="text-white/40" />
                </div>
              )}
              <Cell R={pieceState.R?.get(i) ?? 0} B={pieceState.B?.get(i) ?? 0} Y={pieceState.Y?.get(i) ?? 0} G={pieceState.G?.get(i) ?? 0} activeColor={turn} COLORS={COLORS} moveAllowed={moveAllowed} />
            </div>
          </div>
        );
      })}

      {/* --- TRACKS --- */}
      {["R", "B", "Y", "G"].map((c, i) =>
        [1, 2, 3, 4, 5].map((n, j) => {
          const trackColor = c === 'R' ? COLORS.R : c === 'B' ? COLORS.B : c === 'Y' ? COLORS.Y : COLORS.G;
          return (
            <div
              className={`track${c}${n} relative flex items-center justify-center rounded-[4px] aspect-square cursor-pointer`}
              key={`${c}${n}`}
              onClick={() => determineAndProcessClickCell(i * 5 + j + 52)}
            >
              <div
                className={`cell w-full h-full rounded-[3px] flex items-center justify-center bg-black/40 border transition-all`}
                style={{ borderColor: trackColor, boxShadow: `inset 0 0 8px ${trackColor}44` }}
                ref={(el) => (pathRefs.current[i * 5 + j + 52] = el)}
              >
                <div className="absolute w-1 h-1 rounded-full opacity-50" style={{backgroundColor: trackColor}}/>
                <Cell R={pieceState.R?.get(i * 5 + j + 52) ?? 0} B={pieceState.B?.get(i * 5 + j + 52) ?? 0} Y={pieceState.Y?.get(i * 5 + j + 52) ?? 0} G={pieceState.G?.get(i * 5 + j + 52) ?? 0} activeColor={turn} COLORS={COLORS} moveAllowed={moveAllowed} />
              </div>
            </div>
          );
        })
      )}

      {/* --- HOMES --- */}
      {Homes.map(({ keyId, color, base }) => (
        <div className={`home${keyId} relative p-2 flex flex-col items-center justify-center rounded-[10%] bg-black/20`} key={keyId}>
          <div className={`w-full h-full rounded-[8%] flex items-center justify-center relative overflow-hidden`} style={{ border: `1px solid ${color}44`, boxShadow: `inset 0 0 30px ${color}11` }}>
            <div className="absolute inset-0 opacity-20" style={{backgroundImage: `linear-gradient(${color} 1px, transparent 1px), linear-gradient(90deg, ${color} 1px, transparent 1px)`, backgroundSize: '20px 20px'}}></div>

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
                    {/* ✅ Hides the Ban icon AND pieces if the player is a Skeleton (not onBoard) */}
                    {!(onBoard.has(keyId)) && <Ban size={10} className="opacity-50 absolute" />}
                    {(onBoard.has(keyId)) && (
                      <Cell R={pieceState.R?.get(base + i) ?? 0} B={pieceState.B?.get(base + i) ?? 0} Y={pieceState.Y?.get(base + i) ?? 0} G={pieceState.G?.get(base + i) ?? 0} activeColor={turn} COLORS={COLORS} moveAllowed={moveAllowed} />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                 <div className="absolute inset-0 animate-pulse opacity-20 bg-gradient-to-t from-transparent to-white/10"/>
                 <Trophy size={48} color={color} className="mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]"/>
                 <span className="text-2xl font-black" style={{color: color, textShadow: `0 0 10px ${color}`}}>{winState[keyId]}</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {/* --- FINISH --- */}
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
              style={{ backgroundColor: color, clipPath: clip, opacity: turn === (ref === 72 ? 'R' : ref === 73 ? 'B' : ref === 74 ? 'Y' : 'G') ? 0.4 : 0.15, filter: turn === (ref === 72 ? 'R' : ref === 73 ? 'B' : ref === 74 ? 'Y' : 'G') ? `drop-shadow(0 0 15px ${color})` : 'none' }}
            >
              <div className="w-full h-full bg-gradient-to-br from-white/30 via-transparent to-black/40" />
            </div>
          ))}
          
          {FinishTriangles.map(({ ref, align, rotate }) => (
              <div key={`ref-${ref}`} className={`absolute inset-0 ${align} pointer-events-none p-2`}>
                  <div ref={el => (pathRefs.current[ref] = el)} className={`h-1/3 aspect-square flex items-center justify-center ${rotate}`}>
                      <Cell R={(ref === 72) && WinCount['R']} B={(ref === 73) && WinCount['B']} Y={(ref === 74) && WinCount['Y']} G={(ref === 75) && WinCount['G']} COLORS={COLORS} className="scale-125 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]" />
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

      {/* --- CHARIOT --- */}
      <div
        ref={chariotRef}
        className="piece absolute z-[100] pointer-events-none text-white bg-amber-2000 flex items-center justify-center aspect-square"
        // 🐛 FIX: Used pathPoints[1]?.w instead of .width to match the property mapped in the calculator
        style={{ width: pathPoints[1]?.w || `auto`, display: (showChariot) ? "flex" : "none", filter: 'drop-shadow(0 0 15px white)' }}
      >
        <Cell R={chariotColor === 'R'} B={chariotColor === 'B'} Y={chariotColor === 'Y'} G={chariotColor === 'G'} COLORS={COLORS} />
      </div>

      <audio ref={audioRef} src={SlideEffect} preload="auto" />
      <audio ref={audioRefFinish} src={FinishSound} preload="auto" />
    </div>
  );
});

export default GameBoard;