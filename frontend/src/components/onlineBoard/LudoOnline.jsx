import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Zap, Trophy, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

import GameBoard    from './gameboard/GameBoard.jsx';
import Dice         from './gameboard/Dice';
import PlayerBoard  from './gameboard/PlayerBoard';
import useGameStore from '@/store/useGameStore';
import useUserStore from '@/store/userStore';
import gameActions  from '@/store/gameLogic';
import onlineGameActions from '@/store/onlineGameLogic';
import { useShallow } from 'zustand/shallow';
import ErrorBoundary from '../../ErrorBoundary';
import GradientText from '@/components/customComponents/GradientText';
import { toast } from 'react-toastify';
import LudoSkeleton from '../sharedBoardComponents/LudoSkeleton.jsx';

const LudoOnline = memo(({ socket, socketLoaded, setSocketLoaded, boardType }) => {
  const navigate = useNavigate();
  const { gameId } = useParams();
  const [screen, setScreen] = useState(window.innerWidth <= window.innerHeight);

  const storeGameId = useGameStore(state => state.meta?.gameId)
  const [activeGameId, setActiveGameId] = useState(gameId);

  useEffect(()=>{
    if(!boardType === 'poi') return;
    console.log("storeGameId", storeGameId, typeof storeGameId);
    console.log("gameId", gameId, typeof gameId);
    if(storeGameId){
      setActiveGameId(storeGameId);
    }
  },[storeGameId, gameId])

  const [gameSize, setGameSize]         = useState([0, 4]);
  const [myColor, setMyColor]           = useState(null);

  const myColorRef = useRef(null);

  const userInfo = useUserStore(state => state.info);

  // ─────────────────────────────────────────────────────────────────────────
  // FIX F5: verifySyncSequence — only incomingTick === currentTick+1 is valid.
  // ─────────────────────────────────────────────────────────────────────────
  const verifySyncSequence = (incomingTick) => {
    if (typeof incomingTick !== 'number') return true;
    const currentTick = useGameStore.getState().meta.syncTick || 0;
    if (currentTick === 0) return true;

    if (incomingTick === currentTick + 1) return true;

    console.warn(`[DESYNC] Expected: ${currentTick + 1}, Got: ${incomingTick}`);
    toast.warning("Desync detected. Realigning grid...", { theme: "dark", toastId: "desync" });
    socket.emit("sync-state", { gameId: activeGameId, color: myColorRef.current });
    return false;
  };

  useEffect(() => {
    if (!socket) return;

    // ─────────────────────────────────────────────────────────────────────
    // join-success: POI only
    // ─────────────────────────────────────────────────────────────────────
    const handleJoinSuccess = ({ assignedColor, newState }) => {
      if (boardType !== "poi") return;
      myColorRef.current = assignedColor;
      setMyColor(assignedColor);
      setActiveGameId(newState.meta.gameId);
      setSocketLoaded(false);
      onlineGameActions.syncFullState(newState);
      setSocketLoaded(true);
    };

    // ─────────────────────────────────────────────────────────────────────
    // initiate-game: POF — set myColor by scanning server state
    // ─────────────────────────────────────────────────────────────────────
    const handleInitiateGame = ({ state }) => {
      toast.success("All pilots connected. Grid initialized!", { theme: "dark", icon: "🚀" });
      onlineGameActions.syncFullState(state);
      setSocketLoaded(true);

      if (!myColorRef.current && userInfo?.username) {
        for (const c of ["R", "B", "Y", "G"]) {
          if (state.players[c]?.username === userInfo.username) {
            myColorRef.current = c;
            setMyColor(c);
            break;
          }
        }
      }
    };

    const handlePlayerJoined = ({ message, newState, syncArray }) => {
      toast.success(message, { theme: "dark", icon: "🌐" });
      if (verifySyncSequence(syncArray?.[1])) {
        onlineGameActions.syncFullState(newState);
      }
    };

    const handlePlayerLeft = ({ message, newState, syncArray }) => {
      toast.error(message, { theme: "dark", icon: "⚠️" });
      if (verifySyncSequence(syncArray?.[1])) {
        onlineGameActions.syncFullState(newState);
      }
    };

    const handleStateSynced = (serverState) => {
      onlineGameActions.syncFullState(serverState);
      if (!myColorRef.current && userInfo?.username) {
        for (const c of ["R", "B", "Y", "G"]) {
          if (serverState.players[c]?.username === userInfo.username) {
            myColorRef.current = c;
            setMyColor(c);
            break;
          }
        }
      }
      setSocketLoaded(true);
    };

    const handleTurnTimeout = ({ moveUpdates, syncArray }) => {
      const previousTurn = useGameStore.getState().move.turn;
      if (verifySyncSequence(syncArray?.[1])) {
        onlineGameActions.patchDeltaState({ move: moveUpdates }, syncArray[1]);

        // CRITICAL NEW ADDITION: Release the frontend moving lock!
        gameActions.setMoving(false); 

        if (previousTurn === myColorRef.current) {
          // toast.error("Time limit exceeded! Auto-skipping turn.", { theme: "dark", icon: "⏳" });
        } else {
          toast.info(`Node ${previousTurn} timed out.`, { theme: "dark", icon: "⏱️" });
        }
      }
    };

    const handleAddPlayer = ({ color, curCount, username, boardSize }) => {
      // toast.success(`CurCount ${curCount}`, { theme: "dark", icon: "🌐" });
      toast.info(`@${username} joined via Node ${color}`, { theme: "dark", icon: "🌐" });
      setGameSize([curCount, boardSize]);
    };

    const handlePlayerOfflineWarning = ({ message }) =>
      toast.warning(message, { theme: "dark", autoClose: 9500, icon: "⏳" });

    const handlePlayerReconnected = ({ message }) =>
      toast.success(message, { theme: "dark", icon: "🔌" });

    // FIX #5: Handle AFK warning from server (3 skips warning, 4 skips warning)
    const handleAutoSkipWarning = ({ color, skipsLeft, message }) => {
      if (color === myColorRef.current) {
        toast.error(`⚠️ ${message}`, { theme: "dark", toastId: `afk-warn-${color}`, autoClose: 8000 });
      } else {
        toast.warning(`Node ${color}: ${skipsLeft} skip(s) left before removal.`, { theme: "dark", icon: "⏳" });
      }
    };

    // FIX #5: Handle player removal due to AFK
    const handlePlayerRemovedAfk = ({ color, message, newState, syncArray }) => {
      toast.error(`🚫 ${message}`, { theme: "dark", icon: "🤖" });
      if (verifySyncSequence(syncArray?.[1])) {
        onlineGameActions.syncFullState(newState);
        socket.disconnect();
      }
    };

    socket.on("join-success",            handleJoinSuccess);
    socket.on("initiate-game",           handleInitiateGame);
    socket.on("add-player",              handleAddPlayer);
    socket.on("player-joined",           handlePlayerJoined);
    socket.on("player-left",             handlePlayerLeft);
    socket.on("state-synced",            handleStateSynced);
    socket.on("turn-timeout-update",     handleTurnTimeout);
    socket.on("player-offline-warning",  handlePlayerOfflineWarning);
    socket.on("player-reconnected",      handlePlayerReconnected);
    socket.on("auto-skip-warning",       handleAutoSkipWarning);
    socket.on("player-removed-afk",      handlePlayerRemovedAfk);

    return () => {
      socket.off("join-success",           handleJoinSuccess);
      socket.off("initiate-game",          handleInitiateGame);
      socket.off("add-player",             handleAddPlayer);
      socket.off("player-joined",          handlePlayerJoined);
      socket.off("player-left",            handlePlayerLeft);
      socket.off("state-synced",           handleStateSynced);
      socket.off("turn-timeout-update",    handleTurnTimeout);
      socket.off("player-offline-warning", handlePlayerOfflineWarning);
      socket.off("player-reconnected",     handlePlayerReconnected);
      socket.off("auto-skip-warning",      handleAutoSkipWarning);
      socket.off("player-removed-afk",     handlePlayerRemovedAfk);
    };
  }, [socket, activeGameId, boardType, userInfo]);

  // ─── Store subscriptions ────────────────────────────────────────────────
  const turn       = useGameStore(state => state.move.turn);
  const playersSet = useGameStore(state => state.meta?.onBoard);
  const curColor   = useGameStore(state => state.players[state.move.turn]?.color || "#ffffff");
  const moveObj    = useGameStore(useShallow(state => state.move));
  const rollAllowed = useGameStore(state => state.move.rollAllowed);
  const gameStatus  = useGameStore(state => state.meta.status);
  const playersData = useGameStore(state => state.players);

  const { pieceIdxR, pieceIdxB, pieceIdxY, pieceIdxG } = useGameStore(useShallow(state => ({
    pieceIdxR: state.players.R?.pieceIdx,
    pieceIdxB: state.players.B?.pieceIdx,
    pieceIdxY: state.players.Y?.pieceIdx,
    pieceIdxG: state.players.G?.pieceIdx,
  })));

  const pieceIdx = useMemo(() => ({
    R: pieceIdxR, B: pieceIdxB, Y: pieceIdxY, G: pieceIdxG
  }), [pieceIdxR, pieceIdxB, pieceIdxY, pieceIdxG]);

  const { winR, winB, winY, winG } = useGameStore(useShallow(state => ({
    winR: state.players.R?.winPosn, winB: state.players.B?.winPosn,
    winY: state.players.Y?.winPosn, winG: state.players.G?.winPosn,
  })));

  const winState = useMemo(() => ({
    R: winR, B: winB, Y: winY, G: winG
  }), [winR, winB, winY, winG]);

  const isFinished = gameStatus === "FINISHED";
  const isWaiting  = gameStatus === "WAITING" || gameStatus === "LOADED";

  useEffect(() => {
    const handleResize = () => setScreen(window.innerWidth < window.innerHeight);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleReturnToDash = () => {
    gameActions.resetStore();
    navigate('/dashboard');
  };

  return (
    <div className="w-full h-full min-h-screen bg-[#050502] flex items-center justify-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-indigo-900/20 via-[#020205] to-[#020205] z-0 pointer-events-none" />
      <div className="absolute inset-0 z-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />

      {(!socketLoaded || isWaiting) ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative z-50 w-full max-w-[500px]">
          <LudoSkeleton text={!socketLoaded ? "Initializing_Grid..." : `Waiting_For_Pilots... [${gameSize[0] || 1}/${gameSize[1]}]`} />
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
          className={`relative z-10 flex flex-col items-center justify-between transition-all duration-500
            ${screen ? 'w-full max-w-[500px] aspect-[12/16] py-2 px-1' : 'h-full max-h-[95vh] aspect-[1/1] py-4'}
            ${isFinished ? 'pointer-events-none blur-md opacity-40 scale-95' : ''}`}
        >
          <div className='flex flex-row items-center justify-between w-full h-[10%] sm:h-[10%] px-1 gap-2 sm:gap-4'>
            <div className="h-full flex-1 max-w-[35%] min-w-0">
              <PlayerBoard playing={playersSet?.has('B')} idx={'B'} left={true} turn={moveObj.turn === 'B'} isOnline={true} />
            </div>
            <div className="relative h-full aspect-square max-h-[80px] sm:max-h-[100px] flex items-center justify-center group flex-shrink-0">
              <div className="absolute inset-0 rounded-xl opacity-40 blur-lg transition-colors duration-500" style={{ backgroundColor: curColor }} />
              <div className="dice-cover relative z-10 w-full h-full flex items-center justify-center rounded-xl bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/10 transition-all duration-300 shadow-xl" style={{ borderColor: curColor, boxShadow: `inset 0 0 15px ${curColor}15` }}>
                <div className="absolute top-0.5 left-0.5 w-1.5 h-1.5 border-t border-l opacity-50" style={{ borderColor: curColor }} />
                <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 border-b border-r opacity-50" style={{ borderColor: curColor }} />
                <Dice turn={turn} rollAllowed={rollAllowed} gameFinished={isFinished} socket={socket} gameId={activeGameId} isOnline={true} myColor={myColor} />
              </div>
            </div>
            <div className="h-full flex-1 max-w-[35%] min-w-0">
              <PlayerBoard playing={playersSet?.has('Y')} idx={'Y'} left={false} turn={moveObj.turn === 'Y'} isOnline={true} />
            </div>
          </div>

          <div className="relative flex items-center justify-center flex-1 w-full overflow-hidden my-1">
            <div className="relative aspect-square w-full h-auto max-h-full max-w-full flex items-center justify-center">
              <div className="absolute inset-0 rounded-lg bg-black/40 shadow-2xl backdrop-blur-sm border border-white/5" />
              <div className={`z-10 p-1 aspect-square flex-none ${screen ? 'w-full max-w-full h-auto' : 'h-full max-h-full w-auto'}`}>
                <ErrorBoundary>
                  <GameBoard
                    socket={socket}
                    gameId={activeGameId}
                    isOnline={true}
                    moveCount={moveObj.moveCount}
                    moving={moveObj.moving}
                    pieceIdxArr={pieceIdx}
                    winState={winState}
                    myColor={myColor}
                  />
                </ErrorBoundary>
              </div>
            </div>
          </div>

          <div className='flex flex-row items-center justify-between w-full h-[10%] sm:h-[10%] px-1 gap-2 sm:gap-4'>
            <div className="h-full flex-1 max-w-[35%] min-w-0">
              <PlayerBoard playing={playersSet?.has('R')} idx={'R'} left={true} turn={moveObj.turn === 'R'} isOnline={true} />
            </div>
            <div className="hidden sm:flex flex-col items-center justify-center opacity-30 w-[20%]">
              <Zap size={18} className="text-white animate-pulse" />
              <span className="text-[8px] tracking-[0.3em] text-white font-mono mt-0.5">NEO</span>
            </div>
            <div className="h-full flex-1 max-w-[35%] min-w-0">
              <PlayerBoard playing={playersSet?.has('G')} idx={'G'} left={false} turn={moveObj.turn === 'G'} isOnline={true} />
            </div>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {isFinished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
            <motion.div initial={{ scale: 0.8, y: 50 }} animate={{ scale: 1, y: 0 }} className="bg-[#0a0a0f] border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-[0_0_50px_rgba(0,255,60,0.1)] flex flex-col items-center relative overflow-hidden">
              <GradientText colors={["#00ff3c", "#ffffff"]} className="text-3xl sm:text-4xl font-black tracking-tighter uppercase mb-2">MISSION_COMPLETE</GradientText>
              <p className="text-[10px] text-gray-500 font-mono tracking-[0.3em] uppercase mb-8">Grid Protocol Terminated</p>

              <div className="w-full space-y-3 mb-8">
                {Array.from(playersSet || [])
                  .map(color => playersData[color])
                  .sort((a, b) => {
                    if (a.winPosn === 0) return 1;
                    if (b.winPosn === 0) return -1;
                    return a.winPosn - b.winPosn;
                  })
                  .map((player) => {
                    if (!player) return null;
                    const trophyStyle = player.winPosn === 1
                      ? "text-[#FFD700] drop-shadow-[0_0_12px_rgba(255,215,0,0.8)]"
                      : player.winPosn === 2
                        ? "text-[#C0C0C0] drop-shadow-[0_0_12px_rgba(192,192,192,0.8)]"
                        : player.winPosn === 3
                          ? "text-[#CD7F32] drop-shadow-[0_0_12px_rgba(205,127,50,0.8)]"
                          : null;
                    return (
                      <div key={player.color} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden group">
                        <div className="absolute inset-0 opacity-10" style={{ backgroundColor: player.color }} />
                        <div className="flex items-center gap-4 relative z-10">
                          <span className="text-2xl font-black" style={{ color: player.color }}>
                            {player.winPosn !== 0 ? `#${player.winPosn}` : '-'}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-bold uppercase text-white">{player.name || player.username}</span>
                            <span className="text-[8px] font-mono text-gray-500 tracking-widest">Node_{player.color}</span>
                          </div>
                        </div>
                        {trophyStyle && <Trophy size={24} className={`opacity-90 relative z-10 ${trophyStyle}`} />}
                      </div>
                    );
                  })}
              </div>

              <button onClick={handleReturnToDash} className="w-full py-4 bg-[#00ff3c] text-black font-black uppercase text-[10px] tracking-[0.2em] rounded-xl hover:shadow-[0_0_25px_#00ff3c] active:scale-95 transition-all flex items-center justify-center gap-2">
                RETURN_TO_DASHBOARD <ChevronRight size={16} />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

LudoOnline.displayName = 'LudoOnline';
export default LudoOnline;