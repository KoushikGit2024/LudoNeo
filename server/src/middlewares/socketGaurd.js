import jwt from "jsonwebtoken";
import redis from "../config/redis.js";

const socketGuard = async (socket, next, io) => {
  try {
    // 1. Extract cookie string
    const cookie = socket.request.headers.cookie;
    const token = cookie
      ? cookie
          .split("; ")
          .find(row => row.startsWith("token="))
          ?.split("=")[1]
      : null;
      
    const gameType = socket.handshake.auth?.gameType || null;
    const playerDescription = socket.handshake.auth?.playerDescription || null;
    const gameId = socket.handshake.auth?.gameId || null;

    // 🛡️ gameId can be null for new POI matches, so we don't strictly require it here
    if (!token || !playerDescription && gameType !== "poi" || !gameType) {
      return next(new Error("Authentication failed: Missing credentials"));
    }

    if (gameType === "pof" && !gameId) {
        return next(new Error("Authentication failed: POF requires a gameId"));
    }

    // 2. Verify Tokens
    const decodedUser = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decodedUser;

    const decodedPlayer = jwt.verify(playerDescription, process.env.JWT_SECRET);
    socket.player = decodedPlayer;

    if (gameId && socket.player.gameId && socket.player.gameId !== gameId) {
      console.log(`[AUTH] Connection revoked: Game ID mismatch for ${socket.player.username}`);
      return next(new Error("Connection revoked"));
    }

    // ==========================================
    // 3. GLOBAL DUPLICATE TAB CHECK (Handles POI & POF)
    // ==========================================
    const allSockets = await io.fetchSockets();
    const isUserAlreadyConnected = allSockets.some(
        (s) => { return s.player?.username === socket.player.username && s.id !== socket.id}
    );
    // console.log(isUserAlreadyConnected)
    if (isUserAlreadyConnected) {
        console.log(`[AUTH] 🛑 Rejected: ${socket.player.username} is already connected in another tab.`);
        return next(new Error("Player is already connected across the server"));
    }

    // ==========================================
    // 4. ROOM-SPECIFIC CHECKS (If gameId exists)
    // ==========================================
    if (gameId) {
        // Fetch all 4 player objects in the room at once
        const playerStateList = await redis.json.get(`game:${gameId}`, {
            path: `$.players.*`
        });

        if (playerStateList) {
            const currentSocketsInRoom = await io.in(gameId).fetchSockets();
            const playerCount = currentSocketsInRoom.length;

            // Match by username to see if they are in this room state
            const existingPlayerRecord = playerStateList.find(p => p.userId === socket.player.username);
            // console.log(existingPlayerRecord)
            if (existingPlayerRecord && existingPlayerRecord.socketId) {
                const isOldSocketStillActive = currentSocketsInRoom.some(s => s.id === existingPlayerRecord.socketId);
                if (isOldSocketStillActive) {
                    console.log(`[AUTH] 🛑 Rejected: ${socket.player.username} is already active in game ${gameId}.`);
                    return next(new Error("Player is already active in this game"));
                }
            }

            // Reject if full, unless they are an existing player reconnecting
            // console.log(existingPlayerRecord,playerCount,socket.player.size,gameType)
            if (!existingPlayerRecord && playerCount >= socket.player.size && gameType === "pof") {
                console.log(`[AUTH] 🛑 Rejected: Game ${gameId} is full.`);
                return next(new Error("Game is full"));
            }
        }

        console.log(`[AUTH] ✅ Verified Node ${socket.player.color || 'Pending'} for user ${socket.player.username}`);
        
        // Auto-join socket room only for POF. POI matchmaking handles room assignment later.
        if (gameType === "pof") {
            socket.join(gameId);
        }
    } else {
        console.log(`[AUTH] ✅ Verified user ${socket.player.username} for POI Matchmaking`);
    }

    return next();
  } catch (err) {
    console.error("❌ [AUTH] Socket error:", err.message);
    next(new Error("Authentication error"));
  }
};

export default socketGuard;