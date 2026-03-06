import redisClient from '../config/redis.js';
import GameStore from '../models/gameModel.js'; // Ensure the path matches your schema file

export default async (req, res) => {
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
      R: { name: "", userId: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[79, 1], [78, 1], [77, 1], [76, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#FF3131" },
      B: { name: "", userId: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[83, 1], [82, 1], [81, 1], [80, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#00D4FF" },
      Y: { name: "", userId: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[87, 1], [86, 1], [85, 1], [84, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#ffc400" },
      G: { name: "", userId: "", profile: "", pieceIdx: [-1, -1, -1, -1], pieceRef: [[91, 1], [90, 1], [89, 1], [88, 1]], homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#39FF14" },
    },
  };

  try {
    // Save the fresh game to Redis
    await redisClient.json.set(`game:${gameId}`, '.', initialState);
    res.status(200).json({ success: true, gameId });
  } catch (error) {
    res.status(500).json({ error: "Failed to initialize game matrix" });
  }
}


export const saveGame = async (req, res) => {
    try {
        const { meta, move, players } = req.body;

        // Validation
        if (!meta || !meta.gameId) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing gameId in payload" 
            });
        }

        // Upsert: Find by gameId. If it exists, update it. If not, create it.
        const updatedGame = await GameStore.findOneAndUpdate(
            { "meta.gameId": meta.gameId }, // Search query
            { 
                $set: { 
                    meta, 
                    move, 
                    players, 
                    isDeleted: false 
                } 
            },
            { new: true, upsert: true } // Return new document, create if not found
        );

        res.status(200).json({ success: true, game: updatedGame });
    } catch (error) {
        console.error("❌ Save Game Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error while saving game",
            error: error.message 
        });
    }
};

// @desc    Retrieve a saved game by gameId
// @route   GET /api/games/:gameId
// @access  Public (or Private)
export const getGame = async (req, res) => {
    try {
        const { gameId } = req.params;

        // Find the game, ensuring it hasn't been soft-deleted
        const game = await GameStore.findOne({ 
            "meta.gameId": gameId, 
            isDeleted: false 
        });

        if (!game) {
            return res.status(404).json({ 
                success: false, 
                message: "Game not found or has been deleted." 
            });
        }

        res.status(200).json({ success: true, game });
    } catch (error) {
        console.error("❌ Get Game Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error while fetching game",
            error: error.message 
        });
    }
};