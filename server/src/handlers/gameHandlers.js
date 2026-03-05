import redisClient from '../config/redis.js';

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