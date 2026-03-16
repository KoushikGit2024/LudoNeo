import redisClient from '../config/redis.js';
import Game from '../models/gameModel.js';

// ==========================================
// 0. INITIALIZE REDIS GAME (For Online Multiplayer)
// ==========================================
export const initOnlineGameRedis = async (req, res, next) => {
    const { gameId, players } = req.body; 
    // players = e.g., ["R", "B", "Y", "G"] or just ["R", "Y"]

    // Construct the initial Zustand-style state
    const initialState = {
        meta: {
            gameId: gameId,
            status: "RUNNING",
            type: "online",
            gameStartedAt: [Date.now()],
            winLast: 0,
            playerCount: players.length,
            onBoard: players, // Array of active colors
        },
        move: {
            playerIdx: 0,
            turn: players[0], // First player starts
            rollAllowed: true,
            moveCount: 0,
            ticks: 0,
            moveAllowed: false,
            moving: false,
            timeOut: false,
        },
        players: {
            // Initialize all 4 colors. Only active ones will move.
            R: { name: "", username: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[79, 1], [78, 1], [77, 1], [76, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#FF3131" },
            B: { name: "", username: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[83, 1], [82, 1], [81, 1], [80, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#00D4FF" },
            Y: { name: "", username: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[87, 1], [86, 1], [85, 1], [84, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#ffc400" },
            G: { name: "", username: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[91, 1], [90, 1], [89, 1], [88, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#39FF14" },
        },
    };

    try {
        // Save the fresh game to Redis
        await redisClient.json.set(`game:${gameId}`, '.', initialState);
        res.status(200).json({ success: true, gameId });
    } catch (error) {
        console.error("❌ Redis Init Error:", error);
        res.status(500).json({ success: false, message: "Failed to initialize game matrix" });
    }
};

// ==========================================
// 1. SAVE OR UPDATE MONGODB GAME (Memory Cores)
// ==========================================
export const saveGame = async (req, res, next) => {
    try {
        const ownerId = req.user.id; // Protected by tokenChecker
        const { meta, move, players } = req.body;

        if (!meta || !meta.gameId) {
            return res.status(400).json({ success: false, message: "Invalid game payload. Missing gameId." });
        }

        // Upsert: Find by gameId & ownerId. If it exists, update it. If not, create it.
        const game = await Game.findOneAndUpdate(
            { 'meta.gameId': meta.gameId, ownerId: ownerId }, 
            { ownerId, meta, move, players },                 
            { upsert: true, returnDocument: 'after' }         // Safe Mongoose syntax
        );

        res.status(200).json({ success: true, message: "Game synced successfully", game });
    } catch (error) {
        console.error("❌ Save Game Error:", error);
        next(error);
    }
};

// ==========================================
// 2. FETCH LIGHTWEIGHT GAME SPECS (For the UI List)
// ==========================================
export const getSavedGamesList = async (req, res, next) => {
    try {
        const ownerId = req.user.id;

        // .select() ONLY fetches the metadata. Leaves behind the massive player/move objects.
        const games = await Game.find({ ownerId, 'meta.status': { $ne: 'FINISHED' } })
            .select('meta.gameId meta.title meta.type meta.status updatedAt createdAt')
            .sort({ updatedAt: -1 }); // Newest games first

        res.status(200).json({ success: true, games });
    } catch (error) {
        console.error("❌ Fetch Saved Games List Error:", error);
        next(error);
    }
};

// ==========================================
// 3. FETCH FULL GAME DATA (When user clicks 'Resume')
// ==========================================
export const getGameById = async (req, res, next) => {
    try {
        const ownerId = req.user.id;
        const { gameId } = req.params;

        // Fetch the entire document, strictly ensuring it belongs to this logged-in user
        const game = await Game.findOne({ 'meta.gameId': gameId, ownerId });

        if (!game) {
            return res.status(404).json({ success: false, message: "Memory core not found or access denied." });
        }

        res.status(200).json({ success: true, game });
    } catch (error) {
        console.error("❌ Fetch Full Game Error:", error);
        next(error);
    }
};
export const deleteSavedGame = async (req, res, next) => {
  try {
    const gameId = req.params.id;
    console.log(req.user);
    // Assuming your Game model is separate and bound to the user
    const deletedGame = await Game.findOneAndDelete({ 
       $or: [{ _id: gameId }, { 'meta.gameId': gameId }], 
       ownerId: req.user.id // Security check to ensure they own the core
    });
    console.log(deletedGame);
    if (!deletedGame) {
      return res.status(404).json({ success: false, message: 'Memory Core not found or unauthorized.' });
    }

    res.status(200).json({ success: true, message: 'Memory Core permanently erased.' });
  } catch (error) {
    console.error("Error deleting saved game:", error);
    next(error);
  }
}

export const recordMatchStats = async (req, res, next) => {
    try {
        const { gameId, result, opponent, gameType } = req.body;
        const userId = req.user.id;

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // 1. Calculate Base Progress
        const xpGain = result === 'win' ? 750 : 200;
        user.stats.xp += xpGain;
        user.stats.totalMatches += 1;
        
        if (result === 'win') user.stats.wins += 1;
        else if (result === 'loss') user.stats.losses += 1;

        // 2. Process Level Ups
        while (user.stats.xp >= user.stats.nextLevelXp) {
            user.stats.level += 1;
            user.stats.xp -= user.stats.nextLevelXp;
            user.stats.nextLevelXp = Math.floor(user.stats.nextLevelXp * 1.6);
        }

        // 3. Update Win Rate
        user.stats.winRate = user.stats.totalMatches > 0 
            ? ((user.stats.wins / user.stats.totalMatches) * 100).toFixed(1) + '%' 
            : "0%";

        // 4. Update History (keep last 50 matches)
        user.stats.matchHistory.push({ gameId, date: new Date(), result, opponent, gameType });
        if (user.stats.matchHistory.length > 50) {
            user.stats.matchHistory.shift();
        }

        await user.save();
        
        // Return updated user object so frontend Zustand store syncs automatically
        res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("❌ Record Match Stats Error:", error);
        next(error);
    }
};