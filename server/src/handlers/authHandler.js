import jwt from "jsonwebtoken";
import ImageKit from 'imagekit';
import User from "../models/userModel.js";
// import { sendEmail } from "../utils/sendEmail.js";
import redis from "../config/redis.js"; 
import bcrypt from "bcrypt";
import crypto from "crypto";

// ==========================================
// CONFIGURATIONS & HELPERS
// ==========================================

const imagekit = new ImageKit({
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const getCookieOptions = () => ({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 30 * 24 * 60 * 60 * 1000,
});

const generateToken = () => crypto.randomBytes(32).toString("hex");

const isProduction = process.env.NODE_ENV === "production";

// ==========================================
// LOGIN LOGIC
// ==========================================
const loginHandler = async (req, res, next) => {
    try {
        const { email, password } = req.body;
        // console.log(email,password)
        const user = await User.findOne({ $or: [{ email }, { username: email }] }).select("+password");
        // console.log(user)
        if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

        if (!user?.isVerified) {
            const verificationToken = generateToken();
            await redis.set(`verify:${verificationToken}`, user.email, { EX: 3600 });
            const verificationUrl = isProduction ? `https://ludoneo.onrender.com/options/signin?token=${verificationToken}` : `http://localhost:5173/options/signin?token=${verificationToken}`;
            // console.log(sendEmail)
            // await sendEmail({
            //     email: user.email,
            //     subject: `SYSTEM: Identity Uplink Required for Pilot ${user.fullname}`,
            //     message: `
            //         <div style="background-color: #020205; color: #ffffff; font-family: 'Courier New', Courier, monospace; padding: 40px; border: 2px solid #00ff3c; border-radius: 8px; max-width: 600px; margin: auto;">
            //             <div style="border-bottom: 1px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 20px;">
            //                 <h2 style="color: #00ff3c; text-transform: uppercase; letter-spacing: 3px; margin: 0;">
            //                     [ UPLINK_PROTOCOL: v3.0 ]
            //                 </h2>
            //                 <p style="font-size: 12px; color: #555; margin: 5px 0 0 0;">TIMESTAMP: ${new Date().toISOString()}</p>
            //             </div>
            //             <div style="line-height: 1.6;">
            //                 <h1 style="font-size: 22px; color: #ffffff; text-transform: uppercase; margin-top: 0;">
            //                     Welcome to the Grid, <span style="color: #00ff3c;">Pilot ${fullname || user.fullname}</span>
            //                 </h1>
            //                 <p style="font-size: 14px; color: #a0a0a0;">
            //                     Your neural signature has been detected. To finalize your integration into the 
            //                     <strong style="color: #fff;">Ludo Neo System</strong>, you must authenticate your 
            //                     pilot identity through our secure verification node.
            //                 </p>
            //                 <div style="text-align: center; margin: 40px 0;">
            //                     <a href="${verificationUrl}" 
            //                     style="background: #00ff3c; color: #000; padding: 15px 30px; text-decoration: none; font-weight: 900; font-size: 16px; border-radius: 4px; box-shadow: 0 0 15px rgba(0, 255, 60, 0.5); display: inline-block; text-transform: uppercase;">
            //                     INITIALIZE_NEURAL_LINK
            //                     </a>
            //                 </div>
            //                 <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-left: 3px solid #00ff3c; font-size: 12px; color: #888;">
            //                     <strong>SECURITY_NOTICE:</strong> This transmission link expires in <span style="color: #fff;">60 minutes</span>. 
            //                     If this uplink was not requested by you, please terminate the connection and ignore this data packet.
            //                 </div>
            //             </div>
            //             <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 1px;">
            //                 &copy; 2026 Ludo Neo Grid Operations // Sector 7
            //             </div>
            //         </div>
            //     `,
            // });
            return res.json({success: false, message: "Email not verified. Link sent to registered email.",link:verificationUrl});
        
            // return res.status(403).json({ 
            //     success: false, 
            //     message: "Please verify your email before logging in." 
            // });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: "Invalid credentials" });
        // console.log("Password matched", isMatch);
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
        res.cookie("token", token, getCookieOptions());

        res.status(200).json({
            success: true,
            message: `Welcome back, ${user.fullname}`,
            user: {
                ...user._doc,
            }
        });
    } catch (error) { 
        next(error); 
    }
};

// ==========================================
// LOGOUT LOGIC
// ==========================================
const logoutHandler = async (req, res) => {
    res.clearCookie("token", getCookieOptions());
    res.status(200).json({ success: true, message: "Logged out successfully" });
};

// ==========================================
// UPDATE PROFILE LOGIC
// ==========================================

const updateProfile = async (req, res, next) => {
    try {
        const userId = req.user.id; 
        const { fullname } = req.body;
        const file = req.file;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // If user is trying to update but isn't verified, re-send link
        if(!user?.isVerified) {
            const verificationToken = generateToken();
            await redis.set(`verify:${verificationToken}`, user.email, { EX: 3600 });
            const verificationUrl = isProduction ? `https://ludoneo.onrender.com/options/signin?token=${verificationToken}` : `http://localhost:5173/options/signin?token=${verificationToken}`;
            // console.log(sendEmail)
            // await sendEmail({
            //     email: user.email,
            //     subject: `SYSTEM: Identity Uplink Required for Pilot ${user.fullname}`,
            //     message: `
            //         <div style="background-color: #020205; color: #ffffff; font-family: 'Courier New', Courier, monospace; padding: 40px; border: 2px solid #00ff3c; border-radius: 8px; max-width: 600px; margin: auto;">
            //             <div style="border-bottom: 1px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 20px;">
            //                 <h2 style="color: #00ff3c; text-transform: uppercase; letter-spacing: 3px; margin: 0;">
            //                     [ UPLINK_PROTOCOL: v3.0 ]
            //                 </h2>
            //                 <p style="font-size: 12px; color: #555; margin: 5px 0 0 0;">TIMESTAMP: ${new Date().toISOString()}</p>
            //             </div>
            //             <div style="line-height: 1.6;">
            //                 <h1 style="font-size: 22px; color: #ffffff; text-transform: uppercase; margin-top: 0;">
            //                     Welcome to the Grid, <span style="color: #00ff3c;">Pilot ${fullname || user.fullname}</span>
            //                 </h1>
            //                 <p style="font-size: 14px; color: #a0a0a0;">
            //                     Your neural signature has been detected. To finalize your integration into the 
            //                     <strong style="color: #fff;">Ludo Neo System</strong>, you must authenticate your 
            //                     pilot identity through our secure verification node.
            //                 </p>
            //                 <div style="text-align: center; margin: 40px 0;">
            //                     <a href="${verificationUrl}" 
            //                     style="background: #00ff3c; color: #000; padding: 15px 30px; text-decoration: none; font-weight: 900; font-size: 16px; border-radius: 4px; box-shadow: 0 0 15px rgba(0, 255, 60, 0.5); display: inline-block; text-transform: uppercase;">
            //                     INITIALIZE_NEURAL_LINK
            //                     </a>
            //                 </div>
            //                 <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-left: 3px solid #00ff3c; font-size: 12px; color: #888;">
            //                     <strong>SECURITY_NOTICE:</strong> This transmission link expires in <span style="color: #fff;">60 minutes</span>. 
            //                     If this uplink was not requested by you, please terminate the connection and ignore this data packet.
            //                 </div>
            //             </div>
            //             <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 1px;">
            //                 &copy; 2026 Ludo Neo Grid Operations // Sector 7
            //             </div>
            //         </div>
            //     `,
            // });
            return res.json({success: false, message: "Email not verified. Link sent to registered email.", link: verificationUrl});
        }

        if (file) {
            // 1. Upload the new image first (so if it fails, we don't delete the old one)
            const uploadResponse = await imagekit.upload({
                file: file.buffer,
                fileName: `profile_update_${user.username}_${Date.now()}`,
                folder: "/MyProjects/ludo_neo/avatars"
            });

            // 2. Safely delete the old image from ImageKit
            // Check if it's an ImageKit URL and not the local "/defaultProfile.png"
            if (user.avatar && user.avatar.includes('imagekit.io')) {
                try {
                    // Extract just the filename from the end of the URL
                    const oldFileName = user.avatar.split('/').pop();
                    
                    // Ask ImageKit to find the file by name to get its hidden ID
                    const files = await imagekit.listFiles({
                        searchQuery: `name="${oldFileName}"`
                    });

                    // If ImageKit finds it, destroy it
                    if (files && files.length > 0) {
                        await imagekit.deleteFile(files[0].fileId);
                        // console.log(`[SYSTEM] Orphaned DNA scan deleted: ${oldFileName}`);
                    }
                } catch (deleteErr) {
                    console.error("[SYSTEM WARNING] Failed to purge old avatar from ImageKit:", deleteErr);
                    // We don't throw an error here. Even if deletion fails, we still want to save the new profile!
                }
            }

            // 3. Update DB with new image URL
            user.avatar = uploadResponse.url;
        }

        if (fullname) user.fullname = fullname;
        await user.save();

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                ...user._doc,
            }
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// DELETE ACCOUNT LOGIC
// ==========================================
const deleteAccount = async (req, res, next) => {
    try {
        const userId = req.user.id; 
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // ✅ BONUS: Delete their avatar from ImageKit if they purge their account!
        if (user.avatar && user.avatar.includes('imagekit.io')) {
            try {
                const oldFileName = user.avatar.split('/').pop();
                const files = await imagekit.listFiles({ searchQuery: `name="${oldFileName}"` });
                if (files && files.length > 0) {
                    await imagekit.deleteFile(files[0].fileId);
                }
            } catch (err) {
                console.error("[SYSTEM WARNING] Failed to delete avatar during account purge:", err);
            }
        }

        // Clean up Redis keys
        const keys = await redis.keys(`*:${user.email}*`);
        if (keys.length > 0) await redis.del(...keys);
        await redis.del(`status:${userId}`);

        // Purge DB and Cookies
        await User.findByIdAndDelete(userId);
        res.clearCookie("token", getCookieOptions());

        res.status(200).json({ 
            success: true, 
            message: "Account and all associated data purged successfully." 
        });
    } catch (error) {
        next(error);
    }
};

const initialFetch = async(req, res, next)=>{
    try {
        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        res.status(200).json({
            success: true,
            user: {
                ...user._doc,
            },
            message: "User fetched successfully"
        });
    } catch (error) {
        next(error);
    }
}

// ==========================================
// CHECK USERNAME AVAILABILITY
// ==========================================
const checkUsername = async (req, res, next) => {
    try {
        const { query } = req.query; 

        if (!query || query.length < 5) {
            return res.status(400).json({ 
                success: false, 
                message: "Search query too short." 
            });
        }
        
        const safeQuery = query.trim();
        const searchRegex = new RegExp(`^${safeQuery}$`, 'i'); // Exact match for availability

        const userExists = await User.exists({ username: searchRegex });

        return res.status(200).json({ 
            success: !!userExists, 
            message: userExists ? "Username already exists" : "Username available"
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// REGISTER & SEND VERIFICATION LINK
// ==========================================
const registerHandler = async (req, res, next) => {
    try {
        const { fullname, username, email, password } = req.body;
        const file = req.file;

        // 1. Validate if user already exists
        const userExists = await User.findOne({ $or: [{ email }, { username }] });
        if (userExists) {
            return res.status(400).json({ success: false, message: "User already exists in the grid." });
        }

        // 2. Handle Avatar Upload
        let avatarUrl = "/defaultProfile.png";
        if (file) {
            const uploadResponse = await imagekit.upload({
                file: file.buffer,
                fileName: `profile_${username}_${Date.now()}`,
                folder: "/MyProjects/ludo_neo/avatars"
            });
            avatarUrl = uploadResponse.url;
        }

        // 3. Create User in MongoDB FIRST
        // Note: Make sure your userModel.js handles hashing the password before saving!
        const newUser = await User.create({ 
            fullname, 
            username, 
            email, 
            password, 
            avatar: avatarUrl, 
            isVerified: false 
        });

        // 4. Generate and cache the verification token in Redis ONLY if user creation succeeds
        const verificationToken = generateToken();
        await redis.set(`verify:${verificationToken}`, email, { EX: 3600 }); // Expires in 1 hour
        
        // 5. Build the verification URL
        const isProduction = process.env.NODE_ENV === 'production';
        const baseUrl = isProduction ? 'https://ludoneo.onrender.com' : 'http://localhost:5173';
        const verificationUrl = `${baseUrl}/options/signin?token=${verificationToken}`;

        // 6. Broadcast Email (Currently commented out in your logic)
        // await sendEmail({
        //     email,
        //     subject: `SYSTEM: Identity Uplink Required for Pilot ${fullname}`,
        //     message: `
        //         <div style="background-color: #020205; color: #ffffff; font-family: 'Courier New', Courier, monospace; padding: 40px; border: 2px solid #00ff3c; border-radius: 8px; max-width: 600px; margin: auto;">
        //             <div style="border-bottom: 1px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 20px;">
        //                 <h2 style="color: #00ff3c; text-transform: uppercase; letter-spacing: 3px; margin: 0;">
        //                     [ UPLINK_PROTOCOL: v3.0 ]
        //                 </h2>
        //                 <p style="font-size: 12px; color: #555; margin: 5px 0 0 0;">TIMESTAMP: ${new Date().toISOString()}</p>
        //             </div>
        //             <div style="line-height: 1.6;">
        //                 <h1 style="font-size: 22px; color: #ffffff; text-transform: uppercase; margin-top: 0;">
        //                     Welcome to the Grid, <span style="color: #00ff3c;">Pilot ${fullname}</span>
        //                 </h1>
        //                 <p style="font-size: 14px; color: #a0a0a0;">
        //                     Your neural signature has been detected. To finalize your integration into the 
        //                     <strong style="color: #fff;">Ludo Neo System</strong>, you must authenticate your 
        //                     pilot identity through our secure verification node.
        //                 </p>
        //                 <div style="text-align: center; margin: 40px 0;">
        //                     <a href="${verificationUrl}" 
        //                     style="background: #00ff3c; color: #000; padding: 15px 30px; text-decoration: none; font-weight: 900; font-size: 16px; border-radius: 4px; box-shadow: 0 0 15px rgba(0, 255, 60, 0.5); display: inline-block; text-transform: uppercase;">
        //                     INITIALIZE_NEURAL_LINK
        //                     </a>
        //                 </div>
        //                 <div style="background: rgba(255, 255, 255, 0.05); padding: 15px; border-left: 3px solid #00ff3c; font-size: 12px; color: #888;">
        //                     <strong>SECURITY_NOTICE:</strong> This transmission link expires in <span style="color: #fff;">60 minutes</span>. 
        //                     If this uplink was not requested by you, please terminate the connection and ignore this data packet.
        //                 </div>
        //             </div>
        //             <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 1px;">
        //                 &copy; 2026 Ludo Neo Grid Operations // Sector 7
        //             </div>
        //         </div>
        //     `,
        // });

        // 7. Send final success response
        res.status(200).json({ 
            success: true, 
            message: "Initialization link broadcast. Check your neural uplink (email).",
            link: verificationUrl
        });

    } catch (error) { 
        // Pass any caught errors (like Mongoose validation errors) to the global error handler
        next(error); 
    }
};

// ==========================================
// VERIFY EMAIL LINK
// ==========================================
const verifyEmail = async (req, res, next) => {
    try {
        const { token } = req.query; 
        const email = await redis.get(`verify:${token}`);

        if (!email) {
            return res.status(400).json({ success: false, message: "Link expired or invalid node." });
        }

        await User.findOneAndUpdate({ email }, { isVerified: true });
        await redis.del(`verify:${token}`);

        res.status(200).json({ success: true, message: "Neural link established. Access granted." });
    } catch (error) { next(error); }
};

// ==========================================
// FORGOT PASSWORD
// ==========================================
const forgotPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ success: false, message: "Identity node not found." });

        const resetToken = generateToken();
        await redis.set(`reset:${resetToken}`, email, { EX: 3600 });
        const resetUrl = isProduction ? `https://ludoneo.onrender.com/options/signin?reset=${resetToken}&id=${user.email}&mode=reset` : `http://localhost:5173/options/signin?reset=${resetToken}&id=${user.email}&mode=reset`;

        // await sendEmail({
        //     email,
        //     subject: "SYSTEM: Access Cipher Recovery - Ludo Neo",
        //     message: `
        //         <div style="background-color: #020205; color: #ffffff; font-family: 'Courier New', Courier, monospace; padding: 40px; border: 2px solid #fff200; border-radius: 8px; max-width: 600px; margin: auto;">
        //             <div style="border-bottom: 1px solid #332b00; padding-bottom: 20px; margin-bottom: 20px;">
        //                 <h2 style="color: #fff200; text-transform: uppercase; letter-spacing: 3px; margin: 0;">
        //                     [ CONFIG_PROTOCOL: CIPHER_SYNC ]
        //                 </h2>
        //                 <p style="font-size: 12px; color: #665500; margin: 5px 0 0 0;">ACCESS_RECOVERY_NODE: ${new Date().toISOString()}</p>
        //             </div>
        //             <div style="line-height: 1.6;">
        //                 <h1 style="font-size: 22px; color: #ffffff; text-transform: uppercase; margin-top: 0;">
        //                     Neural <span style="color: #fff200;">Cipher Reset</span> Initiated
        //                 </h1>
        //                 <p style="font-size: 14px; color: #a0a0a0;">
        //                     A request to reconfigure your access credentials has been authorized. 
        //                     To override your current identity node and establish a new secure cipher, click the terminal link below:
        //                 </p>
        //                 <div style="text-align: center; margin: 40px 0;">
        //                     <a href="${resetUrl}" 
        //                     style="background: #fff200; color: #000; padding: 15px 30px; text-decoration: none; font-weight: 900; font-size: 16px; border-radius: 4px; box-shadow: 0 0 20px rgba(255, 242, 0, 0.4); display: inline-block; text-transform: uppercase;">
        //                     OVERRIDE_CIPHER_NOW
        //                     </a>
        //                 </div>
        //                 <div style="background: rgba(255, 242, 0, 0.05); padding: 15px; border-left: 3px solid #fff200; font-size: 12px; color: #888;">
        //                     <strong>CONFIG_ALERT:</strong> This override link is valid for <span style="color: #fff;">60 minutes</span>. 
        //                     If this configuration change was not authorized by your pilot identity, please ignore this transmission to maintain current cipher integrity.
        //                 </div>
        //             </div>
        //             <div style="margin-top: 30px; text-align: center; font-size: 10px; color: #444; text-transform: uppercase; letter-spacing: 1px;">
        //                 &copy; 2026 Ludo Neo Grid Operations // Access Division
        //             </div>
        //         </div>
        //     `,
        // });

        res.status(200).json({ success: true, message: "Recovery link broadcast to node.",link:resetUrl });
    } catch (error) { next(error); }
};

// ==========================================
// RESET PASSWORD
// ==========================================
const resetPassword = async (req, res, next) => {
    try {
        const { token, newPassword } = req.body;
        const email = await redis.get(`reset:${token}`);

        if (!email) {
            return res.status(400).json({ success: false, message: "Recovery link expired." });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        await User.findOneAndUpdate({ email }, { password: hashedPassword });
        await redis.del(`reset:${token}`);
        
        res.status(200).json({ success: true, message: "Access cipher updated successfully." });
    } catch (error) { next(error); }
};

// ==========================================
// SEARCH USERS
// ==========================================
const searchUsers = async (req, res, next) => {
    try {
        const { query, excludeName } = req.query;
        if (!query || query.length < 2) {
            return res.status(200).json({ success: true, users: [] });
        }

        const searchRegex = new RegExp(query, 'i'); 

        const users = await User.find({
            $and: [
                {
                    $or: [
                        { username: searchRegex },
                        { fullname: searchRegex }
                    ]
                },
                // Corrected exclusion logic using $ne
                { username: { $ne: excludeName } }
            ]
        })
        .limit(5)
        .select("username fullname avatar");

        res.status(200).json({ success: true, users });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// FETCH ONLY NOTIFICATIONS
// ==========================================
const getNotifications = async (req, res, next) => {
    try {
        // Select ONLY the notifications array to save bandwidth
        const user = await User.findById(req.user.id).select("notifications");
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        res.status(200).json({ 
            success: true, 
            notifications: user.notifications 
        });
    } catch (error) {
        next(error);
    }
};

// ==========================================
// MARK NOTIFICATION AS READ
// ==========================================

const markNotificationRead = async (req, res, next) => {
    try {
        const userId = req.user.id;
        const { id: notifId } = req.params;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // Mongoose has a handy .id() method for subdocument arrays!
        const notification = user.notifications.id(notifId);
        
        if (!notification) {
            return res.status(404).json({ success: false, message: "Notification not found" });
        }

        notification.read = true;
        await user.save();

        res.status(200).json({ success: true, message: "Comms marked as read." });
    } catch (error) {
        next(error);
    }
}

// ==========================================
// SEND INVITES
// ==========================================
// ==========================================
// SEND INVITES
// ==========================================
// CHANGE SUMMARY:
//
// Previously sendInvites only sent notifications to guests and returned nothing
// useful. The host then had to make a SECOND request to /generate-session-idf
// to get their own signed session JWT.
//
// Now sendInvites:
//   1. Accepts `hostColor` and `size` in the request body (new fields).
//   2. Generates and returns a signed `hostToken` JWT in the response.
//   3. Fixes the color–target alignment bug: `colors` must now only contain
//      invited (non-host) colors, matching the `targets` array index-for-index.
//      `size` is sent separately so the total player count is preserved in JWTs.
//
// This collapses two API calls into one.
// ==========================================
const sendInvites = async (req, res, next) => {
    try {
        const {
            targets,        // [[username, profile], ...]  — invited players only, no host
            title,
            colors,         // ['B','Y','G']               — invited colors only, aligned with targets
            message,
            type,
            gameId,
            boardType,
            hostColor,      // 'R'                         — NEW: host's color
            size,           // 4                           — NEW: total players including host
        } = req.body;

        // ─── Validate new required fields ────────────────────────────────────
        if (!hostColor || !size) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: hostColor and size are required."
            });
        }

        // ─── Fetch host profile from DB ───────────────────────────────────────
        // tokenChecker sets req.user = { id: ... } from the cookie JWT.
        // The cookie JWT only stores the user's _id, so we need a DB lookup
        // to get the real username and avatar for the host's session token.
        const hostUser = await User.findById(req.user.id).select("username avatar");
        if (!hostUser) {
            return res.status(404).json({ success: false, message: "Host user not found." });
        }

        // ─── Generate host session JWT ────────────────────────────────────────
        // Same payload shape as guest tokens so socketGuard decodes both identically.
        const hostToken = jwt.sign(
            {
                color:    hostColor,
                username: hostUser.username,
                profile:  hostUser.avatar || "/defaultProfile.png",
                gameId,
                size,        // total player count — used by socketGuard room-full check
                boardType,
            },
            process.env.JWT_SECRET
            // No expiry — session token must remain valid for the full game duration.
        );

        // ─── Generate guest tokens and push notifications ─────────────────────
        // BUG A2 FIX (enforced here): `colors[idx]` must align with `targets[idx]`.
        // Callers must pass only invited (non-host) colors. `size` carries the
        // total count separately so individual JWT `size` values are correct.
        const bulkOps = targets.map((target, idx) => {
            const token = jwt.sign(
                {
                    color:    colors[idx],
                    username: target[0],
                    profile:  target[1],
                    gameId,
                    size,      // same total size for all players
                    boardType,
                },
                process.env.JWT_SECRET
            );

            const customMessage = `${message}?idf=${token}`;

            return {
                updateOne: {
                    filter: { username: target[0] },
                    update: {
                        $push: {
                            notifications: {
                                title,
                                message: customMessage,
                                type,
                                read: false,
                                createdAt: new Date()
                            }
                        }
                    }
                }
            };
        });

        if (bulkOps.length > 0) {
            await User.bulkWrite(bulkOps);
        }

        // Return the host token so GameSetup can navigate without a second request
        return res.status(200).json({
            success:    true,
            message:    "Invites delivered.",
            hostToken,          // ← GameSetup uses this as the ?idf= query param
        });
    } catch (error) {
        next(error);
    }
};



const deleteNotification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pilot identity not found.' });
    }

    // Filter out the deleted notification
    user.notifications = user.notifications.filter(
      (notif) => notif._id.toString() !== req.params.id
    );

    await user.save();
    res.status(200).json({ success: true, message: 'Comm log purged successfully.' });
  } catch (error) {
    console.error("Error deleting notification:", error);
    next(error);
  }
}

export { 
    loginHandler, 
    registerHandler, 
    logoutHandler, 
    verifyEmail, 
    forgotPassword, 
    resetPassword, 
    updateProfile,
    deleteAccount,
    checkUsername,
    initialFetch,
    searchUsers,
    getNotifications,
    markNotificationRead,
    sendInvites,
    deleteNotification
};