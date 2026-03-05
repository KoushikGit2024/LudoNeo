import { useEffect, useRef, useState, useMemo } from "react";
import DiceFace from "../../sharedBoardComponents/DiceFace";
import '../../../styles/dice.css'; 
import DiceRoll from "../../../assets/DiceRoll.mp3";
import { Sparkles, Lock } from "lucide-react"; 

// Receives socket, gameId, and store states from LudoOnline
const Dice = ({ turn, rollAllowed, gameFinished, sound, socket, gameId, isOnline }) => {
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState(1);
  const audioRef = useRef(null);

  // --- AUDIO LOGIC ---
  const playSound = () => {
    if (!audioRef.current || !sound) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  // --- USER ACTION ---
  const handleUserClick = () => {
    // Prevent clicking if not allowed, already rolling, or game over
    if (rolling || !rollAllowed || gameFinished) return;
    
    // Only allow clicking if we are online and have a socket
    if (isOnline && socket) {
       // Ask server to generate the roll
       socket.emit("roll-dice", { gameId, color: turn });
    }
  };

  // --- SERVER RESPONSE LISTENER ---
  useEffect(() => {
    if (!isOnline || !socket) return;

    // Listen for the server telling us the outcome of a roll
    const handleDiceRolled = ({ value: finalValue }) => {
      // Start visual animation locally
      setRolling(true);
      playSound();

      // Scramble numbers quickly for visual effect
      const interval = setInterval(() => {
        setValue(Math.floor(Math.random() * 6) + 1);
      }, 100);

      // Stop scrambling and show the REAL value sent by the server
      setTimeout(() => {
        clearInterval(interval);
        setValue(finalValue); // Set to server's true value
        setRolling(false);
        
        // Note: LudoOnline handles syncing the new game state (moveAllowed, moveCount, etc.)
        // immediately after this event is received, so we don't need to do it here.
      }, 500); // 500ms animation duration
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
        cursor: (rollAllowed && !gameFinished) ? 'pointer' : 'not-allowed',
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
         {(!rollAllowed || gameFinished) && <Lock size={12} className="text-gray-500 opacity-50" />}
         {(rollAllowed && !rolling && !gameFinished) && <Sparkles size={12} className="animate-ping" style={{color: activeColor}} />}
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