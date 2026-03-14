import { Zap } from "lucide-react";

const LudoSkeleton = ({ text = "Initializing_Grid..." ,}) => (
  <div className="flex flex-col items-center justify-center w-full h-full space-y-8 animate-pulse">
    {/* Top Player Bars */}
    <div className="flex justify-between w-full px-4">
      <div className="h-12 w-32 bg-white/5 rounded-xl border border-white/10" />
      <div className="h-12 w-32 bg-white/5 rounded-xl border border-white/10" />
    </div>
    
    {/* Main Board Skeleton */}
    <div className="relative aspect-square w-[90%] max-w-[450px] bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center">
       <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent" />
       <Zap size={48} className="text-white/10" />
    </div>

    {/* Bottom Player Bars */}
    <div className="flex justify-between w-full px-4">
      <div className="h-12 w-32 bg-white/5 rounded-xl border border-white/10" />
      <div className="h-12 w-32 bg-white/5 rounded-xl border border-white/10" />
    </div>
    
    <p className="text-[10px] font-mono text-indigo-400 tracking-[0.4em] uppercase">{text}</p>
  </div>
);

export default LudoSkeleton;