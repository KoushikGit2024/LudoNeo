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
import registerGameHandlers from "./src/sockets/gameEvents.js";
import socketGaurd from "./src/middlewares/socketGaurd.js";
import redis from "./src/config/redis.js"; 
import gameRoute from "./src/routes/gameRoutes.js";
import errorHandler from "./src/middlewares/errorHandler.js";

// ✅ Import the new Logger Middleware
import requestLogger from "./src/middlewares/requestLogger.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// ===== CORS Configuration =====
const rawOrigins = process.env.CORS_ORIGIN || "";

const allowedOrigins = rawOrigins
  .split(",")
  .map(o => o.trim());

const corsOptions = {
  origin: (origin, cb) => {
    if (process.env.NODE_ENV !== "production") {
      return cb(null, true);
    }
    if (!origin) return cb(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o))) {
      return cb(null, true);
    }
    return cb(new Error("Origin not allowed by CORS"), false);
  },
  credentials: true
};

// ===== Middlewares =====
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// ✅ Add the logger middleware here so it triggers on EVERY route
app.use(requestLogger);

// ===== MongoDB Connection =====
connectMongo();

// ===== Socket.io Setup =====
const io = new Server(server, {cors:corsOptions});

io.use((socket,next)=>socketGaurd(socket,next,io));
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

// Check Redis Connection
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

// ===== Global Error Handler =====
app.use(errorHandler);

// ===== Start Server =====
server.listen(PORT, () => {
    console.log(`🚀 Neural Link Server running on port: ${PORT}`);
});