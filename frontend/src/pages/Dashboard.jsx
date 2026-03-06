import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Particles from '@/components/customComponents/Particles';
import ElectricBorder from '@/components/customComponents/ElectricBorder';
import GradientText from '@/components/customComponents/GradientText';
import AnimatedContent from '@/components/customComponents/AnimatedContent';
import useUserStore from '@/store/userStore';
import "../styles/menu.css";
import "../styles/cell.css";


const MENU_ITEMS = [
  { label: "Play With Bot", color: "#ff0505", route: "/setup/bot", img: "/bot.png" },
  { label: "Offline Board", color: "#2b01ff", route: "/setup/offline", img: "/offline.png" },
  { label: "Play On Internet", color: "#fff200", route: "/setup/poi", img: "/poi.png" }, // Adjusted 'online' to 'poi' for consistency with your GameSetup checks
  { label: "Play With Friends", color: "#00ff3c", route: "/setup/pof", img: "/pof.png" }
];

const SUB_OPTIONS = [
  { label: "Profile", path: "/options/profile" },
  { label: "Sign In", path: "/options/signin" },
  { label: "Settings", path: "/options/setting" },
  { label: "Sign Up", path: "/options/signup" }
];

const Dashboard = () => {
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profile = useUserStore((state) => state.info.avatar);
  const [currentAvatar, setCurrentAvatar] = useState(profile || "/defaultProfile.png");

  useEffect(() => {
    setCurrentAvatar(profile || "/defaultProfile.png");
  }, [profile]);

  return (
    <div className='wholepage bg-[#020205] h-[100dvh] w-full relative overflow-hidden'>
      
      {/* 1. Background Particles */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Particles
          particleColors={["#ffffff", "#425568"]}
          particleCount={500}
          speed={0.1}
          moveParticlesOnHover={true}
          alphaParticles={true}
        />
      </div>

      {/* 2. THE GRADIENT MASK */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#020205] via-[#020205]/90 to-transparent z-20 pointer-events-none" />
        
      {/* 3. Header / Title (Highest Layer z-30) */}
      <div className="absolute top-0 w-full pt-10 z-30 flex justify-center pointer-events-none">
        <GradientText
          colors={["#ff0505", "#2b01ff", "#fff200", "#00ff3c"]}
          animationSpeed={3}
          showBorder={false}
          className="text-6xl md:text-8xl font-black tracking-tighter drop-shadow-2xl"
        >
          LUDO NEO
        </GradientText>
      </div>

      {/* 4. Profile Sidebar */}
      <div 
        className="absolute z-40 right-0 top-8 flex flex-col items-end"
        onMouseEnter={() => setIsProfileOpen(true)}
        onMouseLeave={() => setIsProfileOpen(false)}
      >
        <button className="xl:w-20 lg:w-16 w-14 aspect-square bg-white/10 backdrop-blur-md rounded-l-2xl border-2 border-r-0 border-white/20 flex items-center justify-center transition-all hover:bg-white/20">
          <div className='w-[80%] aspect-square rounded-full border-2 border-white/30 overflow-hidden p-1 bg-gradient-to-tr from-gray-800 to-black'>
              <img src={currentAvatar} alt="profile" className='h-full w-full rounded-full object-cover' onError={() => setCurrentAvatar('/defaultProfile.png')} />
          </div>
        </button>

        <div className={`flex flex-col items-end transition-all duration-300 ${isProfileOpen ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
          {SUB_OPTIONS.map((opt) => (
            <Link key={opt.label} to={opt.path} className='mt-2 py-2 px-6 rounded-l-lg bg-black/60 backdrop-blur-xl border border-r-0 border-white/10 text-gray-300 hover:text-white hover:bg-white/10 transition-colors font-medium text-sm'>
              {opt.label}
            </Link>
          ))}
        </div>
      </div>

      {/* 5. THE SCROLL VIEWPORT */}
      {/* Logic: Y-scroll for small devices, X-scroll for large screens */}
      <div className="absolute inset-0 z-10 w-full h-full overflow-x-hidden overflow-y-auto lg:overflow-y-hidden lg:overflow-x-auto custom-scrollbar">
        
        {/* 6. THE CONTENT GRID */}
        {/* pt-64 (Mobile) and lg:pt-72 (Desktop) ensure the cards start well below the "LUDO NEO" text */}
        <div className="min-h-full w-full flex flex-wrap lg:flex-nowrap items-start justify-center lg:justify-start lg:items-center gap-10 px-6 pt-[50%] sm:pt-[20%] sm:pb-[32px] lg:pt-[10%] lg:pb-0 lg:px-[10%]">
          
          {MENU_ITEMS.map((item, idx) => (
            <Link 
              key={item.label} 
              to={item.route} 
              className="block group perspective-1000 w-[280px] relative"
            >
              <ElectricBorder color={item.color} speed={3} chaos={0.1} thickness={3} style={{ borderRadius: '16px' }}>
                <div 
                  className="relative w-full aspect-[3/4] p-5 bg-[#0a0a0f] rounded-[14px] flex flex-col items-center justify-between transition-all duration-500 ease-out group-hover:scale-[1.05] group-hover:-translate-y-2"
                  style={{ '--hover-glow': `${item.color}44`, '--neon-color': item.color }}
                >
                  {/* Neon Hover Glow Overlay */}
                  <div className="absolute inset-0 rounded-[14px] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{ boxShadow: `inset 0 0 30px ${item.color}22, 0 0 20px ${item.color}11` }} />

                  <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-white/5 bg-gray-900 z-10">
                    <img 
                      src={item.img} 
                      alt={item.label} 
                      className={`"absolute h-full w-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700 ease-in-out grayscale-[50%] group-hover:grayscale-0" ${idx===2?'ml-[-5%] mt-[5%]':(idx===3)?'ml-[5%]':''}`}
                    />
                  </div>
                  
                  <div className="relative z-10 mb-2 text-center">
                    <span className="text-lg font-bold tracking-widest text-gray-400 uppercase transition-all duration-300 group-hover:text-white">
                      {item.label}
                    </span>
                    
                    {/* Restored Hovering Power Bars */}
                    <div className="flex justify-center gap-1 mt-2">
                      {[...Array(3)].map((_, i) => (
                        <div 
                            key={i}
                            className="h-1 w-4 rounded-full transition-all duration-500 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0"
                            style={{ 
                              backgroundColor: item.color,
                              boxShadow: `0 0 10px ${item.color}`,
                              transitionDelay: `${i * 100}ms`
                            }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </ElectricBorder>
            </Link>
          ))}
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(2, 2, 5, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1); /* Transparent thumb */
          border-radius: 10px;
          border: 2px solid rgba(255, 255, 255, 0.05);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3); /* Becomes visible on hover */
        }
      `}</style>
    </div>
  );
};

export default Dashboard;