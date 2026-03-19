// ==========================================
// 1. userStore.js
// ==========================================
import { create } from "zustand";
import { devtools } from "zustand/middleware";

const useUserStore = create(
    devtools(
        (set, get) => ({
            // --- USER IDENTITY ---
            info: {
                fullname: "",
                username: "",
                email: "",
                avatar: "/defaultProfile.png",
                isVerified: false,
                notifications: [], 
            },

            // --- GAME STATISTICS ---
            stats: {
                level: 1,
                xp: 0,
                nextLevelXp: 1000,
                wins: 0,
                losses: 0,
                totalMatches: 0,
                winRate: "0%",
                matchHistory: [], // Array of objects: { gameId, date, result, opponent, gameType }
            },

            // --- CUSTOMIZATION & INVENTORY ---
            inventory: {
                badges: [], 
                themes: ["default_neon"], 
                currentTheme: "default_neon",
                avatarBorders: ["standard"],
                currentBorder: "standard",
            },

            // --- SYSTEM CONFIG ---
            settings: {
                musicVolume: 0.5,
                sfxVolume: 0.8,
                haptics: true,
                lowGraphics: false,
            },
        }),
        { name: "ludo-neo-user-storage" }
    )
);

export default useUserStore;