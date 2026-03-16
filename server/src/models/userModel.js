// import mongoose from "mongoose";
// import bcrypt from "bcrypt";

// // ==========================================
// // SUB-SCHEMAS
// // ==========================================
// const notificationSchema = new mongoose.Schema({
//     title: { type: String, required: true },
//     message: { type: String, required: true },
//     type: { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
//     read: { type: Boolean, default: false },
//     createdAt: { type: Date, default: Date.now }
// });

// const matchHistorySchema = new mongoose.Schema({
//     gameId: { type: String, required: true },
//     date: { type: Date, default: Date.now },
//     result: { type: String, enum: ["win", "loss", "draw"], required: true },
//     opponent: { type: String }
// }, { _id: false }); // _id: false prevents Mongoose from generating an ID for every single match log

// // ==========================================
// // MAIN USER SCHEMA
// // ==========================================
// const userSchema = new mongoose.Schema({
//     // --- IDENTITY ---
//     fullname: { type: String, required: [true, "Full name is required"], trim: true },
//     username: { 
//         type: String, 
//         required: [true, "Username is required"], 
//         unique: true, 
//         trim: true, 
//         lowercase: true, 
//         minlength: [3, "Username must be at least 3 characters"] 
//     },
//     email: { 
//         type: String, 
//         required: [true, "Email is required"], 
//         unique: true, 
//         lowercase: true, 
//         trim: true, 
//         match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
//     },
//     password: { 
//         type: String, 
//         required: [true, "Password is required"], 
//         minlength: [6, "Password must be at least 6 characters"],
//         select: false 
//     },
//     avatar: { type: String, default: "/defaultProfile.png" }, // Aligned with Zustand default
//     isVerified: { type: Boolean, default: false },
//     role: { type: String, enum: ["user", "admin"], default: "user" },
//     notifications: { type: [notificationSchema], default: [] },

//     // --- GAME STATISTICS ---
//     stats: {
//         level: { type: Number, default: 1 },
//         xp: { type: Number, default: 0 },
//         nextLevelXp: { type: Number, default: 1000 },
//         wins: { type: Number, default: 0 },
//         losses: { type: Number, default: 0 },
//         draws: { type: Number, default: 0 },
//         totalMatches: { type: Number, default: 0 },
//         winRate: { type: String, default: "0%" },
//         matchHistory: { type: [matchHistorySchema], default: [] }
//     },

//     // --- CUSTOMIZATION & INVENTORY ---
//     inventory: {
//         badges: { type: [String], default: [] },
//         themes: { type: [String], default: ["default_neon"] },
//         currentTheme: { type: String, default: "default_neon" },
//         avatarBorders: { type: [String], default: ["standard"] },
//         currentBorder: { type: String, default: "standard" }
//     },

//     // --- SYSTEM CONFIG ---
//     settings: {
//         musicVolume: { type: Number, default: 0.5 },
//         sfxVolume: { type: Number, default: 0.8 },
//         haptics: { type: Boolean, default: true },
//         lowGraphics: { type: Boolean, default: false }
//     }
// }, { timestamps: true });

// // ==========================================
// // MIDDLEWARE & METHODS
// // ==========================================

// // PASSWORD HASHING LOGIC
// userSchema.pre("save", async function () {
//     // 1. Only hash if the password has been modified (or is new)
//     if (!this.isModified("password")) return;

//     try {
//         // 2. Generate a salt
//         const salt = await bcrypt.genSalt(10);
//         // 3. Replace the plain-text password with the hashed version
//         this.password = await bcrypt.hash(this.password, salt);
//     } catch (err) {
//         throw err; 
//     }
// });

// // HELPER METHOD: Check password during login
// userSchema.methods.comparePassword = async function (candidatePassword) {
//     return await bcrypt.compare(candidatePassword, this.password);
// };

// const User = mongoose.models.User || mongoose.model('User', userSchema);
// export default User;
// ==========================================
// 3. userModel.js (Mongoose Schema)
// ==========================================
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const notificationSchema = new mongoose.Schema({
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
    read: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now }
});

const matchHistorySchema = new mongoose.Schema({
    gameId: { type: String, required: true },
    date: { type: Date, default: Date.now },
    result: { type: String, enum: ["win", "loss"], required: true },
    opponent: { type: String },
    gameType: { type: String, enum: ["offline", "bot", "online", "pof", "poi"], required: true }
}, { _id: false }); 

const userSchema = new mongoose.Schema({
    fullname: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true, minlength: 3 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address'] },
    password: { type: String, required: true, minlength: 6, select: false },
    avatar: { type: String, default: "/defaultProfile.png" }, 
    isVerified: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    notifications: { type: [notificationSchema], default: [] },

    stats: {
        level: { type: Number, default: 1 },
        xp: { type: Number, default: 0 },
        nextLevelXp: { type: Number, default: 1000 },
        wins: { type: Number, default: 0 },
        losses: { type: Number, default: 0 },
        totalMatches: { type: Number, default: 0 },
        winRate: { type: String, default: "0%" },
        matchHistory: { type: [matchHistorySchema], default: [] }
    },

    inventory: {
        badges: { type: [String], default: [] },
        themes: { type: [String], default: ["default_neon"] },
        currentTheme: { type: String, default: "default_neon" },
        avatarBorders: { type: [String], default: ["standard"] },
        currentBorder: { type: String, default: "standard" }
    },

    settings: {
        musicVolume: { type: Number, default: 0.5 },
        sfxVolume: { type: Number, default: 0.8 },
        haptics: { type: Boolean, default: true },
        lowGraphics: { type: Boolean, default: false }
    }
}, { timestamps: true });

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err) { throw err; }
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;