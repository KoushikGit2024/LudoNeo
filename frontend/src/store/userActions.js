// ==========================================
// userActions.js
// ==========================================
import useUserStore from "./userStore";

// --- IDENTITY LOGIC ---
export const updateUserInfo = (updates) =>
    useUserStore.setState((state) => {
        const { stats, inventory, settings, ...infoFields } = updates;
        return {
            info: { ...state.info, ...infoFields },
            ...(stats     && { stats:     { ...state.stats,     ...stats     } }),
            ...(inventory && { inventory: { ...state.inventory, ...inventory } }),
            ...(settings  && { settings:  { ...state.settings,  ...settings  } }),
        };
    }, false, "identity/update");

// --- NOTIFICATION LOGIC ---
export const markNotificationAsRead = (notifId) =>
    useUserStore.setState((state) => {
        const updatedNotifications = state.info.notifications.map(n =>
            n._id === notifId ? { ...n, read: true } : n
        );
        return { info: { ...state.info, notifications: updatedNotifications } };
    }, false, "notifications/mark_read");

export const addNotification = (newNotif) =>
    useUserStore.setState((state) => ({
        info: {
            ...state.info,
            notifications: [newNotif, ...state.info.notifications]
        }
    }), false, "notifications/add");

export const clearAllNotifications = () =>
    useUserStore.setState((state) => ({
        info: { ...state.info, notifications: [] }
    }), false, "notifications/clear_all");

// --- PROGRESSION LOGIC ---
export const addXP = (amount) =>
    useUserStore.setState((state) => {
        let { xp, level, nextLevelXp } = state.stats;
        xp += amount;
        
        // Loop handles massive XP gains that span multiple levels
        while (xp >= nextLevelXp) {
            level += 1;
            xp = xp - nextLevelXp;
            nextLevelXp = Math.floor(nextLevelXp * 1.6);
        }
        return { stats: { ...state.stats, xp, level, nextLevelXp } };
    }, false, "stats/xp_gain");

// --- SETTINGS LOGIC ---
export const updateGameSetting = (key, value) =>
    useUserStore.setState((state) => ({
        settings: { ...state.settings, [key]: value }
    }), false, "settings/update");

// --- GLOBAL RESET ---
// Used for wiping data completely (e.g., account deletion)
export const purgeUserStore = () =>
    useUserStore.setState({
        info:      { fullname: "", username: "", email: "", avatar: "/defaultProfile.png", isVerified: false, notifications: [] },
        // Removed draws, added matchHistory array and winRate
        stats:     { level: 1, xp: 0, nextLevelXp: 1000, wins: 0, losses: 0, totalMatches: 0, winRate: "0%", matchHistory: [] },
        inventory: { badges: [], themes: ["default_neon"], currentTheme: "default_neon", avatarBorders: ["standard"], currentBorder: "standard" },
        settings:  { musicVolume: 0.5, sfxVolume: 0.8, haptics: true, lowGraphics: false }
    }, false, "system/purge");

// --- SYSTEM ACTIONS ---
// Used for logging out or initializing a fresh state
export const resetUserStore = () =>
    useUserStore.setState({
        info:      { fullname: "New Pilot", username: "identity_pending", email: "", avatar: "/defaultProfile.png", isVerified: false, notifications: [] },
        // Removed draws, added matchHistory array and winRate
        stats:     { level: 1, xp: 0, nextLevelXp: 1000, wins: 0, losses: 0, totalMatches: 0, winRate: "0%", matchHistory: [] },
        inventory: { badges: [], themes: ["default_neon"], currentTheme: "default_neon", avatarBorders: ["standard"], currentBorder: "standard" },
        settings:  { musicVolume: 0.5, sfxVolume: 0.8, haptics: true, lowGraphics: false }
    }, false, "system/reset");