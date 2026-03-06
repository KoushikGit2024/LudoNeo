import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from "react-router-dom";
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { 
  ArrowLeft, User, Settings, LogIn, UserPlus, 
  CheckCircle, XCircle, Loader2, Mail, Fingerprint, X, Crop, Upload, 
  ShieldCheck, Eye, EyeOff, Save, RefreshCcw, Trash2, Activity, Cpu, Globe
} from 'lucide-react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GradientText from '@/components/customComponents/GradientText';
import Particles from '@/components/customComponents/Particles';
import api from '@/api/axiosConfig'; 
import { updateUserInfo, resetUserStore } from "@/store/userActions"; 
import { useShallow } from 'zustand/shallow';
import useUserStore from '@/store/userStore';
import "../styles/options.css";

const ProfileSkeleton = () => (
  <div className="max-w-4xl mx-auto space-y-6 animate-pulse pb-8">
    <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-white/5 border border-white/10 rounded-[1.5rem]">
      <div className="w-20 h-20 rounded-2xl bg-white/10" />
      <div className="space-y-2 flex-1">
        <div className="h-2 w-24 bg-[#ff0505]/20 rounded" />
        <div className="h-8 w-48 bg-white/10 rounded" />
        <div className="h-3 w-32 bg-white/5 rounded" />
      </div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-80 bg-white/[0.02] border border-white/5 rounded-[2rem]" />
      <div className="space-y-6">
        <div className="h-40 bg-white/[0.02] border border-white/5 rounded-[2rem]" />
        <div className="h-32 bg-red-950/10 border border-red-900/10 rounded-[2rem]" />
      </div>
    </div>
  </div>
);

// --- Helpers ---
const dataURLtoBlob = (dataurl) => {
  if (!dataurl) return null;
  let arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], {type:mime});
}

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
  return canvas.toDataURL('image/jpeg',0.8); 
}

const Options = () => {
  const { subOption } = useParams();
  const [searchParams,setURL] = useSearchParams();
  const navigate = useNavigate();

  // --- States ---
  const [formData, setFormData] = useState({ fullname: '', username: '', email: '', password: '', newPassword: '' });
  const [loading, setLoading] = useState(false);
  const [isEmailSent, setIsEmailSent] = useState(false); 
  const reset=searchParams.get("reset");
  const id=searchParams.get("id")
  // console.log()
  const [forgotPassMode, setForgotPassMode] = useState(false); // FIXED: Restored state
  const [newPWmode, setNewPWmode] = useState((reset && id)? true : false);
  const [showPass, setShowPass] = useState(false);
  const [imgSrc, setImgSrc] = useState('');
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [finalImage, setFinalImage] = useState(null);
  const [isChecking, setIsChecking] = useState(false);
  const [userStatus, setUserStatus] = useState(null);
  const [imageSizeMB, setImageSizeMB] = useState(null);
  const imgRef = useRef(null);
  const fileInputRef = useRef(null);

  
  const subOptionsMap = {
    profile: { icon: <User size={20}/>, color: "#ff0505", title: "User Profile" },
    signin: { icon: <LogIn size={20}/>, color: "#2b01ff", title: "System Access" },
    setting: { icon: <Settings size={20}/>, color: "#fff200", title: "Game Config" },
    signup: { icon: <UserPlus size={20}/>, color: "#00ff3c", title: "Register Pilot" }
  };

  const activeTheme = subOptionsMap[subOption] || subOptionsMap.profile;
  const info = useUserStore(useShallow((state) => state.info));
  
  // useEffect(()=>{
  //   console.log(forgotPassMode)
  // },[forgotPassMode])
  // --- Handle Magic Link Verification ---
  useEffect(() => {
    const token = searchParams.get("token");
    if (token) {
      handleVerifyLink(token);
    }
    
    // console.log({reset,id})
    if (reset && id) {
      // handleResetPassword(resetPW);
      // handleForgotPasswordRequest(reset);
      // setNewPWmode(true)
      // console.log('Hi')
      setForgotPassMode(true);
    }
  }, [searchParams]);

  
  const handleVerifyLink = async (token) => {
    setLoading(true);
    try {
      await api.get(`/api/auth/verify-email?token=${token}`);
      toast.success("NEURAL LINK VERIFIED. SYSTEM ACCESS GRANTED.");
      navigate('/options/signin');
    } catch (err) {
      toast.error(err.response?.data?.message || "LINK EXPIRED OR INVALID.");
    } finally {
      setLoading(false);
    }
  };

  // --- Sync Store to Local State & Auto-Fetch Profile ---
  useEffect(() => {
    // 1. Guard against invalid subOptions
    if (!subOptionsMap[subOption]) {
      navigate('/dashboard');
      return;
    }

    // 2. Set Theme Styling
    document.documentElement.style.setProperty('--active-neon', activeTheme.color);

    // 3. Handle Profile-Specific Logic
    if (subOption === 'profile') {
      // Sync local form state with global store info
      setFormData(prev => ({ 
        ...prev, 
        fullname: info?.fullname || '', 
        username: info?.username || '', 
        email: info?.email || '' 
      }));
      setFinalImage(info?.avatar || "/defaultProfile.png");

      // FIX: Call the declared function to refresh profile data from the server
      if(info.email!==""){
        fetchCurrentProfile(); 
      }
    }
    if(subOption==='signin' || subOption==='signup'){
      setFormData(prev => ({ 
        ...prev, 
        fullname: '', 
        username: '', 
        email: '' 
      }));
      setFinalImage(null);
      // console.log('signin')
    }
    setImageSizeMB(null);
    // 4. Reset secondary states on tab change
    setIsEmailSent(false);
    setForgotPassMode(false); 
    
  }, [subOption, info, navigate]); // Added dependencies for stability

  // --- Debounced Username Check ---
  useEffect(() => {
    if (!formData.username || formData.username.length < 8 || subOption !== 'signup') {
      setUserStatus(null);
      setIsChecking(false)
      return;
    }
    // console.log('Checking username',formData.username)
    setIsChecking(true);
    const timeoutId = setTimeout(async () => {
      try {
        const res = await api.get(`/api/auth/check-username?username=${formData.username}`);
        setUserStatus(res.data.available ? 'available' : 'taken');
      } catch (err) { setUserStatus(null); }
      finally { setIsChecking(false); }
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [formData.username, subOption]);

  const handleInput = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
  };

  const handleSelectFile = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const reader = new FileReader();
      reader.addEventListener('load', () => { 
        setImgSrc(reader.result?.toString() || ''); 
        setIsCropModalOpen(true); 
      });
      reader.readAsDataURL(e.target.files[0]);
      
      e.target.value = ''; 
    }
  };

  const handleConfirmCrop = async () => {
    if (imgRef.current && completedCrop) {
      const base64 = await getCroppedImg(imgRef.current, completedCrop);
      
      // Calculate exact file size
      const blob = dataURLtoBlob(base64);
      const sizeInMB = (blob.size / (1024 * 1024)).toFixed(2);

      // Validate against 2MB limit
      if (sizeInMB > 2.0) {
         toast.error(`DATA_OVERLOAD: Image is ${sizeInMB}MB. Maximum limit is 2.00MB.`);
         return; // Abort the crop confirmation!
      }

      setFinalImage(base64);
      setImageSizeMB(sizeInMB); // Save size to state
      setIsCropModalOpen(false);
    }
  };

  // --- States ---
  // ... existing states
  const [profileLoading, setProfileLoading] = useState(false); // New state for skeleton

  // --- Handlers ---
  const fetchCurrentProfile = async () => {
    setProfileLoading(true); // Start loading
    try {
      const res = await api.get('/api/auth/me');
      if (res.data.success) {
        updateUserInfo(res.data.user);
      }
    } catch (err) {
      console.log("Node status: Offline");
    } finally {
      // Small timeout makes the transition feel smoother
      setTimeout(() => setProfileLoading(false), 600); 
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if(formData.username.length>0 && formData.username.length<8){
      toast.error("Username must be at least 8 characters long.");
      return;
    }
    if(formData.password.length<8){
      toast.error("Password must be at least 8 characters long.");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      Object.keys(formData).forEach(key => form.append(key, formData[key]));
      if (finalImage?.startsWith('data:')) form.append('avatar', dataURLtoBlob(finalImage), `${formData.username}.jpg`);
      await api.post('/api/auth/register', form,{ headers: { 'Content-Type': 'multipart/form-data' } });
      setIsEmailSent(true); 
      toast.success("INITIALIZATION LINK BROADCAST TO NODE.");
    } catch (err) { toast.error(err.response?.data?.message || "REGISTRATION FAILURE."); }
    finally { setLoading(false); }
  };
  const curData=useUserStore(useShallow((state) => state.info));
  const handleSignin = async (e) => {
    e.preventDefault();
    if(curData.username===formData.email || curData.email===formData.email){
      return toast.warn("User Already Logged In.");
    }
    if (!formData.email || !formData.password) {
      return toast.warn("IDENTITY CREDENTIALS REQUIRED.");
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/login', { 
        email: formData.email, 
        password: formData.password 
      });
      console.log(res.data)
      // Extract user data regardless of whether it's nested under .user or not
      const userData = res.data.user || res.data;
      //  console.log(useUserStore);
      if (userData && (userData.username || userData.email)) {
        // Update store with the actual user object
        updateUserInfo(userData);
        console.log(userData);
        const displayName = userData.username || userData.fullname || "PILOT";
        toast.success(`PILOT ${displayName} ACCESS GRANTED.`);
        
        // Brief delay before navigation ensures store persistence is triggered
        setTimeout(() => navigate('/options/profile'), 500);
      } else {
        throw new Error("MALFORMED IDENTITY DATA.");
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setIsEmailSent(true);
        toast.warning("IDENTITY UNVERIFIED. CHECK UPLINK.");
      } else {
        toast.error(err.response?.data?.message || "ACCESS DENIED: NODE REJECTED CIPHER.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPasswordRequest = async () => {
    
    // if(searchParams.get("reset") && subOption!="signin"){
    //   return toast.warn("INVALID REQUEST.");
    // }
    const resetToken=searchParams.get('reset');
    if(resetToken){
      if(formData.email.length<8){
      toast.error("Password must be at least 8 characters long.");
      return;
    }
      setLoading(true);
      let res;
      try {
        const eid=searchParams.get('id');
        
        res=await api.post('/api/auth/reset-password', { email: eid,token:resetToken,newPassword:formData.email });
        // setIsEmailSent(true);
        toast.success((res.data.message).toUpperCase());
      } catch (err) { toast.error((err.response?.data?.message).toUpperCase()); }
      finally { setLoading(false); setNewPWmode(false); setForgotPassMode(false); setFormData(pre=>({...pre,email:''}))}
    } else {
      setLoading(true);
      try {
        await api.post('/api/auth/forgot-password', { email: formData.email });
        setIsEmailSent(true);
        toast.success("RECOVERY LINK BROADCAST.");
      } catch (err) { toast.error("IDENTITY NODE NOT FOUND."); }
      finally { setLoading(false); }
    }
  };
  // const all =useUserStore(useShallow(state=>state))
  // console.log(all);
  const handleUpdateProfile = async (e) => {
    if(e) e.preventDefault();
    setLoading(true);
    try {
      const form = new FormData();
      form.append('fullname', formData.fullname);
      if (finalImage?.startsWith('data:')) form.append('avatar', dataURLtoBlob(finalImage), 'update.jpg');
      const res = await api.put('/api/auth/update-profile', form,{headers: { 'Content-Type': 'multipart/form-data' }});
      if(!res.data.success){
        toast.error(res.data.message);
        return;
      }
      updateUserInfo(res.data.user);
      toast.success("NEURAL PROFILE SYNCHRONIZED.");
    } catch (err) { toast.error("SYNC FAILURE."); }
    finally { setLoading(false); }
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

  return (
    <div className="h-screen w-full bg-[#020205] text-white flex flex-col items-center justify-center p-2 sm:p-4 md:p-8 relative overflow-hidden">
      <ToastContainer position="top-right" autoClose={3000} theme="dark" /> 
      
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <Particles particleColors={[activeTheme.color, "#ffffff"]} particleCount={80} />
      </div>

      {isCropModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4">
          <div className="bg-[#0a0a0f] border border-white/10 rounded-2xl p-4 w-full max-w-lg flex flex-col max-h-[90vh] shadow-2xl">
             <div className="flex justify-between items-center mb-4"><span className="text-[10px] font-black tracking-[0.3em] text-[#00ff3c]">DNA_CROP_INTERFACE</span><X className="cursor-pointer text-gray-500 hover:text-white" onClick={() => setIsCropModalOpen(false)}/></div>
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
          
          {/* Sidebar */}
          <div className="w-full md:w-[240px] flex-shrink-0 bg-white/[0.03] border-b md:border-b-0 md:border-r border-white/10 p-6 flex flex-col">
            <button onClick={() => navigate('/dashboard')} className="flex items-center gap-2 text-gray-500 hover:text-white mb-8 group transition-all">
              <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform"/><span className="text-[10px] font-black tracking-widest uppercase">Dashboard</span>
            </button>
            <nav className="flex md:flex-col gap-2 overflow-x-auto no-scrollbar pb-4 md:pb-0">
              {Object.entries(subOptionsMap).map(([key, value]) => (
                <Link key={key} to={`/options/${key}`} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap text-xs font-bold uppercase tracking-wider ${subOption === key ? 'bg-white/10 text-white' : 'text-gray-500 hover:bg-white/5'}`} style={{ borderLeft: subOption === key ? `3px solid ${value.color}` : '3px solid transparent' }}>
                  {value.icon} {key}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-8 pb-0 flex-shrink-0">
              <GradientText colors={[activeTheme.color, "#ffffff"]} className="text-3xl md:text-5xl font-black uppercase tracking-tighter leading-tight">
                {isEmailSent ? "TRANS_PENDING" : activeTheme.title}
              </GradientText>
              <div className="h-1 w-full mt-2" style={{ backgroundColor: activeTheme.color, boxShadow: `0 0 10px ${activeTheme.color}` }} />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pt-6">
              
              {/* --- TRANSMISSION SCREEN --- */}
              {isEmailSent && (
                <div className="max-w-md space-y-6 animate-in slide-in-from-bottom-4">
                  <div className="p-6 bg-[#00ff3c]/10 border border-[#00ff3c]/20 rounded-2xl flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 bg-[#00ff3c]/20 rounded-full flex items-center justify-center animate-pulse"><Mail size={32} className="text-[#00ff3c]"/></div>
                    <p className="text-sm font-mono text-[#00ff3c] uppercase tracking-widest">Verification Link Broadcast:<br/><span className="text-white bg-[#00ff3c]/20 px-2">{formData.email}</span></p>
                    <p className="text-[10px] text-gray-500 italic">Authenticate your pilot identity via the neural uplink sent to your inbox. Valid for 60m.</p>
                  </div>
                  <button onClick={() => setIsEmailSent(false)} className="w-full py-4 border border-gray-800 text-gray-500 hover:text-white font-black uppercase text-[10px] rounded-xl transition-all">Abort Transmission</button>
                </div>
              )}

              {/* --- SIGNIN --- */}
              {!isEmailSent && subOption === 'signin' && (
                <div className="max-w-md space-y-6 animate-in fade-in slide-in-from-right-4">
                  <div className="space-y-1"><label className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">{newPWmode ? "New Cipher":"Identity Email"}</label><div className="relative group">
                    {
                      (newPWmode)?
                      <Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#2b01ff]" size={18}/>
                      :<Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#2b01ff]" size={18}/>
                    }
                    
                    <input name="email" value={formData.email || ''} onChange={handleInput} type="email" placeholder={newPWmode? "Enter Password":"Email Address"} className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-4 outline-none text-sm transition-all focus:border-[#2b01ff]/40" />
                    </div>
                  </div>
                  
                  {!forgotPassMode && !newPWmode ? (
                    <>
                      <div className="space-y-1"><label className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">Security Cipher</label><div className="relative group"><ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#2b01ff]" size={18}/><input name="password" value={formData.password || ''} onChange={handleInput} type={showPass ? "text" : "password"} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl py-4 pl-12 pr-12 outline-none text-sm transition-all focus:border-[#2b01ff]/40" /><button onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
                      <button onClick={handleSignin} disabled={loading} className="w-full py-4 bg-[#2b01ff] font-black uppercase text-xs tracking-widest rounded-xl hover:shadow-[0_0_20px_#2b01ff] transition-all active:scale-95">{loading ? <Loader2 className="animate-spin mx-auto"/> : "INITIALIZE_ACCESS"}</button>
                      <button onClick={() => setForgotPassMode(true)} className="w-full text-[9px] text-gray-500 hover:text-[#2b01ff] uppercase tracking-widest">Forgotten Cipher?</button>
                    </>
                  ) : (
                    <div className="space-y-4 animate-in slide-in-from-bottom-4"><button onClick={handleForgotPasswordRequest} className="w-full py-4 bg-[#fff200] text-black font-black uppercase text-xs rounded-xl hover:shadow-[0_0_15px_#fff200] transition-all">
                      {newPWmode ? "RESET_PASSWORD" : "SEND_RECOVERY_LINK"}
                    </button><button onClick={() => setForgotPassMode(false)} className="w-full text-[9px] text-gray-500 hover:text-white uppercase tracking-widest">{!newPWmode && "Back"}</button></div>
                  )}
                </div>
              )}

              {/* --- SIGNUP --- */}
              {!isEmailSent && subOption === 'signup' && (
                <div className="max-w-4xl mx-auto w-full">
                  <form onSubmit={handleRegister} className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8 pb-10 animate-in slide-in-from-right-4">
                    <div className="space-y-6">
                       <div className="flex flex-col items-center">
                        <div className={`relative w-36 h-36 rounded-[2rem] border-2 transition-all overflow-hidden cursor-pointer group ${finalImage ? 'border-[#00ff3c]' : 'border-dashed border-white/20'}`} onClick={() => fileInputRef.current.click()}>{finalImage ? <img src={finalImage} className="w-full h-full object-cover" alt="Avatar" /> : <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 group-hover:bg-white/5 transition-colors"><Upload size={24} className="mb-1"/><span className="text-[7px] font-black uppercase tracking-widest">SCAN_DNA</span></div>}</div>
                        {finalImage && (
                          <div className="mt-2 text-[10px] text-gray-400 flex items-center gap-1">
                            <CheckCircle size={12} className="text-[#00ff3c]"/>
                            <span>{imageSizeMB} MB</span>
                          </div>
                        )}
                        {imageSizeMB  && (
                          <div className="mt-3 text-[10px] font-black uppercase tracking-widest text-[#00ff3c]">
                            SCAN_SIZE: {imageSizeMB} MB
                          </div>
                        )}
                      </div>
                       <div className="space-y-1"><label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Identity Node</label><div className="relative group"><User className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-300 ${userStatus === 'available' ? 'text-[#00ff3c]' : userStatus === 'taken' ? 'text-red-500' : 'text-gray-600'}`} size={16}/><input name="username" value={formData.username || ''} onChange={handleInput} required type="text" placeholder="Unique ID..." className={`w-full bg-white/5 border rounded-xl py-3.5 pl-12 pr-12 outline-none text-sm transition-all ${userStatus === 'available' ? 'border-[#00ff3c]/40' : userStatus === 'taken' ? 'border-red-500/40' : 'border-white/10'}`} /><div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">{isChecking ? <Loader2 className="animate-spin text-gray-500" size={14}/> : <>{userStatus === 'available' && <CheckCircle className="text-[#00ff3c]" size={14}/>}{userStatus === 'taken' && <XCircle className="text-red-500" size={14}/>}</>}</div></div></div>
                       <div className="space-y-1"><label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Pilot Designation</label><div className="relative group"><Fingerprint className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#00ff3c] transition-colors" size={16}/><input name="fullname" value={formData.fullname || ''} onChange={handleInput} required type="text" placeholder="Your Name" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 outline-none text-sm focus:border-[#00ff3c]/40 transition-all" /></div></div>
                    </div>
                    <div className="space-y-6 flex flex-col justify-end">
                       <div className="space-y-1"><label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Email Comms</label><div className="relative group"><Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#00ff3c]" size={16}/><input name="email" value={formData.email || ''} onChange={handleInput} required type="email" placeholder="neo@ludo.com" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 outline-none text-sm focus:border-[#00ff3c]/40 transition-all" /></div></div>
                       <div className="space-y-1"><label className="text-[9px] text-gray-500 ml-1 uppercase font-bold tracking-widest">Access Cipher</label><div className="relative group"><ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#00ff3c]" size={16}/><input name="password" value={formData.password || ''} onChange={handleInput} required type={showPass ? "text" : "password"} placeholder="••••••••" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-12 pr-12 outline-none text-sm focus:border-[#00ff3c]/40 transition-all" /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 hover:text-white transition-colors">{showPass ? <EyeOff size={16}/> : <Eye size={16}/>}</button></div></div>
                       <button type="submit" disabled={loading || userStatus === 'taken' || isChecking} className="w-full py-4 mt-2 bg-[#00ff3c] text-black font-black uppercase text-[10px] tracking-widest rounded-xl hover:shadow-[0_0_20px_#00ff3c] transition-all disabled:opacity-30">INITIALIZE_PILOT_SEQUENCE</button>
                    </div>
                  </form>
                </div>
              )}

              {/* --- PROFILE --- */}
              {!isEmailSent && subOption === 'profile' && (
                profileLoading ? (
                  <ProfileSkeleton />
                ) : (
                  <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-right-4 duration-500 pb-8">
                    <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-gradient-to-r from-white/[0.05] to-transparent border border-white/10 rounded-[1.5rem] relative overflow-hidden group">
                      <div className="relative flex-shrink-0" onClick={() => fileInputRef.current.click()}>
                        <div className="w-20 h-20 rounded-2xl border-2 border-[#ff0505] p-0.5 bg-black overflow-hidden cursor-pointer relative group/avatar">
                          <img src={finalImage || "/defaultProfile.png"} className="w-full h-full object-cover rounded-[calc(1rem-2px)] group-hover:scale-105 transition-transform" alt="Profile" />
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                            <Upload size={16} className="text-[#ff0505]" />
                          </div>
                        </div>
                        <div className="absolute -bottom-1 -right-1 bg-[#ff0505] p-1 rounded-lg shadow-lg border-[3px] border-[#0a0a0f]">
                          <ShieldCheck size={10} className="text-white" />
                        </div>
                      </div>
                      
                      {/* 2. Text & Metadata Section */}
                      <div className="text-center sm:text-left space-y-0.5">
                        <h4 className="text-[8px] font-black tracking-[0.3em] text-[#ff0505] uppercase opacity-70">Authenticated_Pilot</h4>
                        <p className="text-2xl font-black uppercase tracking-tight text-white leading-tight">{info?.fullname || "Pilot Designation"}</p>
                        <p className="text-[10px] font-mono text-gray-500 lowercase opacity-60">@{info?.username || "identity_pending"}</p>
                        
                        {/* ✅ MOVED SCAN SIZE HERE: Flows perfectly under the username */}
                        {imageSizeMB && (
                          <div className="pt-2 flex items-center justify-center sm:justify-start gap-1.5">
                            <CheckCircle size={10} className="text-[#00ff3c]" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-[#00ff3c]">
                              SCAN_SIZE: {imageSizeMB} MB
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6 bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] flex flex-col justify-between">
                      <form onSubmit={handleUpdateProfile} className="space-y-5">
                        <div className="flex items-center gap-3"><Fingerprint size={18} className="text-[#ff0505]" /><h5 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">Pilot_Metadata</h5></div>
                        <div className="space-y-1"><label className="text-[9px] uppercase tracking-widest text-gray-500 ml-1">Universal Designation</label><div className="relative group"><User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#ff0505] transition-colors" size={16}/><input name="fullname" value={formData.fullname || ''} onChange={handleInput} type="text" className="w-full bg-white/5 border border-white/10 rounded-xl py-3.5 pl-11 outline-none text-sm focus:border-[#ff0505]/40 focus:bg-white/[0.08] transition-all" /></div></div>
                        <div className="p-4 bg-black/60 border border-white/5 rounded-2xl space-y-3 font-mono">
                           <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Activity size={12} className="text-[#ff0505] animate-pulse"/><span className="text-[8px] text-gray-500 uppercase">Neural_Link</span></div><span className="text-[9px] text-[#00ff3c]">ENCRYPTED</span></div>
                           <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Cpu size={12} className="text-[#ff0505]"/><span className="text-[8px] text-gray-500 uppercase">Node_Status</span></div><span className="text-[9px] text-white">LOCKED_01</span></div>
                           <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Globe size={12} className="text-[#ff0505]"/><span className="text-[8px] text-gray-500 uppercase">Uplink_Node</span></div><span className="text-[9px] text-white">GLOBAL_ASIA</span></div>
                        </div>
                        <button type="submit" disabled={loading} className="w-full py-4 mt-2 bg-[#ff0505] text-white font-black uppercase text-[10px] tracking-widest rounded-xl hover:shadow-[0_0_20px_rgba(255,5,5,0.3)] active:scale-95 transition-all">SYNC_NEURAL_PROFILE</button>
                      </form>
                    </div>
                    <div className="space-y-6">
                      <div className="bg-white/[0.02] border border-white/5 p-6 rounded-[2rem] space-y-4 flex-1">
                        <div className="flex items-center gap-3"><ShieldCheck size={18} className="text-[#ff0505]" /><h5 className="text-[11px] font-black text-[#ff0505] uppercase tracking-[0.2em]">Cipher_Node</h5></div>
                        <p className="text-[10px] text-gray-500 leading-relaxed font-mono italic font-bold">Access cipher resets require node-broadcast authorization.</p>
                        <button onClick={handleForgotPasswordRequest} className="w-full py-4 border border-[#ff0505]/30 text-[#ff0505] hover:bg-[#ff0505] hover:text-white font-black uppercase text-[10px] rounded-xl transition-all flex items-center justify-center gap-2 group"><RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-500"/> REQUEST_CIPHER_LINK</button>
                      </div>
                      <div className="bg-red-950/10 border border-red-900/10 p-6 rounded-[2rem] space-y-4"><div className="flex items-center gap-2 text-red-900/60"><Trash2 size={14} /><span className="text-[9px] font-black uppercase tracking-widest">Protocol: PURGE_ID</span></div><button onClick={handleDeleteAccount} className="w-full py-3.5 bg-transparent border border-red-900/30 text-red-900 hover:bg-red-900 hover:text-white font-black uppercase text-[10px] rounded-xl transition-all active:scale-95">TERMINATE_IDENTITY</button></div>
                    </div>
                  </div>
                  </div>
                )
              )}
              { subOption==="setting" && (
                <div className="flex items-center justify-center h-full" style={{color:activeTheme.color}}>
                  <h1 className="text-2xl">In Development</h1>
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