import { useEffect, useRef, useState, useMemo, useContext } from "react";
import DiceFace from "../../sharedBoardComponents/DiceFace";
import '../../../styles/dice.css'; 
import DiceRoll from "../../../assets/DiceRoll.mp3";
import { Sparkles, Lock } from "lucide-react"; 
import { AudioContext } from "@/contexts/SoundContext";
import onlineGameActions from '@/store/onlineGameLogic'; 
import gameActions from '@/store/gameLogic'; 
import useGameStore from '@/store/useGameStore'; // Added to check global state for fallback

const Dice = ({ turn, rollAllowed, gameFinished, socket, gameId, isOnline, myColor }) => {
  const { sound } = useContext(AudioContext);
  const [rolling, setRolling] = useState(false);
  const [value, setValue] = useState(1);
  const audioRef = useRef(null);
  
  // Track if we are currently awaiting a server response to prevent double emits
  const isAwaitingServerRef = useRef(false);

  const isMyTurn = !isOnline || (myColor === turn);
  const canRoll = rollAllowed && !gameFinished && isMyTurn;

  const playSound = () => {
    if (!audioRef.current || !sound) return;
    audioRef.current.currentTime = 0;
    audioRef.current.play();
  };

  const handleUserClick = () => {
    if (rolling || isAwaitingServerRef.current || !canRoll) return;
    
    // 1. Instantly lock the UI (Optimistic Update)
    setRolling(true);
    isAwaitingServerRef.current = true;
    playSound();
    
    // Start visual fake roll immediately for instant feedback
    const fakeRollInterval = setInterval(() => setValue(Math.floor(Math.random() * 6) + 1), 100);

    if (isOnline && socket) {
       socket.emit("roll-dice", { gameId, color: turn });
       
       // Safety Fallback: If server drops the packet, unlock after 2 seconds
       setTimeout(() => {
          if (isAwaitingServerRef.current) {
             console.warn("[NETWORK] Dice roll timed out. Unlocking.");
             clearInterval(fakeRollInterval);
             isAwaitingServerRef.current = false;
             setRolling(false);
          }
       }, 2000);

    } else if (!isOnline) {
       setTimeout(() => {
         clearInterval(fakeRollInterval);
         const finalValue = Math.floor(Math.random() * 6) + 1;
         setValue(finalValue);
         setRolling(false);
         isAwaitingServerRef.current = false;
         gameActions.updateMoveCount(finalValue); 
       }, 500);
    }

    // Attach interval to ref so we can clear it when the server responds
    audioRef.current.fakeRollInterval = fakeRollInterval;
  };
  
  useEffect(() => {
    if (!isOnline || !socket) return;

    const handleDiceRolled = ({ value: finalValue, moveUpdates, syncArray }) => {
      // Clear the optimistic fake roll
      if (audioRef.current?.fakeRollInterval) {
        clearInterval(audioRef.current.fakeRollInterval);
      }

      // Ensure sound plays if it was triggered by another player
      if (!isAwaitingServerRef.current) {
        setRolling(true);
        playSound();
      }

      // Brief visual flutter to transition to final value
      const resolveInterval = setInterval(() => {
        setValue(Math.floor(Math.random() * 6) + 1);
      }, 50);

      setTimeout(() => {
        clearInterval(resolveInterval);
        setValue(finalValue); 
        setRolling(false);
        isAwaitingServerRef.current = false;
        
        onlineGameActions.patchDeltaState({ move: moveUpdates }, syncArray[1]);
      }, 300); 
    };

    socket.on("dice-rolled", handleDiceRolled);
    return () => socket.off("dice-rolled", handleDiceRolled);
  }, [socket, isOnline]);

  const DICE_COLORS = useMemo(() => ({ R: "#ff0505", B: "#2b01ff", Y: "#fff200", G: "#00ff3c" }), []);
  const activeColor = DICE_COLORS[turn] || "#ffffff";

  return (
    <div
      className="dice-cover relative w-full h-full flex items-center justify-center p-[10%]"
      onClick={handleUserClick}
      style={{ cursor: canRoll ? 'pointer' : 'not-allowed' }}
    >
      <div 
        className={`absolute inset-0 rounded-full transition-all duration-500 blur-xl opacity-20`}
        style={{
          background: canRoll ? `radial-gradient(circle, ${activeColor}, transparent 70%)` : 'transparent',
          transform: rolling ? 'scale(1.2)' : 'scale(1)'
        }}
      />

      <div className="absolute -top-1 right-0 z-20">
         {(!rollAllowed || gameFinished) && <Lock size={12} className="text-gray-500 opacity-50" />}
         {(canRoll && !rolling) && <Sparkles size={12} className="animate-ping" style={{color: activeColor}} />}
      </div>

      <div
        className={`dice-container relative z-10 w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-300
          ${rolling ? "rolling" : ""} 
          ${(!rollAllowed || gameFinished) ? "grayscale opacity-50 scale-90" : "scale-100"}
        `}
        style={{
          backgroundColor: '#e6e6e6', 
          boxShadow: rollAllowed ? `0 0 20px ${activeColor}, inset 0 0 10px white` : 'inset 0 0 10px black',
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