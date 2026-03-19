import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useParams } from 'react-router-dom';
import {
  User, Search, CheckCircle, Loader2,
  ChevronRight, ArrowLeft, Terminal, Globe, Users, Cpu
} from 'lucide-react';
import GradientText from '@/components/customComponents/GradientText';
import api from '@/api/axiosConfig';
import { toast } from 'react-toastify';
import "@/styles/options.css";

import useUserStore from '@/store/userStore';
import useGameStore from '@/store/useGameStore';
import gameActions  from '@/store/gameLogic';

const GameSetup = () => {
  const { boardType } = useParams();
  const navigate = useNavigate();

  const info = useUserStore((state) => state.info);

  const myName   = info?.username || 'Me';
  const myEmail  = info?.email    || '';
  const myAvatar = info?.avatar   || '/defaultProfile.png';

  const isPOI     = boardType === 'poi' || boardType === 'online';
  const isPOF     = boardType === 'pof';
  const isBot     = boardType === 'bot';
  const isOffline = boardType === 'offline';

  

  const titleMap = {
    poi:     "SQUAD_STRIKE",
    pof:     "ELITE_LINK",
    bot:     "CORE_CHALLENGE",
    offline: "LOCAL_GRID",
  };

  const colorMap = [
    { id: 'R', hex: "#FF3131" },
    { id: 'B', hex: "#00D4FF" },
    { id: 'Y', hex: "#ffc400" },
    { id: 'G', hex: "#39FF14" }
  ];

  const BOT_NAMES = ["NeoCore","ZeroX","OmegaUnit","HexBot","Vexo-7","Nano-8","Zetta-1","Aura-X"];

  const [selectedColors, setSelectedColors] = useState(isPOI ? ['R','B','Y','G'] : ['R','Y']);
  const [humanColor,     setHumanColor]     = useState((isBot || isPOF) ? 'R' : null);

  const [players, setPlayers] = useState({
    R: { name: 'Pilot_1', username: '', verified: !isPOF, profile: '' },
    B: { name: 'Pilot_2', username: '', verified: !isPOF, profile: '' },
    Y: { name: 'Pilot_3', username: '', verified: !isPOF, profile: '' },
    G: { name: 'Pilot_4', username: '', verified: !isPOF, profile: '' }
  });

  const [loadingStates,  setLoadingStates]  = useState({});
  const [searchResults,  setSearchResults]  = useState({ R:[], B:[], Y:[], G:[] });
  const [activeSearch,   setActiveSearch]   = useState(null);
  const [botDifficulty,  setBotDifficulty]  = useState({ R:'medium', B:'medium', Y:'medium', G:'medium' });
  const [isStarting,     setIsStarting]     = useState(false);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (isPOI && selectedColors.length !== 4) {
      setSelectedColors(['R','B','Y','G']);
      if (humanColor !== null) setHumanColor(null);
    } else if ((isBot || isPOF) && !selectedColors.includes(humanColor)) {
      setHumanColor(selectedColors[0]);
    } else if (isOffline && humanColor !== null) {
      setHumanColor(null);
    }
  }, [isPOI, isBot, isPOF, isOffline, selectedColors.length]);

  const handleClaimNode = (colorId) => {
    const prevColor = humanColor;
    if (!prevColor || prevColor === colorId) { setHumanColor(colorId); return; }
    setPlayers((prev) => ({
      ...prev,
      [prevColor]: prev[colorId],
      [colorId]:   prev[prevColor]
    }));
    setHumanColor(colorId);
  };

  useEffect(() => {
    setPlayers(prev => {
      let changed = false;
      const next  = { ...prev };
      let botIdx  = 0;
      selectedColors.forEach(c => {
        if (isBot && c !== humanColor) {
          if (next[c].name !== BOT_NAMES[botIdx]) {
            next[c] = { ...next[c], name: BOT_NAMES[botIdx], verified: true };
            changed = true;
          }
          botIdx++;
        } else if (isPOF && c === humanColor) {
          if (next[c].name !== myName || next[c].username !== myEmail) {
            next[c] = { ...next[c], name: myName, username: myName, profile: myAvatar, verified: true };
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, [selectedColors, humanColor, isBot, isPOF, myName, myEmail, myAvatar]);

  const toggleColor = (colorId) => {
    if (isPOI) return;
    setSelectedColors(prev => {
      if (prev.includes(colorId)) {
        if (prev.length <= 2) return prev;
        return prev.filter(c => c !== colorId);
      }
      return [...prev, colorId];
    });
  };

  const handleNameChange = (colorId, value) => {
    setPlayers(prev => ({ ...prev, [colorId]: { ...prev[colorId], name: value } }));
  };

  const getFilteredResults = (colorId) => {
    const taken = Object.entries(players)
      .filter(([id, data]) => id !== colorId && data.verified && data.username)
      .map(([_, data]) => data.username);
    return (searchResults[colorId] || []).filter(u => !taken.includes(u.username));
  };

  const handleSearch = (color, query) => {
    setPlayers(prev => ({ ...prev, [color]: { ...prev[color], username: query, verified: false } }));
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.trim().length < 5) {
      setSearchResults(p => ({ ...p, [color]: [] }));
      setActiveSearch(null);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingStates(p => ({ ...p, [color]: true }));
      try {
        const res = await api.get(`/api/auth/search-users?query=${encodeURIComponent(query)}&excludeName=${encodeURIComponent(myName)}`);
        setSearchResults(p => ({ ...p, [color]: (res.data.users || []).slice(0, 5) }));
        setActiveSearch(color);
      } catch (err) { console.error(err); }
      finally { setLoadingStates(p => ({ ...p, [color]: false })); }
    }, 400);
  };

  const selectUser = (colorId, user) => {
    setPlayers(prev => ({
      ...prev,
      [colorId]: {
        ...prev[colorId],
        name:     user.fullname || user.username,
        username: user.username,
        profile:  user.avatar || "/defaultProfile.png",
        verified: true
      }
    }));
    setActiveSearch(null);
  };

  function shortId(length = 16) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join("");
  }

  const handleStart = async () => {
    setIsStarting(true);
    try {
      // ─── POI ────────────────────────────────────────────────────────────
      if (isPOI) {
        navigate(`/session/poi`);
        return;
      }

      // ─── POF ────────────────────────────────────────────────────────────
      if (isPOF) {
        const gameId = shortId(16);

        // Build invited-only arrays so colors[i] always maps to targets[i].
        // FIX A2: Previously selectedColors (including host) was passed as
        // `colors` while targets had the host filtered out, causing every
        // guest to receive the wrong color in their JWT.
        const invitedColors = selectedColors.filter(c => c !== humanColor);
        const invitedUsers  = invitedColors.map(c => [players[c].username, players[c].profile]);

        // Single API call: sends guest notifications AND returns the host JWT.
        //
        // FIX A1: Previously the host idf was built with btoa(JSON.stringify)
        // which is plain base64, not a JWT. socketGuard calls jwt.verify() on
        // it and always throws. Now sendInvites signs the host token server-side
        // and returns it so the host gets a proper JWT without a second request.
        const inviteRes = await api.post('/api/auth/send-invites', {
          targets:   invitedUsers,
          colors:    invitedColors,          // guests only — aligned with targets
          hostColor: humanColor,             // server signs a JWT for the host
          size:      selectedColors.length,  // total players (host + guests)
          title:     "ELITE_LINK INVITE",
          message:   `Pilot ${myName} requested backup. Access node here: /session/pof/${gameId}`,
          type:      "info",
          gameId,
          boardType,
        });
        console.log(inviteRes.data)
        if (!inviteRes.data?.success || !inviteRes.data?.hostToken) {
          // toast.info(inviteRes.data.hostToken)
          // toast.info(JSON.stringify([inviteRes.data,"Hi"]))
          toast.error("Failed to initialize session. Try again.", { theme: "dark" });
          return;
        }

        if (invitedUsers.length > 0) {
          toast.success("Uplink invites broadcasted successfully.", { theme: "dark" });
        }

        // Navigate host with their server-signed JWT.
        navigate(`/session/${boardType}/${gameId}?idf=${encodeURIComponent(inviteRes.data.hostToken)}`);
        return;
      }

      // ─── Local / Bot modes ───────────────────────────────────────────────
      // console.log(players)
      const gameObj = {
        type: boardType,

        players: selectedColors,

        names: selectedColors.reduce((acc, c) => {
          acc[c] = players[c].username || players[c].name;
          return acc;
        }, {}),

        botDifficulties: selectedColors.reduce((acc, c) => {
          acc[c] = (isBot && c !== humanColor) ? botDifficulty[c] : null;
          return acc;
        }, {}),

        avatar: myAvatar
      };

      gameActions.resetStore();
      gameActions.initiateGame(gameObj);

      const newGameId = useGameStore.getState().meta.gameId;
      navigate(`/session/${boardType}/${newGameId}`);

    } catch (error) {
      console.error(error);
      // console.log({...error})
      toast.error("Failed to initialize session.", { theme: "dark" });
    } finally {
      setIsStarting(false);
    }
  };

  let startDisabled = false;
  if (isPOF)              startDisabled = selectedColors.some(c => !players[c].verified);
  if (isOffline || isBot) startDisabled = selectedColors.some(c => !players[c].name.trim());
  if (isPOI)              startDisabled = false;

  return (
    <div className="min-h-screen w-full bg-[#020205] text-white flex flex-col items-center justify-center p-2 sm:p-4 overflow-hidden">
      <button onClick={() => navigate('/dashboard')} className="absolute top-4 left-4 flex items-center gap-1.5 text-gray-500 hover:text-white transition-all z-50">
        <ArrowLeft size={14} />
        <span className="text-[9px] font-black uppercase tracking-widest">Abort</span>
      </button>

      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-3xl max-h-[90vh] bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[2rem] flex flex-col shadow-2xl overflow-hidden">
        <div className="p-5 sm:p-8 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2 mb-1 justify-center opacity-40">
            <Terminal size={12} className="text-[#00ff3c]" />
            <span className="text-[8px] font-bold tracking-[0.4em] uppercase">Session_Init</span>
          </div>
          <div className="text-center">
            <GradientText colors={isPOI ? ["#00D4FF","#ffffff"] : ["#00ff3c","#ffffff"]} className="text-2xl sm:text-4xl font-black uppercase tracking-tighter">
              {titleMap[boardType] || "NEON_INIT"}
            </GradientText>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 sm:p-8 custom-scrollbar space-y-6">
          <div className={`space-y-3 ${isPOI ? 'opacity-50 pointer-events-none' : ''}`}>
            <label className="text-[9px] font-black uppercase tracking-widest text-gray-500 flex items-center gap-2">
              <Users size={10} /> Node_Configuration {isPOI && "(LOCKED)"}
            </label>
            <div className="grid grid-cols-4 gap-3">
              {colorMap.map(color => (
                <button
                  key={color.id}
                  onClick={() => toggleColor(color.id)}
                  className={`h-12 sm:h-16 rounded-xl border transition-all flex items-center justify-center relative ${selectedColors.includes(color.id) ? 'border-white bg-white/5' : 'border-white/5 opacity-20'}`}
                >
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color.hex, boxShadow: `0 0 10px ${color.hex}` }} />
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            {selectedColors.map((colorId) => {
              const isOwned         = humanColor === colorId;
              const isBotNode       = isBot && !isOwned;
              const isPOFSearchNode = isPOF && !isOwned;

              let inputDisabled = false;
              let placeholder   = "Pilot Alias";
              let displayValue  = players[colorId].name;

              if (isPOI) {
                inputDisabled = true; placeholder = "Deploying..."; displayValue = "Searching Network...";
              } else if (isBotNode) {
                inputDisabled = true;
              } else if (isPOF && isOwned) {
                inputDisabled = true;
              } else if (isPOFSearchNode) {
                placeholder  = "Search Username...";
                displayValue = players[colorId].username;
              }

              return (
                <div key={colorId} className={`p-4 rounded-2xl border transition-all ${isOwned || isOffline ? 'bg-white/5 border-white/20' : 'bg-black/20 border-white/5'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">
                      {isBotNode ? 'AI_CORE' : 'Uplink'}_{colorId}
                    </span>
                    {isOwned && <span className="text-[8px] px-1.5 py-0.5 bg-[#00ff3c] text-black font-black rounded uppercase flex items-center gap-1"><User size={10}/> You</span>}
                  </div>

                  <div className="relative mb-3">
                    {isPOFSearchNode
                      ? <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={12} />
                      : isPOI
                        ? <Globe  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#00D4FF]" size={12} />
                        : <User   className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" size={12} />
                    }
                    <input
                      className={`w-full bg-white/5 border rounded-lg py-3 pl-10 pr-8 text-[11px] font-bold transition-all ${isPOFSearchNode && players[colorId].verified ? 'border-[#00ff3c]/30 text-[#00ff3c]' : 'border-white/10'}`}
                      placeholder={placeholder}
                      value={displayValue}
                      onChange={(e) => {
                        if (isPOFSearchNode) handleSearch(colorId, e.target.value);
                        else handleNameChange(colorId, e.target.value);
                      }}
                      disabled={inputDisabled}
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {loadingStates[colorId]
                        ? <Loader2 className="animate-spin text-gray-600" size={12} />
                        : (isPOFSearchNode && players[colorId].verified) && <CheckCircle className="text-[#00ff3c]" size={12} />
                      }
                    </div>

                    <AnimatePresence>
                      {isPOFSearchNode && activeSearch === colorId && getFilteredResults(colorId).length > 0 && (
                        <motion.div initial={{ opacity:0, y:-5 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} className="absolute top-full left-0 w-full mt-1 bg-[#0a0a0f] border border-white/10 rounded-lg overflow-hidden shadow-2xl z-50">
                          {getFilteredResults(colorId).map(u => (
                            <div key={u.username} onClick={() => selectUser(colorId, u)} className="p-2 border-b border-white/5 hover:bg-white/5 cursor-pointer flex items-center gap-2">
                              <img src={u.avatar || "/defaultProfile.png"} className="w-6 h-6 rounded-md object-cover" alt="avatar" />
                              <div className="flex flex-col min-w-0">
                                <span className="text-[9px] font-black uppercase text-white truncate">{u.fullname}</span>
                                <span className="text-[8px] font-mono text-gray-500">@{u.username}</span>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {isBotNode && (
                    <div className="flex items-center justify-between bg-black/40 px-2 py-1.5 rounded-lg border border-white/5">
                      <span className="text-[8px] font-black text-gray-500 uppercase flex items-center gap-1"><Cpu size={10}/> Protocol</span>
                      <select
                        value={botDifficulty[colorId]}
                        onChange={(e) => setBotDifficulty(p => ({ ...p, [colorId]: e.target.value }))}
                        className="bg-black/40 border border-[#00ff3c]/20 rounded px-2 py-0.5 text-[8px] font-black text-[#00ff3c] uppercase outline-none cursor-pointer hover:bg-[#00ff3c]/10 transition-colors"
                      >
                        <option value="easy"   className="bg-[#0a0a0f] text-[#00ff3c]">NEURAL_CORE</option>
                        <option value="medium" className="bg-[#0a0a0f] text-[#00ff3c]">OCTA_CORE</option>
                        <option value="hard"   className="bg-[#0a0a0f] text-[#00ff3c]">QUANTUM_CORE</option>
                      </select>
                    </div>
                  )}

                  {(isBot || isPOF) && (
                    <button
                      onClick={() => handleClaimNode(colorId)}
                      className={`w-full mt-3 py-2 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all
                        ${isOwned ? 'bg-[#00ff3c]/10 text-[#00ff3c] border border-[#00ff3c]/20 pointer-events-none' : 'bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400'}`}
                    >
                      {isOwned ? "CLAIMED" : "CLAIM_NODE"}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-8 bg-white/5 border-t border-white/5 flex-shrink-0">
          <button
            disabled={startDisabled || isStarting}
            onClick={handleStart}
            className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-2 active:scale-[0.98]
              ${startDisabled || isStarting
                ? 'bg-white/10 text-white/30 cursor-not-allowed'
                : isPOI
                  ? 'bg-[#00D4FF] text-black shadow-[0_0_25px_rgba(0,212,255,0.2)] hover:shadow-[0_0_35px_rgba(0,212,255,0.4)]'
                  : 'bg-[#00ff3c] text-black shadow-[0_0_25px_rgba(0,255,60,0.2)] hover:shadow-[0_0_35px_rgba(0,255,60,0.4)]'
              }`}
          >
            {isStarting ? <Loader2 size={14} className="animate-spin" /> : null}
            {isStarting ? "UPLINKING..." : isPOI ? "INITIALIZE_MATCH" : "ENGAGE_LINK"}
            {!isStarting && <ChevronRight size={14} />}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default GameSetup;