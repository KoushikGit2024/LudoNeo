import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import jwt from "jsonwebtoken";

import { connectMongo } from "./connection.js";
import authRoute from "./src/routes/authRoute.js";
import User from "./src/models/userModel.js";
import ErrorLog from "./src/models/errorModel.js";

// Socket and Game Logic Imports
import registerGameHandlers from "./src/sockets/gameHandlers.js";
import redisGameInitiate from "./src/handlers/gameControler.js"; 

// Standardized Redis import (Ensure your redis.js exports your client)
import redis from "./src/config/redis.js"; 
import gameRoute from "./src/routes/gameRoutes.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ===== CORS Configuration =====
const rawOrigins = process.env.CORS_ORIGIN || "";
const allowedOrigins = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean);

const corsOptions = {
    origin: process.env.NODE_ENV === "production"
        ? (origin, cb) => {
            if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
            return cb(new Error("Origin not allowed by CORS"), false);
        }
        : true,
    credentials: true,
};

// ===== Middlewares =====
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ===== MongoDB Connection =====
connectMongo();

// ===== Socket.io Setup =====
const io = new Server(server, {
    cors: corsOptions, 
});

// Socket Middleware: Verify User via JWT Cookie
// io.use((socket, next) => {
//     const token = socket.request.headers.cookie 
//         ? socket.request.headers.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1] 
//         : null;

//     if (!token) return next(); // Allow guest connection

//     jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
//         if (err) return next(); // Token invalid, proceed as guest
//         socket.user = decoded;  // Attach authenticated user data to socket
//         next();
//     });
// });

// Initialize External Socket Logic for the Ludo Game
registerGameHandlers(io);

// ===== HTTP Routes =====

// Root Route
app.get('/', async (req, res) => {
    try {
        let users = await User.find({});
        res.send(users);
    } catch (err) {
        res.status(500).send("Error fetching users");
    }
});

// Health check
app.get("/test", (req, res) => res.send({ msg: "Server running well!!!" }));

// Check Redis Connection (Updated to modern async/await syntax)
app.get("/redis", async (req, res) => {
    try {
        await redis.set('foo', 'bar');
        const reply = await redis.get('foo');
        res.send({ msg: "Redis is connected & running well!!! Value: " + reply });
    } catch (err) {
        res.status(500).send({ error: "Redis error", details: err.message });
    }
});

// Auth Routes
app.use('/api/auth', authRoute);
app.use('/api/games', gameRoute);
// Ludo Setup Route (Called by GameSetup.jsx to create the game matrix in Redis)
app.post('/api/create-game', redisGameInitiate);


// ===== Global Error Handler =====
app.use(async (err, req, res, next) => {
    try {
        await ErrorLog.create({
            source: req.originalUrl?.includes('auth') ? 'Auth' : 'General',
            message: err.message,
            stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
            method: req.method,
            url: req.originalUrl,
            userId: req.user?.id,
            payload: { ...(req.body), password: "[REDACTED]" }, // Better standard than [PASSWORD]
            metadata: { userAgent: req.get('User-Agent') }
        });
    } catch (logError) {
        console.error("Failed to save error to DB:", logError);
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error"
    });
});

// ===== Start Server =====
server.listen(PORT, () => {
    console.log(`🚀 Neural Link Server running on port: ${PORT}`);
});