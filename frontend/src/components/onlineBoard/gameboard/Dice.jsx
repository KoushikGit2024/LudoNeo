import { useEffect, useRef, useState, useMemo, useContext } from "react";
import DiceFace from "../../sharedBoardComponents/DiceFace";
import '../../../styles/dice.css'; 
import DiceRoll from "../../../assets/DiceRoll.mp3";
import { Sparkles, Lock } from "lucide-react"; 
import { AudioContext } from "@/contexts/SoundContext";

// ✅ Added myColor prop for frontend validation
const Dice = ({ turn, rollAllowed, gameFinished, socket, gameId, isOnline, myColor }) => {
  const { sound } = useContext(AudioContext);
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState(1);
  const audioRef = useRef(null);

  // ✅ Security Check: Is it actually this client's turn?
  const isMyTurn = !isOnline || (myColor === turn);
  const canRoll = rollAllowed && !gameFinished && isMyTurn;

  // --- AUDIO LOGIC ---
  const playSound = () => {
    if (!audioRef.current || !sound) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  // --- USER ACTION ---
  const handleUserClick = () => {
    // ✅ Prevent clicking if not allowed, not your turn, already rolling, or game over
    if (rolling || !canRoll) return;
    
    // Online Flow
    if (isOnline && socket) {
       socket.emit("roll-dice", { gameId, color: turn });
    } 
    // Offline Flow 
    else if (!isOnline) {
       setRolling(true);
       playSound();
       const interval = setInterval(() => {
         setValue(Math.floor(Math.random() * 6) + 1);
       }, 100);

       setTimeout(() => {
         clearInterval(interval);
         const finalValue = Math.floor(Math.random() * 6) + 1;
         setValue(finalValue);
         setRolling(false);
       }, 500);
    }
  };

  // --- SERVER RESPONSE LISTENER (ONLINE ONLY) ---
  useEffect(() => {
    if (!isOnline || !socket) return;

    const handleDiceRolled = ({ value: finalValue }) => {
      setRolling(true);
      playSound();

      const interval = setInterval(() => {
        setValue(Math.floor(Math.random() * 6) + 1);
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
        setValue(finalValue); 
        setRolling(false);
      }, 500); 
    };

    socket.on("dice-rolled", handleDiceRolled);

    return () => {
      socket.off("dice-rolled", handleDiceRolled);
    };
  }, [socket, isOnline]);

  // --- VISUAL & THEME CONSTANTS ---
  const DICE_COLORS = useMemo(() => ({
    R: "#ff0505", 
    B: "#2b01ff", 
    Y: "#fff200", 
    G: "#00ff3c"  
  }), []);

  const activeColor = DICE_COLORS[turn] || "#ffffff";

  return (
    <div
      className="dice-cover relative w-full h-full flex items-center justify-center p-[10%]"
      onClick={handleUserClick}
      style={{
        // ✅ Only show pointer cursor if it's ACTUALLY your turn
        cursor: canRoll ? 'pointer' : 'not-allowed',
      }}
    >
      {/* 1. Ambient Glow Ring (Pulses when active AND it's your turn) */}
      <div 
        className={`absolute inset-0 rounded-full transition-all duration-500 blur-xl opacity-20`}
        style={{
          background: canRoll ? `radial-gradient(circle, ${activeColor}, transparent 70%)` : 'transparent',
          transform: rolling ? 'scale(1.2)' : 'scale(1)'
        }}
      />

      {/* 2. Status Icons */}
      <div className="absolute -top-1 right-0 z-20">
         {(!rollAllowed || gameFinished) && <Lock size={12} className="text-gray-500 opacity-50" />}
         {/* ✅ Only show the sparkle if it's YOUR turn to roll */}
         {(canRoll && !rolling) && <Sparkles size={12} className="animate-ping" style={{color: activeColor}} />}
      </div>

      {/* 3. The Dice Cube Container */}
      <div
        className={`dice-container relative z-10 w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-300
          ${rolling ? "rolling" : ""} 
          ${(!rollAllowed || gameFinished) ? "grayscale opacity-50 scale-90" : "scale-100"}
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