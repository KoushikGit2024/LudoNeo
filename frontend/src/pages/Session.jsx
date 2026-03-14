import React, { Suspense, useContext, useEffect, useState, useRef } from 'react';
import { useNavigate, useParams, useBlocker, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useShallow } from 'zustand/shallow';
import { 
  Menu, X, Volume2, VolumeX, Music, Music2, 
  BookOpen, LogOut, Zap, ShieldAlert, Save, Loader2, Edit3 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const LudoOffline = React.lazy(() => import('@/components/offlineBoard/LudoOffline'));
const LudoOnline = React.lazy(() => import('@/components/onlineBoard/LudoOnline'));

import useUserStore from '@/store/userStore';
import useGameStore from '@/store/useGameStore';
import socket from '@/api/socket'; 
import gameActions from '@/store/gameLogic';
import { AudioContext } from '@/contexts/SoundContext';

import LudoSkeleton from '@/components/sharedBoardComponents/LudoSkeleton';

const generateDefaultTitle = () => {
  const now = new Date();
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${months[now.getMonth()]}_${String(now.getDate()).padStart(2, '0')}_${now.getFullYear()}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
};

const Session = () => {
  const { boardType, gameId } = useParams();
  const [searchParams] = useSearchParams();
  
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveTitle, setSaveTitle] = useState("");
  const [socketLoaded, setSocketLoaded] = useState(false);

  const { sound, toggleSound, music, toggleMusic } = useContext(AudioContext);
  const userInfo = useUserStore(useShallow((state) => state.info));
  
  // ✅ HUGE PERFORMANCE FIX: Subscribe ONLY to the status string.
  const gameStatus = useGameStore(state => state.meta.status); 
  
  const isOnlineMode = boardType === 'poi' || boardType === 'pof' || boardType === 'online';
  const canSave = boardType === 'offline' || boardType === 'bot';

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) => {
      const isLeaving = gameStatus !== "FINISHED" && currentLocation.pathname !== nextLocation.pathname;
      
      if (isLeaving && canSave && !saveTitle) {
         setSaveTitle(generateDefaultTitle());
      }
      if (redirectedRef.current) return false;
      return isLeaving;
    }
  );

  const handleSaveAndExit = async () => {
    if (!canSave) {
      blocker.proceed?.();
      return;
    }
    setIsSaving(true);
    try {
      const finalTitle = saveTitle.trim() || generateDefaultTitle();
      await gameActions.saveGameToDB(finalTitle);
      blocker.proceed?.();
    } catch (err) {
      console.error(err);
      toast.error("Uplink Failure: Could not save progress.", { theme: "dark" });
    } finally {
      setIsSaving(false);
    }
  };
  
  useEffect(() => {
    return () => {
      socket.disconnect();
      gameActions.resetStore();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameStatus !== "FINISHED") {
        e.preventDefault();
        e.returnValue = ''; 
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    if (isOnlineMode && userInfo && !userInfo?.email) {
      toast.info("Neural link requires Pilot Registration.", { theme: "dark" });
      navigate("/dashboard"); 
    } else if (isOnlineMode) {
      socket.auth = {
        playerDescription: searchParams.get("idf"),
        gameId: gameId || null, 
        gameType: boardType,
      };
      setSocketLoaded(false);
      socket.connect();
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isOnlineMode, userInfo, navigate, gameStatus, searchParams, gameId]);

  const rules = [
    "Pieces move based on 1-6 dice rolls.",
    "A 6 allows deploying a piece from home.",
    "Landing on an opponent's piece 'cuts' it back home.",
    "Safe zones (marked with Shields) prevent cutting.",
    "First to bring all 4 pieces to the Center wins."
  ];

  const redirectedRef = useRef(false);

  useEffect(() => {
    if (!isOnlineMode) return;

    const handleError = (err) => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;

      console.error("Socket Error:", err.message);
      toast.error(err.message || "Connection lost", { theme: "dark" });

      socket.disconnect(); 

      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 100);
    };

    const handleConnect = () => {
      console.log("🟢 Socket connected:", socket.id);
      setSocketLoaded(true);
      setTimeout(() => {
        try {
          socket.emit("join-game", { type: boardType });
        } catch (error) {
          console.error("🔴 Emit crashed locally:", error);
        }
      }, 100);
    };

    socket.on("connect", handleConnect);
    socket.on("connect_error", handleError);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("connect_error", handleError);
    };

  }, [isOnlineMode, boardType]);

  return (
    <div className='bg-[#020205] relative h-[100dvh] w-full flex items-center justify-center overflow-hidden'>
      
      <button 
        onClick={() => setIsMenuOpen(true)}
        className="absolute top-6 left-6 z-[100] p-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl hover:bg-white/10 transition-all group"
      >
        <Menu size={20} className="text-[#00ff3c] group-hover:scale-110 transition-transform" />
      </button>

      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[110]"
            />
            <motion.div 
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
              className="absolute left-0 top-0 h-full w-72 bg-[#050508] border-r border-white/10 z-[120] p-8 flex flex-col shadow-[20px_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="flex items-center justify-between mb-12">
                <div className="flex items-center gap-2">
                  <Zap size={18} className="text-[#00ff3c]" />
                  <span className="font-black tracking-tighter text-xl">LUDO_NEO</span>
                </div>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white">
                  <X size={20} />
                </button>
              </div>

              <nav className="flex-1 space-y-6">
                <div className="space-y-3">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Audio_Modules</p>
                  <button onClick={() => toggleSound(!sound)} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-[#00ff3c]/30 transition-all">
                    <div className="flex items-center gap-3">
                      {sound ? <Volume2 size={18} className="text-[#00ff3c]" /> : <VolumeX size={18} className="text-gray-500" />}
                      <span className="text-xs font-bold uppercase tracking-tight text-blue-50">SFX_Output</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full p-1 transition-colors ${sound ? 'bg-[#00ff3c]' : 'bg-gray-800'}`}>
                       <div className={`w-2 h-2 bg-black rounded-full transition-transform ${sound ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                  <button onClick={() => toggleMusic(!music)} className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-indigo-500/30 transition-all">
                    <div className="flex items-center gap-3">
                      {music ? <Music2 size={18} className="text-indigo-400" /> : <Music size={18} className="text-gray-500" />}
                      <span className="text-xs font-bold uppercase tracking-tight text-blue-50">Neural_BGM</span>
                    </div>
                    <div className={`w-8 h-4 rounded-full p-1 transition-colors ${music ? 'bg-indigo-500' : 'bg-gray-800'}`}>
                       <div className={`w-2 h-2 bg-black rounded-full transition-transform ${music ? 'translate-x-4' : 'translate-x-0'}`} />
                    </div>
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest px-2">Information_Node</p>
                  <button onClick={() => setShowRules(!showRules)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all">
                    <BookOpen size={18} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase text-blue-50">Grid_Protocols</span>
                  </button>
                  {showRules && (
                    <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="space-y-2 px-2 overflow-hidden">
                      {rules.map((r, i) => (
                        <li key={i} className="text-[10px] text-gray-400 flex gap-2">
                          <span className="text-[#00ff3c]">•</span> {r}
                        </li>
                      ))}
                    </motion.ul>
                  )}
                </div>
              </nav>

              <button 
                onClick={() => { setIsMenuOpen(false); navigate('/dashboard'); }}
                className="mt-auto flex items-center justify-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-black font-black uppercase text-[10px] tracking-widest transition-all"
              >
                <LogOut size={16} /> ABORT_SESSION
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {blocker.state === "blocked" && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-md" />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="relative w-full max-w-sm bg-[#0a0a0f] border-2 border-[#00ff3c]/30 rounded-3xl p-8 text-center shadow-[0_0_50px_rgba(0,255,60,0.1)]"
            >
              {canSave ? (
                <>
                  <div className="w-16 h-16 bg-[#00ff3c]/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Save size={32} className="text-[#00ff3c] animate-pulse" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Save_Grid_State</h3>
                  <p className="text-xs text-gray-400 mb-6 font-medium">Name your memory core file before exiting.</p>
                  
                  <div className="relative mb-6 text-left">
                     <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                     <input 
                        type="text"
                        value={saveTitle}
                        onChange={(e) => setSaveTitle(e.target.value)}
                        placeholder="Memory Core ID..."
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-xs font-mono text-[#00ff3c] focus:outline-none focus:border-[#00ff3c]/50 transition-colors uppercase"
                     />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      disabled={isSaving}
                      onClick={handleSaveAndExit}
                      className="w-full py-4 bg-[#00ff3c] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:shadow-[0_0_20px_#00ff3c] transition-all flex items-center justify-center gap-2"
                    >
                      {isSaving ? <Loader2 className="animate-spin" size={14}/> : <Save size={14}/>} 
                      SAVE_AND_TERMINATE
                    </button>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => blocker.proceed?.()}
                        className="py-3 bg-red-500/10 border border-red-500/20 text-red-500 font-black uppercase text-[9px] tracking-widest rounded-xl hover:bg-red-500 hover:text-black transition-all"
                      >
                        PURGE_DATA
                      </button>
                      <button 
                        onClick={() => blocker.reset?.()}
                        className="py-3 bg-white/5 border border-white/10 text-white font-black uppercase text-[9px] tracking-widest rounded-xl hover:bg-white/10 transition-all"
                      >
                        RESUME_LINK
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShieldAlert size={32} className="text-red-500 animate-pulse" />
                  </div>
                  <h3 className="text-xl font-black uppercase tracking-tighter text-white mb-2">Sync_Termination</h3>
                  <p className="text-sm text-gray-400 mb-8 font-medium">Disconnecting will result in immediate loss of grid progress. Proceed?</p>
                  
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => blocker.proceed?.()}
                      className="w-full py-4 bg-red-500 text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-red-600 transition-all"
                    >
                      YES_PURGE_DATA
                    </button>
                    <button 
                      onClick={() => blocker.reset?.()}
                      className="w-full py-4 bg-white/5 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:bg-white/10 transition-all"
                    >
                      NO_RETAIN_LINK
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="w-full h-full flex items-center justify-center">
        <Suspense fallback={<LudoSkeleton text={"Hi"}/>}>
          {isOnlineMode ? <LudoOnline socket={socket} socketLoaded={socketLoaded} setSocketLoaded={setSocketLoaded} boardType={boardType}/> : <LudoOffline />}
        </Suspense>
      </div>
    </div>
  );
};

export default Session;