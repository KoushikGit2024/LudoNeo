import { useEffect, useRef, useState, useMemo, useContext } from "react";
import DiceFace from "../../sharedBoardComponents/DiceFace";
import '../../../styles/dice.css'; 
import useGameStore from '@/store/useGameStore'
import gameActions from '@/store/gameLogic'
import DiceRoll from "../../../assets/DiceRoll.mp3";
import { Sparkles, Lock } from "lucide-react"; 
import { AudioContext } from "@/contexts/SoundContext";

const Dice = ({ pieceIdx, ticks, gameFinished, homeCount, rollAllowed, turn, winState }) => {
  const moveCount = useGameStore(state => state?.move?.moveCount)
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState(moveCount || 1);
  const { sound } = useContext(AudioContext)
  
  // --- STORE HOOKS ---
  const pathCount = useGameStore((state) => state.players[turn]?.pathCount);
  const timeOut = useGameStore((state) => state.move.timeOut);
  const botDifficulty = useGameStore((state) => state.players[turn]?.difficulty); // ✅ Check if bot

  const updateMoveCount = gameActions.updateMoveCount;
  const transferTurn = gameActions.transferTurn;
  const updateTimeOut = gameActions.updateTimeOut;
  const audioRef = useRef(null);

  // ✅ Synchronous lock to prevent rapid double-clicks bypassing React state
  const isRollingRef = useRef(false);

  const playSound = () => {
    if (!audioRef.current || !sound) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  // ✅ Gatekeeper for human interaction
  const handleUserClick = () => {
    if (botDifficulty || isRollingRef.current || !rollAllowed) return;
    rollDice();
  };

  const rollDice = () => {
    // Failsafe checks
    if (isRollingRef.current || !rollAllowed) return;
    
    if (winState[turn] !== 0) {
      transferTurn(1);
      return;
    }

    // Lock the dice instantly
    isRollingRef.current = true;
    setRolling(true);
    playSound();
    
    const interval = setInterval(() => {
      setValue(Math.floor(Math.random() * 6) + 1);
    }, 100);
    
    setTimeout(() => {
      clearInterval(interval);
      let final;
      do {
        final = Math.floor(Math.random() * 6) + 1;
      } while (ticks >= 2 && final === 6); // Prevent 3 sixes in a row
      
      setValue(final);
      
      // Stop the visual animation and release the lock safely
      setRolling(false);
      isRollingRef.current = false; 
      
      setTimeout(() => {
        afterDiceRoll(final);
      }, 500);
    }, 1900);
  };

  const afterDiceRoll = (final) => {
    updateMoveCount(final);

    if ((homeCount === 4 && final !== 6) || pathCount === 0) {
      transferTurn(1);
      return;
    }

    const pieces = pieceIdx[turn];
    const canMove = pieces.some(
      val =>
        (val !== -1 && 56 - val >= final) ||
        (val === -1 && final === 6)
    );

    if (!canMove) {
      transferTurn(1);
    }
  };

  // --- AUTOMATION EFFECTS ---

  // 1. Human Timeout Auto-Roll
  useEffect(() => {
    if (gameFinished) return;
    if (!timeOut) return;
    if (rollAllowed && !isRollingRef.current) {
      rollDice();
      updateTimeOut(false);
    }
  }, [timeOut, gameFinished, rollAllowed]);

  // 2. ✅ Bot Auto-Roll based on Difficulty
  useEffect(() => {
    if (gameFinished || !botDifficulty || !rollAllowed || isRollingRef.current) return;

    // Simulate "thinking" time based on difficulty
    const thinkDelay = botDifficulty === 'hard' ? 400 : botDifficulty === 'medium' ? 800 : 1200;
    
    const timer = setTimeout(() => {
      rollDice();
    }, thinkDelay);

    return () => clearTimeout(timer);
  }, [botDifficulty, rollAllowed, turn, gameFinished]);

  // --- VISUAL & THEME CONSTANTS ---
  const DICE_COLORS = useMemo(() => ({
    R: "#ff0505", 
    B: "#2b01ff", 
    Y: "#fff200", 
    G: "#00ff3c"  
  }), []);

  const activeColor = DICE_COLORS[turn] || "#ffffff";
  
  // ✅ Determine if the UI should show as "interactable" for the human
  const isHumanTurnInteractable = rollAllowed && !botDifficulty && !rolling;

  return (
    <div
      className="dice-cover relative w-full h-full flex items-center justify-center p-[10%]"
      onClick={handleUserClick} // ✅ Safely routed through human click handler
      style={{
        cursor: isHumanTurnInteractable ? 'pointer' : 'not-allowed',
        // ✅ Physically prevents clicks while rolling or during bot turns
        pointerEvents: isHumanTurnInteractable ? 'auto' : 'none'
      }}
    >
      <div 
        className={`absolute inset-0 rounded-full transition-all duration-500 blur-xl opacity-20`}
        style={{
          background: rollAllowed ? `radial-gradient(circle, ${activeColor}, transparent 70%)` : 'transparent',
          transform: rolling ? 'scale(1.2)' : 'scale(1)'
        }}
      />
      <div className="absolute -top-1 right-0 z-20">
         {!rollAllowed && <Lock size={12} className="text-gray-500 opacity-50" />}
         {/* Show sparkle ONLY if it's waiting for the human to click */}
         {isHumanTurnInteractable && <Sparkles size={12} className="animate-ping" style={{color: activeColor}} />}
      </div>
      <div
        className={`dice-container relative z-10 w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-300
          ${rolling ? "rolling" : ""} 
          ${!rollAllowed ? "grayscale opacity-50 scale-90" : "scale-100"}
        `}
        style={{
          backgroundColor: '#e6e6e6', 
          boxShadow: rollAllowed 
            ? `0 0 20px ${activeColor}, inset 0 0 10px white` 
            : 'inset 0 0 10px black',
          border: `2px solid ${rollAllowed ? 'white' : '#333'}`,
        }}
      >
        <div className="w-full h-full flex items-center justify-center p-1">
           <DiceFace value={value} />
        </div>
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/40 to-transparent pointer-events-none" />
      </div>
      <audio ref={audioRef} src={DiceRoll} preload="auto" />
    </div>
  );
};

export default Dice;