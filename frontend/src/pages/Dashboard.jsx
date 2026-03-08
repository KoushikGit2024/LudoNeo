import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, LogIn, UserPlus, Settings, LogOut, Bell, 
  X, AlertTriangle, ShieldCheck, Volume2, Music, Info, XCircle, RefreshCcw, Database, Activity, Loader2
} from 'lucide-react';
import { toast } from 'react-toastify';

import Particles from '@/components/customComponents/Particles';
import ElectricBorder from '@/components/customComponents/ElectricBorder';
import GradientText from '@/components/customComponents/GradientText';
import useUserStore from '@/store/userStore';
import { resetUserStore, updateUserInfo, markNotificationAsRead } from "@/store/userActions"; 
import gameActions from '@/store/gameLogic';
import api from '@/api/axiosConfig';
import { AudioContext } from '@/contexts/SoundContext';

import "../styles/menu.css";
import "../styles/cell.css";

const MENU_ITEMS = [
  { label: "Play With Bot", color: "#ff0505", route: "/setup/bot", img: "/bot.png" },
  { label: "Offline Board", color: "#2b01ff", route: "/setup/offline", img: "/offline.png" },
  { label: "Play On Internet", color: "#fff200", route: "/setup/poi", img: "/poi.png" },
  { label: "Play With Friends", color: "#00ff3c", route: "/setup/pof", img: "/pof.png" }
];

const getNotificationStyle = (type) => {
  switch(type) {
    case 'success': return { color: 'text-[#00ff3c]', bg: 'bg-[#00ff3c]/10', border: 'border-[#00ff3c]/20', Icon: ShieldCheck };
    case 'warning': return { color: 'text-[#fff200]', bg: 'bg-[#fff200]/10', border: 'border-[#fff200]/20', Icon: AlertTriangle };
    case 'error': return { color: 'text-[#ff0505]', bg: 'bg-[#ff0505]/10', border: 'border-[#ff0505]/20', Icon: XCircle };
    case 'info':
    default: return { color: 'text-[#00D4FF]', bg: 'bg-[#00D4FF]/10', border: 'border-[#00D4FF]/20', Icon: Info };
  }
};

// ==========================================
// SUB-COMPONENT: CENTRAL MODAL
// ==========================================
const ActionModal = ({ activeModal, setActiveModal, handleLogout }) => {
  const { sound, toggleSound, music, toggleMusic } = useContext(AudioContext);
  const userInfo = useUserStore((state) => state.info);
  const navigate = useNavigate();

  // Notification States
  const [sortedNotifications, setSortedNotifications] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Saved Games States
  const [savedGames, setSavedGames] = useState([]);
  const [isFetchingGames, setIsFetchingGames] = useState(false);
  const [loadingGameId, setLoadingGameId] = useState(null);

  useEffect(() => {
    if (userInfo?.notifications) {
      const sorted = [...userInfo.notifications].sort((a, b) => {
        if (a.read === b.read) return new Date(b.createdAt) - new Date(a.createdAt);
        return a.read ? 1 : -1;
      });
      setSortedNotifications(sorted);
    }
  }, [userInfo?.notifications]);

  const syncNotifications = async () => {
    setIsSyncing(true);
    try {
      const res = await api.get('/api/auth/notifications'); 
      if (res.data?.success) updateUserInfo({ notifications: res.data.notifications }); 
    } catch (err) {
      toast.error("SYSTEM ERROR: Failed to fetch latest comms.", { theme: "dark" });
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchSavedGames = async () => {
    setIsFetchingGames(true);
    try {
      const res = await api.get('/api/games/saved'); 
      if (res.data.success) setSavedGames(res.data.games);
    } catch (error) {
      toast.error("Failed to decrypt memory cores.", { theme: "dark" });
    } finally {
      setIsFetchingGames(false);
    }
  };

  useEffect(() => {
    if (activeModal === 'notifications') syncNotifications();
    if (activeModal === 'savedGames') fetchSavedGames();
  }, [activeModal]);

  // ✅ UPDATED: Intelligent Notification Routing for POF Invites
  const handleNotificationClick = async (notif) => {
    // 1. Mark as read immediately (Optimistic UI)
    if (!notif.read) {
      markNotificationAsRead(notif._id);
      try {
        await api.put(`/api/auth/notifications/${notif._id}/read`);
      } catch (err) {
        console.error("Failed to sync read status:", err);
      }
    }

    // 2. Scan the notification payload for routing instructions (POF Invites)
    // Looks for internal app routes like /session/pof/12345 or /setup/pof?join=12345
    const internalLinkMatch = notif.message.match(/(\/(session|setup)\/(pof|poi)[^\s]+)/);
    
    if (internalLinkMatch) {
      setActiveModal(null);
      toast.success("Uplink accepted. Rerouting to grid...", { theme: "dark" });
      navigate(internalLinkMatch[0]); // Instantly routes the user to the game!
      return;
    } 

    // 3. Fallback for generic external URLs
    const urlMatch = notif.message.match(/https?:\/\/[^\s]+/);
    if (urlMatch) {
      toast.info("Accessing secure datalink...", { theme: "dark", autoClose: 2000 });
      window.open(urlMatch[0], '_blank');
    }
  };

  const handleLoadGame = async (game) => {
    setLoadingGameId(game.meta.gameId);
    try {
      const isSuccess = await gameActions.loadGameFromDB(game.meta.gameId);
      if (isSuccess) {
        toast.success("Uplink Established. Resuming...", { theme: "dark" });
        navigate(`/session/${game.meta.type}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingGameId(null);
    }
  };

  if (!activeModal) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => setActiveModal(null)}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm" 
      />
      
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-[#0a0a0f] border border-white/10 rounded-[2rem] p-6 shadow-2xl overflow-hidden"
      >
        <div className="flex justify-between items-center mb-6 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-black tracking-[0.2em] text-white uppercase flex items-center gap-2">
              {activeModal === 'logout' && <><LogOut size={16} className="text-red-500"/> System_Disconnect</>}
              {activeModal === 'settings' && <><Settings size={16} className="text-[#fff200]"/> Core_Settings</>}
              {activeModal === 'notifications' && <><Bell size={16} className="text-[#00D4FF]"/> Comms_Uplink</>}
              {activeModal === 'savedGames' && <><Database size={16} className="text-[#00ff3c]"/> Memory_Cores</>}
            </h3>
            
            {activeModal === 'notifications' && (
              <button onClick={syncNotifications} disabled={isSyncing} className={`text-gray-500 hover:text-[#00D4FF] transition-all ${isSyncing ? 'animate-spin text-[#00D4FF]' : ''}`}>
                <RefreshCcw size={14} />
              </button>
            )}
          </div>
          <button onClick={() => setActiveModal(null)} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
        </div>

        {/* LOGOUT */}
        {activeModal === 'logout' && (
          <div className="text-center space-y-6">
            <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto animate-pulse"><AlertTriangle size={32} className="text-red-500" /></div>
            <p className="text-xs text-gray-400 leading-relaxed">Are you sure you want to sever the neural link? You will need to re-authenticate to access the grid.</p>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setActiveModal(null)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">Abort</button>
              <button onClick={handleLogout} className="flex-1 py-3 bg-red-500/20 hover:bg-red-500 border border-red-500/30 hover:border-red-500 text-red-500 hover:text-black text-[10px] font-black uppercase tracking-widest rounded-xl transition-all">Terminate Link</button>
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {activeModal === 'settings' && (
          <div className="space-y-4">
             <button onClick={() => toggleSound(!sound)} className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#00ff3c]/30 transition-all">
                <div className="flex items-center gap-3">
                  <Volume2 size={18} className={sound ? "text-[#00ff3c]" : "text-gray-500"} />
                  <span className="text-xs font-bold uppercase tracking-tight text-white">SFX Output</span>
                </div>
                <div className={`w-8 h-4 rounded-full p-1 transition-colors ${sound ? 'bg-[#00ff3c]' : 'bg-gray-800'}`}>
                    <div className={`w-2 h-2 bg-black rounded-full transition-transform ${sound ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
              <button onClick={() => toggleMusic(!music)} className="w-full flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/5 hover:border-[#00D4FF]/30 transition-all">
                <div className="flex items-center gap-3">
                  <Music size={18} className={music ? "text-[#00D4FF]" : "text-gray-500"} />
                  <span className="text-xs font-bold uppercase tracking-tight text-white">Neural BGM</span>
                </div>
                <div className={`w-8 h-4 rounded-full p-1 transition-colors ${music ? 'bg-[#00D4FF]' : 'bg-gray-800'}`}>
                    <div className={`w-2 h-2 bg-black rounded-full transition-transform ${music ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </button>
          </div>
        )}

        {/* SAVED GAMES */}
        {activeModal === 'savedGames' && (
          <div className="space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
            {isFetchingGames ? (
               <div className="flex flex-col items-center justify-center py-10 text-[#00ff3c]">
                  <Loader2 size={24} className="animate-spin mb-3" />
                  <span className="text-[10px] font-black tracking-[0.2em] uppercase">Decrypting Cores...</span>
               </div>
            ) : savedGames.length === 0 ? (
               <div className="text-center py-10 border border-white/5 border-dashed rounded-xl bg-white/[0.02]">
                  <Database size={32} className="mx-auto text-gray-600 mb-3 opacity-50" />
                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest">No Memory Cores Found.</p>
               </div>
            ) : (
               <div className="space-y-3">
                 {savedGames.map(game => (
                   <div key={game._id || game.meta.gameId} className="p-4 bg-white/5 border border-white/10 hover:border-[#00ff3c]/40 rounded-xl transition-all group flex flex-col gap-3">
                     <div className="flex justify-between items-start">
                       <div className="flex-1 min-w-0 pr-2">
                         <h4 className="text-xs font-black text-white uppercase tracking-wider truncate">{game.meta.title}</h4>
                         <p className="text-[9px] text-gray-500 font-mono mt-1">
                           {new Date(game.updatedAt || game.createdAt).toLocaleString()}
                         </p>
                       </div>
                       <span className="text-[8px] font-black px-2 py-1 bg-[#00ff3c]/10 text-[#00ff3c] rounded border border-[#00ff3c]/30 uppercase tracking-widest shrink-0">
                         {game.meta.type}
                       </span>
                     </div>
                     <button onClick={() => handleLoadGame(game)} disabled={loadingGameId === game.meta.gameId} className="w-full py-2.5 bg-[#00ff3c]/10 hover:bg-[#00ff3c] text-[#00ff3c] hover:text-black font-black uppercase text-[9px] tracking-widest rounded-lg transition-all flex items-center justify-center gap-2">
                       {loadingGameId === game.meta.gameId ? <Loader2 size={12} className="animate-spin"/> : <Activity size={12}/>}
                       {loadingGameId === game.meta.gameId ? "INITIALIZING..." : "RESUME_UPLINK"}
                     </button>
                   </div>
                 ))}
               </div>
            )}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {activeModal === 'notifications' && (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar pr-2">
            {isSyncing && sortedNotifications.length === 0 ? (
              <div className="text-center py-8 text-[#00D4FF] text-xs font-mono animate-pulse">SYNCING COMMS...</div>
            ) : sortedNotifications.length === 0 ? (
              <div className="text-center py-8 text-gray-500 text-xs font-mono">NO INCOMING TRANSMISSIONS.</div>
            ) : (
              sortedNotifications.map((notif) => {
                const { color, bg, border, Icon } = getNotificationStyle(notif.type);
                return (
                  <div key={notif._id} onClick={() => handleNotificationClick(notif)} className={`p-4 rounded-xl flex gap-3 items-start cursor-pointer transition-all duration-300 ${notif.read ? 'bg-white/5 border border-white/5 opacity-50 hover:opacity-100' : `${bg} border ${border} shadow-[0_0_15px_rgba(0,0,0,0.2)] hover:brightness-125`}`}>
                    <Icon size={16} className={`${color} shrink-0 mt-0.5`}/>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-1">
                        <p className={`text-[10px] font-black uppercase tracking-widest truncate ${color}`}>{notif.title}</p>
                        {!notif.read && <span className={`w-2 h-2 rounded-full ${bg.replace('/10', '')} animate-pulse shrink-0 ml-2`} />}
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
                        {notif.message.split(/(https?:\/\/[^\s]+|^\/[^\s]+)/g).map((part, i) => 
                          part && part.match(/(https?:\/\/[^\s]+|^\/[^\s]+)/) 
                            ? <span key={i} className="text-[#00D4FF] underline decoration-white/20 underline-offset-2">{part}</span> 
                            : part
                        )}
                      </p>
                      <p className="text-[8px] text-gray-500 mt-2 font-mono uppercase">{new Date(notif.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activeModal, setActiveModal] = useState(null); 
  
  const userInfo = useUserStore((state) => state.info);
  
  // Checking Auth Status to guard Online Modes
  const isLoggedIn = !!userInfo?.email && userInfo?.username !== "identity_pending"; 
  
  const profile = userInfo?.avatar;
  const [currentAvatar, setCurrentAvatar] = useState(profile || "/defaultProfile.png");

  const unreadCount = (userInfo?.notifications || []).filter(n => !n.read).length;

  useEffect(() => { setCurrentAvatar(profile || "/defaultProfile.png"); }, [profile]);

  const handleLogout = async () => {
    try {
      await api.post('/api/auth/logout');
      resetUserStore(); 
      setActiveModal(null);
      setIsProfileOpen(false);
      toast.success("LINK SEVERED. GOODBYE, PILOT.", { theme: "dark" });
    } catch (err) {
      toast.error("DISCONNECT FAILED.", { theme: "dark" });
    }
  };

  // ✅ UPDATED: Intercept clicks on Menu Items to verify authorization for POI and POF
  const handleMenuClick = (e, route) => {
    e.preventDefault();
    const isOnlineMode = route.includes('poi') || route.includes('pof');

    if (isOnlineMode && !isLoggedIn) {
      toast.error("IDENTITY REQUIRED: Connect to grid to access network multiplayer.", { theme: "dark" });
      navigate('/options/signin');
      return;
    }

    // Pass valid users to the required routing endpoints
    // Setup POI handles random match queuing, Setup POF handles room creation + invites
    navigate(route);
  };

  return (
    <div className='wholepage bg-[#020205] h-[100dvh] w-full relative overflow-hidden'>
      
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Particles particleColors={["#ffffff", "#425568"]} particleCount={500} speed={0.1} moveParticlesOnHover={true} alphaParticles={true} />
      </div>
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#020205] via-[#020205]/90 to-transparent z-20 pointer-events-none" />
      <div className="absolute top-0 w-full pt-10 z-30 flex justify-center pointer-events-none">
        <GradientText colors={["#ff0505", "#2b01ff", "#fff200", "#00ff3c"]} animationSpeed={3} showBorder={false} className="text-6xl md:text-8xl font-black tracking-tighter drop-shadow-2xl">
          LUDO NEO
        </GradientText>
      </div>

      <div className="absolute z-40 right-0 top-8 flex flex-col items-end" onMouseEnter={() => setIsProfileOpen(true)} onMouseLeave={() => setIsProfileOpen(false)}>
        <button type="button" className="xl:w-20 lg:w-16 w-14 aspect-square bg-white/10 backdrop-blur-md rounded-l-2xl border-2 border-r-0 border-white/20 flex items-center justify-center transition-all hover:bg-white/20 shadow-[0_0_20px_rgba(0,0,0,0.5)] relative">
          <div className="w-[80%] aspect-square rounded-full border-2 p-[2px] bg-gradient-to-tr from-gray-800 to-black relative" style={{borderColor: (isLoggedIn)?'#00ff3c80':'transparent'}}>
              <img src={currentAvatar} alt="profile" className="h-full w-full rounded-full object-cover" onError={() => setCurrentAvatar('/defaultProfile.png')} />
              {isLoggedIn && <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-black bg-[#00ff3c]`}></div>}
          </div>
          {unreadCount > 0 && (
             <div className="absolute -top-1 -left-1 bg-red-500 text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-[#020205] shadow-lg animate-bounce">{unreadCount}</div>
          )}
        </button>

        <div className={`flex flex-col items-end transition-all duration-300 ease-out origin-top-right ${isProfileOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
          <div className="mt-4 mr-4 p-2 w-48 bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col gap-1">
            {isLoggedIn ? (
              <>
                <div className="px-3 py-2 mb-2 border-b border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Pilot_ID</p>
                  <p className="text-xs text-[#00ff3c] truncate font-mono">@{userInfo.username}</p>
                </div>
                <div onClick={() => navigate('/options/profile')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors cursor-pointer group">
                  <User size={14} className="text-[#ff0505] group-hover:scale-110 transition-transform"/> <span className="text-xs font-bold uppercase">Profile</span>
                </div>
                <button onClick={() => setActiveModal('notifications')} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors text-left group w-full">
                  <div className="flex items-center gap-3">
                    <Bell size={14} className="text-[#00D4FF] group-hover:scale-110 transition-transform"/> <span className="text-xs font-bold uppercase">Comms</span>
                  </div>
                  {unreadCount > 0 && <span className="text-[9px] bg-[#00D4FF] text-black px-1.5 py-0.5 rounded font-black">{unreadCount}</span>}
                </button>
                <button onClick={() => setActiveModal('savedGames')} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors text-left group w-full">
                  <div className="flex items-center gap-3">
                    <Database size={14} className="text-[#00ff3c] group-hover:scale-110 transition-transform"/> <span className="text-xs font-bold uppercase">Memory Cores</span>
                  </div>
                </button>
              </>
            ) : (
              <>
                <div onClick={() => navigate('/options/signin')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors cursor-pointer group">
                  <LogIn size={14} className="text-[#2b01ff] group-hover:scale-110 transition-transform"/> <span className="text-xs font-bold uppercase">Sign In</span>
                </div>
                <div onClick={() => navigate('/options/signup')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors cursor-pointer group">
                  <UserPlus size={14} className="text-[#00ff3c] group-hover:scale-110 transition-transform"/> <span className="text-xs font-bold uppercase">Sign Up</span>
                </div>
              </>
            )}

            <button onClick={() => setActiveModal('settings')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-colors text-left group w-full">
              <Settings size={14} className="text-[#fff200] group-hover:rotate-90 transition-transform duration-500"/> <span className="text-xs font-bold uppercase">Settings</span>
            </button>

            {isLoggedIn && (
              <>
                <div className="h-px bg-white/5 my-1" />
                <button onClick={() => setActiveModal('logout')} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-gray-400 hover:text-red-500 transition-colors text-left group w-full">
                  <LogOut size={14} className="group-hover:-translate-x-1 transition-transform"/> <span className="text-xs font-bold uppercase">Disconnect</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        <ActionModal activeModal={activeModal} setActiveModal={setActiveModal} handleLogout={handleLogout} />
      </AnimatePresence>

      <div className="absolute inset-0 z-10 w-full h-full overflow-x-hidden overflow-y-auto lg:overflow-y-hidden lg:overflow-x-auto custom-scrollbar">
        <div className="min-h-full w-full flex flex-wrap lg:flex-nowrap items-start justify-center lg:justify-start lg:items-center gap-10 px-6 pt-[50%] sm:pt-[20%] sm:pb-[32px] lg:pt-[10%] lg:pb-0 lg:px-[10%]">
          
          {/* ✅ UPDATED: Menu mapping handles dynamic clicks instead of raw Links */}
          {MENU_ITEMS.map((item, idx) => (
            <div 
              key={item.label} 
              onClick={(e) => handleMenuClick(e, item.route)} 
              className="block group perspective-1000 w-[280px] relative cursor-pointer"
            >
              <ElectricBorder color={item.color} speed={3} chaos={0.1} thickness={3} style={{ borderRadius: '16px' }}>
                <div className="relative w-full aspect-[3/4] p-5 bg-[#0a0a0f] rounded-[14px] flex flex-col items-center justify-between transition-all duration-500 ease-out group-hover:scale-[1.05] group-hover:-translate-y-2" style={{ '--hover-glow': `${item.color}44`, '--neon-color': item.color }}>
                  <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" style={{ boxShadow: `inset 0 0 30px ${item.color}22, 0 0 20px ${item.color}11` }} />
                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/5 bg-gray-900 z-10">
                    <img src={item.img} alt={item.label} className={`"absolute h-full w-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-in-out grayscale-[50%] group-hover:grayscale-0" ${idx===2?'ml-[-5%] mt-[5%]':(idx===3)?'ml-[5%]':(idx===1)?'ml-[-5%]':''}`} />
                  </div>
                  <div className="relative z-10 mb-2 text-center">
                    <span className="text-lg font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 group-hover:text-white">{item.label}</span>
                    <div className="flex justify-center gap-1 mt-2">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-1 w-4 rounded-full transition-all duration-500 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0" style={{ backgroundColor: item.color, boxShadow: `0 0 10px ${item.color}`, transitionDelay: `${i * 100}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              </ElectricBorder>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;