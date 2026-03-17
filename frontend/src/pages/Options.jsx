import React, { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  ArrowLeft, User, Settings, LogIn, UserPlus, 
  CheckCircle, XCircle, Loader2, Mail, Fingerprint, X, Crop, Upload, 
  ShieldCheck, Eye, EyeOff, Save, RefreshCcw, Trash2, Activity, Cpu, Globe, Crosshair,
  Volume2, VolumeX, Music, Music2, Trophy, Zap, Target, Shield, Star, Swords, Skull, Clock
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GradientText from '@/components/customComponents/GradientText';
import Particles from '@/components/customComponents/Particles';
import api from '@/api/axiosConfig'; 
import { updateUserInfo, resetUserStore } from "@/store/userActions"; 
import { useShallow } from 'zustand/shallow';
import useUserStore from '@/store/userStore';
import { AudioContext } from '@/contexts/SoundContext';
import "../styles/options.css";

// ==========================================
// BADGE DEFINITIONS
// ==========================================
const BADGE_DEFS = [
  { id: 'first_blood',  label: 'First Blood',     icon: <Swords size={16}/>,    color: '#ff4444', cond: (s) => s.wins >= 1,                                                             desc: '1st Win'         },
  { id: 'veteran',      label: 'Veteran',         icon: <Shield size={16}/>,    color: '#00D4FF', cond: (s) => s.wins >= 10,                                                            desc: '10 Wins'         },
  { id: 'champion',     label: 'Champion',        icon: <Trophy size={16}/>,    color: '#fff200', cond: (s) => s.wins >= 50,                                                            desc: '50 Wins'         },
  { id: 'legendary',    label: 'Legendary',       icon: <Star size={16}/>,      color: '#ff0505', cond: (s) => s.wins >= 100,                                                           desc: '100 Wins'        },
  { id: 'survivor',     label: 'Survivor',        icon: <Zap size={16}/>,       color: '#00ff3c', cond: (s) => s.totalMatches >= 50,                                                    desc: '50 Matches'      },
  { id: 'sharp',        label: 'Sharp Shooter',   icon: <Crosshair size={16}/>, color: '#ec4899', cond: (s) => s.totalMatches >= 20 && parseFloat(s.winRate) >= 70,                     desc: '70%+ Win Rate'   },
  { id: 'bot_slayer',   label: 'Bot Slayer',      icon: <Cpu size={16}/>,       color: '#a855f7', cond: (s) => s.matchHistory?.some(m => m.gameType === 'bot' && m.result === 'win'),   desc: 'Defeat AI'       },
  { id: 'grid_master',  label: 'Grid Master',     icon: <Globe size={16}/>,     color: '#f97316', cond: (s) => s.matchHistory?.some(m => m.gameType === 'online' && m.result === 'win'),desc: 'Online Win'     },
];

// ==========================================
// SKELETON
// ==========================================
const ProfileSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-6 animate-pulse pb-8">
    <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-white/5 border border-white/10 rounded-[1.5rem]">
      <div className="w-20 h-20 rounded-2xl bg-white/10" />
      <div className="space-y-2 flex-1">
        <div className="h-2 w-24 bg-[#ff0505]/20 rounded" />
        <div className="h-8 w-48 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/5 rounded" />
      </div>
      <div className="w-16 h-16 rounded-2xl bg-white/10" />
    </div>
    <div className="h-14 bg-white/[0.02] border border-white/5 rounded-[2rem]" />
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-white/[0.02] border border-white/5 rounded-[1.5rem]" />)}
    </div>
    <div className="h-40 bg-white/[0.02] border border-white/5 rounded-[2rem]" />
    <div className="h-48 bg-white/[0.02] border border-white/5 rounded-[2rem]" />
  </div>
);

// ==========================================
// HELPERS
// ==========================================
const dataURLtoBlob = (dataurl) => {
  if (!dataurl) return null;
  let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], {type:mime});
};

async function getCroppedImg(image, crop) {
  const canvas = document.createElement('canvas');
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, crop.x * scaleX, crop.y * scaleY, crop.width * scaleX, crop.height * scaleY, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.5); 
}

// ==========================================
// MAIN COMPONENT
// ==========================================
const Options = () => {
  const { subOption } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const { sound, toggleSound, music, toggleMusic } = useContext(AudioContext);

  const [formData, setFormData] = useState({ fullname: '', username: '', email: '', password: '', newPassword: '' });
  const [loading, setLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false); 
  
  const reset = searchParams.get("reset");
  const id = searchParams.get("id");
  const token = searchParams.get("token");

  const [forgotPassMode, setForgotPassMode] = useState(false); 
  const [newPWmode, setNewPWmode] = useState((reset && id) ? true : false);
  const [showPass, setShowPass] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [finalImage, setFinalImage] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [imageSizeKB, setImageSizeKB] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false); 
  const [isSyncing, setIsSyncing] = useState(false); 
  
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);

  const subOptionsMap = {
    profile: { icon: <User size={20}/>,    color: "#ff0505", title: "Pilot_Profile"  },
    signin:  { icon: <LogIn size={20}/>,   color: "#2b01ff", title: "System Access"  },
    setting: { icon: <Settings size={20}/>, color: "#fff200", title: "Game Config"   },
    signup:  { icon: <UserPlus size={20}/>, color: "#00ff3c", title: "Register Pilot" }
  };

  const activeTheme = subOptionsMap[subOption] || subOptionsMap.profile;
  
  const { info, stats, inventory, settings } = useUserStore(useShallow((state) => ({
    info: state.info,
    stats: state.stats,
    inventory: state.inventory,
    settings: state.settings
  })));

  // Derived badge state
  const earnedBadges = BADGE_DEFS.filter(b => b.cond(stats));

  // ==========================================
  // EFFECTS
  // ==========================================
  useEffect(() => {
    if (token) handleVerifyLink(token);
    if (reset && id) setForgotPassMode(true);
  }, [token, reset, id]);

  useEffect(() => {
    if (!subOptionsMap[subOption]) { navigate('/dashboard'); return; }
    document.documentElement.style.setProperty('--active-neon', activeTheme.color);

    if (subOption === 'profile') {
      const currentInfo = useUserStore.getState().info;
      if (!currentInfo.email || currentInfo.username === "identity_pending") fetchCurrentProfile();
    }

    if (subOption === 'signin' || subOption === 'signup') {
      setFormData(prev => ({ ...prev, fullname: '', username: '', email: '', password: '', newPassword: '' }));
      setFinalImage(null);
    }

    if (subOption === 'setting') {
      const currentInfo = useUserStore.getState().info;
      setFormData(prev => ({ ...prev, fullname: currentInfo.fullname || '', email: currentInfo.email || '' }));
      setFinalImage(currentInfo.avatar || "/defaultProfile.png");
    }

    setImageSizeKB(null);
    setIsEmailSent(false);
    setForgotPassMode(false); 
  }, [subOption, navigate]);

  useEffect(() => {
    setFormData(prev => ({ ...prev, fullname: '', username: '', email: '', password: '', newPassword: '' }));
    setFinalImage(null);
  }, [subOption]);

  useEffect(() => {
    if (subOption === 'setting' && info) {
      setFormData(prev => ({ ...prev, fullname: info.fullname || '', email: info.email || '' }));
      setFinalImage(info.avatar || "/defaultProfile.png");
    }
  }, [info, subOption]);

  useEffect(() => {
    if (!formData.username || formData.username.length < 3 || subOption !== 'signup') {
      setUserStatus(null); setIsChecking(false); return;
    }
    setIsChecking(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.get(`/api/auth/check-username?query=${formData.username}`);
        setUserStatus(res.data.success ? 'taken' : 'available');
      } catch (err) { setUserStatus(null); }
      finally { setIsChecking(false); }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.username, subOption]);

  // ==========================================
  // HANDLERS
  // ==========================================
  const handleInput = (e) => setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => { setImgSrc(reader.result?.toString() || ''); setIsCropModalOpen(true); });
      reader.readAsDataURL(e.target.files[0]);
      e.target.value = ''; 
    }
  };

  const handleConfirmCrop = async () => {
    if (imgRef.current && completedCrop) {
      const base64 = await getCroppedImg(imgRef.current, completedCrop);
      const blob = dataURLtoBlob(base64);
      const sizeInKB = (blob.size / 1024).toFixed(2);
      if (sizeInKB > 512) { toast.error(`DATA_OVERLOAD: Image is ${sizeInKB}KB. Maximum limit is 512KB.`); return; }
      setFinalImage(base64);    
      setImageSizeKB(sizeInKB); 
      setIsCropModalOpen(false);
    }
  };

  const fetchCurrentProfile = async () => {
    setIsSyncing(true); setProfileLoading(true); 
    try {
      const res = await api.get('/api/auth/me');
      if (res.data.success) updateUserInfo(res.data.user);
    } catch (err) { console.log("Node status: Offline"); }
    finally { setTimeout(() => { setProfileLoading(false); setIsSyncing(false); }, 600); }
  };

  const handleVerifyLink = async (token) => {
    setLoading(true);
    try {
      await api.get(`/api/auth/verify-email?token=${token}`);
      toast.success("NEURAL LINK VERIFIED. SYSTEM ACCESS GRANTED.");
      navigate('/options/signin');
    } catch (err) { toast.error(err.response?.data?.message || "LINK EXPIRED OR INVALID."); }
    finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (formData.username.length < 3) { toast.error("Username must be at least 3 characters long."); return; }
    if (formData.password.length < 6) { toast.error("Password must be at least 6 characters long."); return; }
    setLoading(true);
    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => form.append(key, formData[key]));
      if (finalImage?.startsWith('data:')) form.append('avatar', dataURLtoBlob(finalImage), `${formData.username}.jpg`);
      const res = await api.post('/api/auth/register', form, { headers: { 'Content-Type': 'multipart/form-data' } }); 
      setIsEmailSent(true); 
      if (res.data.success) toast.success("REGISTRATION SUCCESSFUL.");
      if (res.data.link) {
        const urlObj = new URL(res.data.link);
        const redirect = urlObj.pathname + urlObj.search; 
        setTimeout(() => { navigate(redirect); }, 500);
      }
    } catch (err) { toast.error(err.response?.data?.message || "REGISTRATION FAILURE."); } 
    finally { setLoading(false); }
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    if (info?.username === formData.email || info?.email === formData.email) return toast.warn("User Already Logged In.");
    if (!formData.email || !formData.password) return toast.warn("IDENTITY CREDENTIALS REQUIRED.");
    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { email: formData.email, password: formData.password });
      const userData = res.data.user || res.data;
      if (userData && (userData.username || userData.email)) {
        updateUserInfo(userData);
        const displayName = userData.username || userData.fullname || "PILOT";
        toast.success(`PILOT ${displayName} ACCESS GRANTED.`);
        if (res.data.link) window.open(res.data.link, '_blank');
        setTimeout(() => navigate('/options/profile'), 500);
      } else { throw new Error("MALFORMED IDENTITY DATA."); }
    } catch (err) {
      if (err.response?.status === 403) { setIsEmailSent(true); toast.warning("IDENTITY UNVERIFIED. CHECK UPLINK."); }
      else toast.error(err.response?.data?.message || "ACCESS DENIED: NODE REJECTED CIPHER.");
    } finally { setLoading(false); }
  };

  const handleForgotPasswordRequest = async () => {
    if (reset) {
      if (formData.email.length < 6) { toast.error("Password must be at least 6 characters long."); return; }
      setLoading(true);
      try {
        const res = await api.post('/api/auth/reset-password', { email: id, token: reset, newPassword: formData.email });
        toast.success((res.data.message).toUpperCase());
      } catch (err) { toast.error((err.response?.data?.message).toUpperCase()); }
      finally { setLoading(false); setNewPWmode(false); setForgotPassMode(false); setFormData(pre => ({ ...pre, email: '' })); }
    } else {
      setLoading(true);
      try {
        const res = await api.post('/api/auth/forgot-password', { email: formData.email });
        setIsEmailSent(true);
        toast.success((res.data.message).toUpperCase());
        window.open((res.data.link), '_blank');
      } catch (err) { toast.error("IDENTITY NODE NOT FOUND."); }
      finally { setLoading(false); }
    }
  };

  const handleUpdateProfile = async (e) => {
    if (e) e.preventDefault();
    console.log(formData.fullname, info.fullname);
    // console.log(formData.username, info.username);
    console.log(formData.email, info.email);
    console.log(finalImage);
    if (formData.fullname===info.fullname && formData.email===info.email && finalImage===info.avatar) { toast.warn("PROFILE UPDATE FAILED: NO CHANGES DETECTED."); return; }
    setLoading(true); setIsSyncing(true);
    try {
      const form = new FormData();
      form.append('fullname', formData.fullname);
      if (finalImage?.startsWith('data:')) form.append('avatar', dataURLtoBlob(finalImage), 'update.jpg');
      const res = await api.put('/api/auth/update-profile', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (res.data.link) window.open(res.data.link, '_blank');
      if (!res.data.success) { toast.error(res.data.message); return; }
      updateUserInfo(res.data.user);
      toast.success("NEURAL PROFILE SYNCHRONIZED.");
    } catch (err) { toast.error("SYNC FAILURE."); console.log(err); } 
    finally { setLoading(false); setTimeout(() => setIsSyncing(false), 600); }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm("PURGE IDENTITY? DATA WIPEOUT IS PERMANENT.")) return;
    setLoading(true);
    try { 
      await api.delete('/api/auth/delete-account'); 
      resetUserStore(); 
      toast.error("IDENTITY PURGED FROM GRID.");
      navigate('/options/signup'); 
    } catch (err) { toast.error("PURGE SEQUENCE FAILED."); } 
    finally { setLoading(false); }
  };

  // ==========================================
  // XP percentage
  // ==========================================
  const xpPercent = Math.min(((stats?.xp || 0) / (stats?.nextLevelXp || 1000)) * 100, 100);

  // ==========================================
  // RENDER
  // ==========================================
  return (
    <div className="h-screen w-full bg-[#020205] text-white flex flex-col items-center justify-center p-2 sm:p-4 md:p-8 relative overflow-hidden">
      
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <Particles particleColors={[activeTheme.color, "#ffffff"]} particleCount={80} />
      </div>

      {/* Crop Modal */}
      {isCropModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-4 w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-black tracking-[0.3em] text-[#00ff3c]">DNA_CROP_INTERFACE</span>
              <X className="cursor-pointer text-gray-500 hover:text-white" onClick={() => setIsCropModalOpen(false)}/>
            </div>
            <div className="flex-1 overflow-auto rounded-lg border border-white/5 bg-black custom-scrollbar">
              <ReactCrop crop={crop} onChange={c => setCrop(c)} onComplete={c => setCompletedCrop(c)} aspect={1}>
                <img ref={imgRef} src={imgSrc} onLoad={(e) => {
                  const { width, height } = e.currentTarget;
                  setCrop(centerCrop(makeAspectCrop({ unit: '%', width: 90 }, 1, width, height), width, height));
                }} alt="Crop" crossOrigin='anonymous' className="w-full h-auto" />
              </ReactCrop>
            </div>
            <button onClick={handleConfirmCrop} className="w-full mt-4 py-3 bg-[#00ff3c] text-black font-black text-xs rounded-lg active:scale-95 transition-all">CONFIRM_DNA_SCAN</button>
          </div>
        </div>
      )}

      <div className="w-full max-w-6xl z-10 flex flex-col h-full max-h-[90vh] bg-black/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="flex flex-col md:flex-row h-full overflow-hidden">
          
          {/* ── Sidebar ── */}
          <div className="w-full md:w-[240px] flex-shrink-0 bg-white/[0.03] border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col">
            <button type="button" onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 group transition-all">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/>
              <span className="text-[10px] font-black tracking-widest uppercase">Dashboard</span>
            </button>
            <nav className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-4 md:pb-0">
              {Object.entries(subOptionsMap).map(([key, value]) => (
                <Link key={key} to={`/options/${key}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap text-xs font-bold uppercase tracking-wider ${subOption === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`} style={{ borderLeft: subOption === key ? `3px solid ${value.color}` : '3px solid transparent' }}>
                  {value.icon} {key}
                </Link>
              ))}
            </nav>
          </div>

          {/* ── Main Content ── */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-8 pb-0 flex-shrink-0">
              <GradientText colors={[activeTheme.color, "#ffffff"]} className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight">
                {isEmailSent ? "TRANS_PENDING" : activeTheme.title}
              </GradientText>
              <div className="h-1 w-full mt-2" style={{ backgroundColor: activeTheme.color, boxShadow: `0 0 10px ${activeTheme.color}` }} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6">

              {/* ─── TRANSMISSION PENDING ─── */}
              {isEmailSent && (
                <div className="max-w-md space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="p-6 bg-[#00ff3c]/10 border border-[#00ff3c]/20 rounded-2xl flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-[#00ff3c]/20 rounded-full flex items-center justify-center animate-pulse">
                      <Mail size={32} className="text-[#00ff3c]"/>
                    </div>
                    <p className="text-sm font-mono text-[#00ff3c] uppercase tracking-widest">
                      Verification Link Broadcast:<br/>
                      <span className="text-white bg-[#00ff3c]/20 px-2">{formData.email}</span>
                    </p>
                    <p className="text-[10px] text-gray-500 italic">Authenticate your pilot identity via the neural uplink sent to your inbox. Valid for 60m.</p>
                  </div>
                  <button onClick={() => setIsEmailSent(false)} className="w-full py-4 border border-gray-800 text-gray-500 hover:text-white font-black uppercase text-[10px] rounded-xl transition-all">Abort Transmission</button>
                </div>
              )}

              {/* ─── SIGNIN ─── */}
              {!isEmailSent && subOption === 'signin' && (
                <div className="max-w-md space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="space-y-1">
                    <label className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">{newPWmode ? "New Cipher" : "Identity Email"}</label>
                    <div className="relative group">
                      {newPWmode
                        ? <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#2b01ff]" size={18}/>
                        : <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#2b01ff]" size={18}/>
                      }
                      <input name="email" value={formData.email || ''} onChange={handleInput} type="email" placeholder={newPWmode ? "Enter Password" : "Email Address"} className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none text-sm transition-all focus:border-[#2b01ff]/40" />
                    </div>
                  </div>
                  
                  {!forgotPassMode && !newPWmode ? (
                    <>
                      <div className="space-y-1">
                        <label className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">Security Cipher</label>
                        <div className="relative group">
                          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#2b01ff]" size={18}/>
                          <input name="password" value={formData.password || ''} onChange={handleInput} type={showPass ? "text" : "password"} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 outline-none text-sm transition-all focus:border-[#2b01ff]/40" />
                          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                        </div>
                      </div>
                      <button onClick={handleSignin} disabled={loading} className="w-full py-4 bg-[#2b01ff] font-black uppercase text-xs tracking-widest rounded-xl hover:shadow-[0_0_20px_#2b01ff] transition-all active:scale-95">
                        {loading ? <Loader2 className="animate-spin mx-auto"/> : "INITIALIZE_ACCESS"}
                      </button>
                      <button onClick={() => setForgotPassMode(true)} className="w-full text-[9px] text-gray-500 hover:text-[#2b01ff] uppercase tracking-widest">Forgotten Cipher?</button>
                    </>
                  ) : (
                    <div className="space-y-4 animate-in slide-in-from-bottom-4">
                      <button onClick={handleForgotPasswordRequest} className="w-full py-4 bg-[#fff200] text-black font-black uppercase text-xs rounded-xl hover:shadow-[0_0_15px_#fff200] transition-all">
                        {newPWmode ? "RESET_PASSWORD" : "SEND_RECOVERY_LINK"}
                      </button>
                      <button onClick={() => setForgotPassMode(false)} className="w-full text-[9px] text-gray-500 hover:text-white uppercase tracking-widest">{!newPWmode && "Back"}</button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── SIGNUP ─── */}
              {!isEmailSent && subOption === 'signup' && (
                <div className="max-w-4xl mx-auto w-full">
                  <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 pb-10 animate-in slide-in-from-right-4">
                    <div className="space-y-6">
                      <div className="flex flex-col items-center">
                        <div className={`relative w-36 h-36 rounded-[2rem] border-2 transition-all overflow-hidden cursor-pointer group ${finalImage ? 'border-[#00ff3c]' : 'border-dashed border-white/20'}`} onClick={() => fileInputRef.current.click()}>
                          {finalImage
                            ? <img src={finalImage} className="w-full h-full object-cover" alt="Avatar" />
                            : <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 group-hover:bg-white/5 transition-colors"><Upload size={24} className="mb-1"/><span className="text-[7px] font-black uppercase tracking-widest">SCAN_DNA</span></div>
                          }
                        </div>
                        {imageSizeKB && (
                          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#00ff3c] flex items-center gap-1.5">
                            <CheckCircle size={10}/> SCAN_SIZE: {imageSizeKB} KB
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Identity Node</label>
                        <div className="relative group">
                          <User className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${userStatus === 'available' ? 'text-[#00ff3c]' : userStatus === 'taken' ? 'text-red-500' : 'text-gray-600'}`} size={16}/>
                          <input name="username" value={formData.username || ''} onChange={handleInput} required type="text" placeholder="Unique ID..." className={`w-full bg-white/5 border rounded-xl py-3.5 pl-12 pr-12 outline-none text-sm transition-all ${userStatus === 'available' ? 'border-[#00ff3c]/40' : userStatus === 'taken' ? 'border-red-500/40' : 'border-white/10'}`} />
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {isChecking ? <Loader2 className="animate-spin text-gray-500" size={14}/> : <>{userStatus === 'available' && <CheckCircle className="text-[#00ff3c]" size={14}/>}{userStatus === 'taken' && <XCircle className="text-red-500" size={14}/>}</>}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Pilot Designation</label>
                        <div className="relative group">
                          <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#00ff3c] transition-colors" size={16}/>
                          <input name="fullname" value={formData.fullname || ''} onChange={handleInput} required type="text" placeholder="Your Name" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 outline-none text-sm focus:border-[#00ff3c]/40 transition-all" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6 flex flex-col justify-end">
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Email Comms</label>
                        <div className="relative group">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#00ff3c]" size={16}/>
                          <input name="email" value={formData.email || ''} onChange={handleInput} required type="email" placeholder="neo@ludo.com" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 outline-none text-sm focus:border-[#00ff3c]/40 transition-all" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Access Cipher</label>
                        <div className="relative group">
                          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#00ff3c]" size={16}/>
                          <input name="password" value={formData.password || ''} onChange={handleInput} required type={showPass ? "text" : "password"} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 outline-none text-sm focus:border-[#00ff3c]/40 transition-all" />
                          <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button>
                        </div>
                      </div>
                      <button type="submit" disabled={loading || userStatus === 'taken' || isChecking} className="w-full py-4 mt-2 bg-[#00ff3c] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:shadow-[0_0_20px_#00ff3c] transition-all disabled:opacity-30">
                        {loading ? <Loader2 className="animate-spin mx-auto" size={16}/> : "INITIALIZE_PILOT_SEQUENCE"}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* ─── PROFILE (VIEW ONLY) ─── */}
              {!isEmailSent && subOption === 'profile' && (
                profileLoading ? <ProfileSkeleton /> : (
                  <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-500 pb-8">

                    {/* Hero Card */}
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-gradient-to-r from-white/[0.05] to-transparent border border-white/10 rounded-[1.5rem] relative overflow-hidden">
                      <div className="relative flex-shrink-0">
                        <div className="w-20 h-20 rounded-2xl border-2 border-[#ff0505] p-0.5 bg-black overflow-hidden">
                          <img src={info?.avatar || "/defaultProfile.png"} className="w-full h-full object-cover rounded-[calc(1rem-2px)]" alt="Profile" />
                        </div>
                        {info?.isVerified && (
                          <div className="absolute -bottom-1 -right-1 bg-[#ff0505] p-1 rounded-lg shadow-lg border-[3px] border-[#0a0a0f]">
                            <ShieldCheck size={10} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div className="text-center sm:text-left space-y-0.5 flex-1">
                        <h4 className="text-[8px] font-black tracking-[0.3em] text-[#ff0505] uppercase opacity-70">Authenticated_Pilot</h4>
                        <p className="text-2xl font-black uppercase tracking-tight text-white leading-tight">{info?.fullname || "Pilot Designation"}</p>
                        <p className="text-[10px] font-mono text-gray-500 lowercase opacity-60">@{info?.username || "identity_pending"}</p>
                        <p className="text-[9px] font-mono text-gray-600 opacity-50">{info?.email}</p>
                      </div>
                      {/* Level Badge */}
                      <div className="flex-shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-[#ff0505]/10 border border-[#ff0505]/30">
                        <span className="text-[7px] text-[#ff0505] uppercase tracking-widest font-black">LVL</span>
                        <span className="text-2xl font-black text-white leading-tight">{stats?.level || 1}</span>
                      </div>
                    </div>

                    {/* XP Progress */}
                    <div className="p-5 bg-white/[0.02] border border-white/5 rounded-[2rem] space-y-3">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <Activity size={14} className="text-[#ff0505] animate-pulse" />
                          <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Neural_XP</span>
                        </div>
                        <span className="text-[9px] font-mono text-gray-500">{stats?.xp || 0} / {stats?.nextLevelXp || 1000} XP</span>
                      </div>
                      <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${xpPercent}%`, backgroundColor: '#ff0505', boxShadow: '0 0 8px #ff0505' }}
                        />
                      </div>
                      <p className="text-[8px] text-gray-600 font-mono uppercase tracking-widest">{(stats?.nextLevelXp || 1000) - (stats?.xp || 0)} XP to Level {(stats?.level || 1) + 1}</p>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Victories',    value: stats?.wins         || 0,    color: '#00ff3c', icon: <Trophy size={16}/> },
                        { label: 'Defeats',      value: stats?.losses       || 0,    color: '#ff0505', icon: <Skull size={16}/> },
                        { label: 'Win_Rate',     value: stats?.winRate      || '0%', color: '#00D4FF', icon: <Target size={16}/> },
                      ].map(item => (
                        <div key={item.label} className="p-4 bg-white/[0.02] border border-white/5 rounded-[1.5rem] text-center space-y-2 hover:border-white/10 transition-colors">
                          <div className="flex justify-center" style={{ color: item.color }}>{item.icon}</div>
                          <p className="text-2xl font-black" style={{ color: item.color, textShadow: `0 0 12px ${item.color}55` }}>{item.value}</p>
                          <span className="text-[8px] uppercase tracking-widest text-gray-600 block">{item.label}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total Matches */}
                    <div className="p-4 bg-white/[0.02] border border-white/5 rounded-[1.5rem] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Cpu size={16} className="text-gray-500" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Total_Matches_Played</span>
                      </div>
                      <span className="text-lg font-black text-white">{stats?.totalMatches || 0}</span>
                    </div>

                    {/* Badges */}
                    <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Star size={16} className="text-[#ff0505]" />
                          <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Earned_Badges</h5>
                        </div>
                        <span className="text-[9px] font-mono text-gray-600">{earnedBadges.length}/{BADGE_DEFS.length}</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {BADGE_DEFS.map(badge => {
                          const earned = badge.cond(stats);
                          return (
                            <div key={badge.id} className={`p-3 rounded-[1rem] border text-center space-y-1.5 transition-all ${earned ? 'border-white/10 bg-white/[0.03]' : 'border-white/[0.03] bg-transparent opacity-30 grayscale'}`}>
                              <div className="flex justify-center" style={{ color: earned ? badge.color : '#444' }}>{badge.icon}</div>
                              <p className="text-[9px] font-black uppercase tracking-wide" style={{ color: earned ? badge.color : '#555' }}>{badge.label}</p>
                              <p className="text-[7px] text-gray-600 uppercase tracking-widest">{badge.desc}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Match History */}
                    {stats?.matchHistory?.length > 0 && (
                      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] space-y-4">
                        <div className="flex items-center gap-3">
                          <Clock size={16} className="text-[#fff200]" />
                          <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Match_History</h5>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {stats.matchHistory.slice(-10).reverse().map((match, i) => (
                            <div key={i} className="group relative overflow-hidden rounded-xl bg-black/40 border border-white/[0.03] p-4 hover:border-white/10 transition-colors">
                              <div className={`absolute top-0 left-0 w-1.5 h-full transition-transform origin-left ${match.result === 'win' ? 'bg-[#00ff3c]' : 'bg-[#ff0505]'}`} />
                              <div className="flex justify-between items-center pl-2">
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-widest text-white flex items-center gap-2">
                                    {match.result === 'win' ? <Trophy size={12} className="text-[#00ff3c]"/> : <Skull size={12} className="text-[#ff0505]"/>}
                                    {match.result === 'win' ? 'Victory' : 'Defeat'}
                                  </p>
                                  <p className="text-[8px] text-gray-500 font-mono mt-1 uppercase tracking-widest">
                                    <span className="text-[#00D4FF]">{match.gameType}</span> • VS {match.opponent}
                                  </p>
                                </div>
                                <p className="text-[8px] text-gray-600 font-mono">{new Date(match.date).toLocaleDateString()}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                  </div>
                )
              )}

              {/* ─── SETTINGS ─── */}
              {subOption === "setting" && (
                <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-500 pb-8">

                  {/* Audio Config */}
                  <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] space-y-6">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                      <Settings size={18} className="text-[#fff200]" />
                      <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Audio_Config</h5>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button onClick={() => toggleSound(!sound)} className="w-full flex items-center justify-between p-5 rounded-[1.5rem] bg-black/40 border border-white/5 hover:border-[#00ff3c]/30 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl bg-white/5 group-hover:bg-[#00ff3c]/10 transition-colors ${sound ? "text-[#00ff3c]" : "text-gray-500"}`}>
                            {sound ? <Volume2 size={20}/> : <VolumeX size={20}/>}
                          </div>
                          <div className="text-left">
                            <span className="block text-sm font-bold uppercase tracking-tight text-white">SFX Output</span>
                            <span className="block text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Interface Sounds</span>
                          </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full p-1 transition-colors ${sound ? 'bg-[#00ff3c]' : 'bg-gray-800'}`}>
                          <div className={`w-3 h-3 bg-black rounded-full transition-transform ${sound ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </button>
                      <button onClick={() => toggleMusic(!music)} className="w-full flex items-center justify-between p-5 rounded-[1.5rem] bg-black/40 border border-white/5 hover:border-[#00D4FF]/30 transition-all group">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl bg-white/5 group-hover:bg-[#00D4FF]/10 transition-colors ${music ? "text-[#00D4FF]" : "text-gray-500"}`}>
                            {music ? <Music2 size={20}/> : <Music size={20}/>}
                          </div>
                          <div className="text-left">
                            <span className="block text-sm font-bold uppercase tracking-tight text-white">Neural BGM</span>
                            <span className="block text-[9px] text-gray-500 uppercase tracking-widest mt-0.5">Background Music</span>
                          </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full p-1 transition-colors ${music ? 'bg-[#00D4FF]' : 'bg-gray-800'}`}>
                          <div className={`w-3 h-3 bg-black rounded-full transition-transform ${music ? 'translate-x-5' : 'translate-x-0'}`} />
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Pilot Config (Update Profile) */}
                  <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] space-y-6">
                    <div className="flex items-center justify-between border-b border-white/5 pb-4">
                      <div className="flex items-center gap-3">
                        <Fingerprint size={18} className="text-[#fff200]" />
                        <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Pilot_Config</h5>
                      </div>
                      {isSyncing && (
                        <div className="flex items-center gap-2 text-[#00ff3c]">
                          <Loader2 size={12} className="animate-spin" />
                          <span className="text-[8px] font-black tracking-widest uppercase">Syncing</span>
                        </div>
                      )}
                    </div>
                    <form onSubmit={handleUpdateProfile} className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                      {/* Avatar Upload */}
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative w-28 h-28 rounded-[1.5rem] border-2 border-dashed border-white/20 overflow-hidden cursor-pointer group hover:border-[#fff200]/40 transition-all" onClick={() => fileInputRef.current.click()}>
                          {finalImage
                            ? <img src={finalImage} className="w-full h-full object-cover" alt="Avatar" />
                            : <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 group-hover:bg-white/5 transition-colors"><Upload size={20} className="mb-1"/></div>
                          }
                          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Upload size={16} className="text-[#fff200]" />
                          </div>
                        </div>
                        {imageSizeKB && (
                          <div className="text-[9px] font-black uppercase tracking-widest text-[#00ff3c] flex items-center gap-1.5">
                            <CheckCircle size={10}/> {imageSizeKB} KB
                          </div>
                        )}
                        <span className="text-[8px] text-gray-600 uppercase tracking-widest">Update Avatar</span>
                      </div>
                      {/* Fullname */}
                      <div className="space-y-4">
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">Pilot Designation</label>
                          <div className="relative group">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#fff200] transition-colors" size={16}/>
                            <input name="fullname" value={formData.fullname || ''} onChange={handleInput} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 outline-none text-sm focus:border-[#fff200]/40 focus:bg-white/[0.08] transition-all" />
                          </div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-4 bg-[#fff200] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(255,242,0,0.3)] active:scale-95 transition-all disabled:opacity-30">
                          {loading ? <Loader2 className="animate-spin mx-auto" size={16}/> : "SYNC_NEURAL_PROFILE"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Cipher Node (Password Reset) */}
                  <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] space-y-4">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                      <ShieldCheck size={18} className="text-[#fff200]" />
                      <h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Cipher_Node</h5>
                    </div>
                    <p className="text-[10px] text-gray-500 leading-relaxed font-mono italic font-bold">Access cipher resets require node-broadcast authorization.</p>
                    <button onClick={handleForgotPasswordRequest} className="w-full py-4 border border-[#fff200]/30 text-[#fff200] hover:bg-[#fff200] hover:text-black font-black uppercase text-[10px] rounded-xl transition-all flex items-center justify-center gap-2 group">
                      <RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-500"/> REQUEST_CIPHER_LINK
                    </button>
                  </div>

                  {/* Danger Zone (Delete Account) */}
                  <div className="bg-red-950/10 border border-red-900/10 p-6 rounded-[2rem] space-y-4">
                    <div className="flex items-center gap-3 border-b border-red-900/10 pb-4">
                      <Trash2 size={16} className="text-red-900/60" />
                      <span className="text-[11px] font-black uppercase tracking-[0.2em] text-red-900/60">Protocol_PURGE_ID</span>
                    </div>
                    <p className="text-[10px] text-red-900/40 leading-relaxed font-mono">This action is irreversible. All pilot data, stats, and inventory will be permanently erased from the grid.</p>
                    <button onClick={handleDeleteAccount} className="w-full py-3.5 bg-transparent border border-red-900/30 text-red-900 hover:bg-red-900 hover:text-white font-black uppercase text-[10px] rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
                      <Trash2 size={14}/> TERMINATE_IDENTITY
                    </button>
                  </div>

                </div>
              )}

            </div>
          </div>
        </div>
      </div>
      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleSelectFile} />
    </div>
  );
};

export default Options;