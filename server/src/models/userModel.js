import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema({
    fullname: { type: String, required: [true, "Full name is required"], trim: true },
    username: { 
        type: String, 
        required: [true, "Username is required"], 
        unique: true, 
        trim: true, 
        lowercase: true, 
        minlength: [3, "Username must be at least 3 characters"] // Fixed: was 8 in your text but 3 in message
    },
    email: { 
        type: String, 
        required: [true, "Email is required"], 
        unique: true, 
        lowercase: true, 
        trim: true, 
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please fill a valid email address']
    },
    password: { 
        type: String, 
        required: [true, "Password is required"], 
        minlength: [6, "Password must be at least 6 characters"],
        select: false // Ensures password isn't sent back in queries by default
    },
    avatar: { type: String, default: "" },
    isVerified: { type: Boolean, default: false },
    // otp: { type: String }, // Optional: only if you prefer DB over Redis
    // otpExpires: { type: Date },
    role: { type: String, enum: ["user", "admin"], default: "user" }
}, { timestamps: true });

// PASSWORD HASHING LOGIC
// Notice: We removed "next" from the function arguments
userSchema.pre("save", async function () {
    // 1. Only hash if the password has been modified (or is new)
    if (!this.isModified("password")) return;

    try {
        // 2. Generate a salt (higher number = more secure but slower)
        const salt = await bcrypt.genSalt(10);
        // console.log(salt);
        // 3. Replace the plain-text password with the hashed version
        this.password = await bcrypt.hash(this.password, salt);
        
        // No next() needed! The "async" nature handles the flow.
    } catch (err) {
        // If something fails, throw the error so the controller catches it
        throw err; 
    }
});

// HELPER METHOD: Check password during login
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.models.User || mongoose.model('User', userSchema);
export default User;