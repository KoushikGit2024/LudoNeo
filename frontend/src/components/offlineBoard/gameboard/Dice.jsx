
import { useEffect, useRef, useState, useMemo } from "react";
import DiceFace from "../../sharedBoardComponents/DiceFace";
import '../../../styles/dice.css'; // Preserving your CSS import
import useGameStore from '@/store/useGameStore'
import gameActions from '@/store/gameLogic'
import DiceRoll from "../../../assets/DiceRoll.mp3";
import { Sparkles, Lock } from "lucide-react"; // Icons for status
import { Bounce, toast } from "react-toastify";

const Dice = ({ pieceIdx, ticks, gameFinished, homeCount, rollAllowed, turn, winState, sound }) => {
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState(1);
  
  // --- STORE HOOKS (Unchanged) ---
  const pathCount = useGameStore((state) => state.players[turn]?.pathCount);
  const timeOut = useGameStore((state) => state.move.timeOut);


  const updateMoveCount = gameActions.updateMoveCount;
  const transferTurn = gameActions.transferTurn;
  
  const updateTimeOut = gameActions.updateTimeOut
  const audioRef = useRef(null);

  // --- LOGIC (Unchanged) ---
  const playSound = () => {
    if (!audioRef.current || !sound) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const rollDice = () => {
    if (rolling || !rollAllowed) return;
    if (winState[turn] !== 0) {
      console.log('Player won transfer next');
      transferTurn(1);
      return;
    }
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
      } while (ticks >= 2 && final === 6);
      setValue(final);
      setRolling(false);
      setTimeout(() => {
        afterDiceRoll(final);
      }, 500);
    }, 0.10);//1900
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

  useEffect(() => {
    if (gameFinished) {
      alert('game is Finished');
      return;
    }
    if (!timeOut || gameFinished) return;
    if (rollAllowed) {
      rollDice();
      updateTimeOut(false);
    }
    // console.log('hi')
  }, [timeOut]);

  // --- VISUAL & THEME CONSTANTS ---
  const DICE_COLORS = useMemo(() => ({
    R: "#ff0505", // Red
    B: "#2b01ff", // Blue
    Y: "#fff200", // Yellow
    G: "#00ff3c"  // Green
  }), []);

  const activeColor = DICE_COLORS[turn] || "#ffffff";

  return (
    <div
      className="dice-cover relative w-full h-full flex items-center justify-center p-[10%]"
      onClick={rollDice}
      style={{
        cursor: (rollAllowed) ? 'pointer' : 'not-allowed',
      }}
    >
      {/* 1. Ambient Glow Ring (Pulses when active) */}
      <div 
        className={`absolute inset-0 rounded-full transition-all duration-500 blur-xl opacity-20`}
        style={{
          background: rollAllowed ? `radial-gradient(circle, ${activeColor}, transparent 70%)` : 'transparent',
          transform: rolling ? 'scale(1.2)' : 'scale(1)'
        }}
      />

      {/* 2. Status Icons (Floating above) */}
      <div className="absolute -top-1 right-0 z-20">
         {!rollAllowed && <Lock size={12} className="text-gray-500 opacity-50" />}
         {rollAllowed && !rolling && <Sparkles size={12} className="animate-ping" style={{color: activeColor}} />}
      </div>

      {/* 3. The Dice Cube Container */}
      <div
        className={`dice-container relative z-10 w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-300
          ${rolling ? "rolling" : ""} 
          ${!rollAllowed ? "grayscale opacity-50 scale-90" : "scale-100"}
        `}
        style={{
          backgroundColor: '#e6e6e6', // Slight off-white to act as a "light source"
          boxShadow: rollAllowed 
            ? `0 0 20px ${activeColor}, inset 0 0 10px white` 
            : 'inset 0 0 10px black',
          border: `2px solid ${rollAllowed ? 'white' : '#333'}`,
        }}
      >
        {/* Dice Face Render */}
        <div className="w-full h-full flex items-center justify-center p-1">
          {/* We wrap the Face to control color tinting if needed via mix-blend-mode or just let it sit */}
           <DiceFace value={value} />
        </div>

        {/* Glossy Overlay for "Glass" effect */}
        <div className="absolute inset-0 rounded-xl bg-gradient-to-tr from-white/40 to-transparent pointer-events-none" />
      </div>

      <audio ref={audioRef} src={DiceRoll} preload="auto" />
    </div>
  );
};

export default Dice;