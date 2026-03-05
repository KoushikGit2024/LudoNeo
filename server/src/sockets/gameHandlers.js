import redisClient from '../config/redis.js';
import piecePath from '../utils/piecePath.js'; // Ensure this matches your frontend logic exactly

const SAFE_CELLS = new Set([1, 9, 14, 22, 27, 35, 40, 48, 52]);

export default function registerGameHandlers(io) {
  io.on("connect", (socket) => {
    
    // --- 1. SYNC STATE ---
    socket.on("sync-state", async ({ gameId }) => {
      try {
        const state = await redisClient.json.get(`game:${gameId}`);
        if (state) {
          // Join the socket room for this specific game
          socket.join(gameId); 
          socket.emit("state-synced", state);
        }
      } catch (err) {
        console.error("Redis Sync Error:", err);
      }
    });

    // --- 2. ROLL DICE ---
    socket.on("roll-dice", async ({ gameId, color }) => {
      const state = await redisClient.json.get(`game:${gameId}`);
      if (!state || state.move.turn !== color || state.move.moving || !state.move.rollAllowed) return;

      const diceValue = Math.floor(Math.random() * 6) + 1; // Pure server-side random
      
      state.move.moveCount = diceValue;
      state.move.rollAllowed = false;
      state.move.moveAllowed = true;
      state.move.ticks += 1;

      // Check if player has valid moves
      const hasValidMove = state.players[color].pieceIdx.some(idx => 
        (idx === -1 && diceValue === 6) || (idx !== -1 && idx + diceValue <= 56)
      );

      if (!hasValidMove) {
        // Auto transfer turn if no valid moves exist
        let onBoardArr = Array.from(state.meta.onBoard);
        let currIdx = onBoardArr.indexOf(color);
        state.move.turn = onBoardArr[(currIdx + 1) % onBoardArr.length];
        state.move.rollAllowed = true;
        state.move.moveAllowed = false;
        state.move.moveCount = 0;
      }

      await redisClient.json.set(`game:${gameId}`, '.', state);
      // Emit to the whole room so everyone sees the dice roll
      io.to(gameId).emit("dice-rolled", { value: diceValue, newState: state });
    });

    // --- 3. MOVE PIECE ---
    socket.on("move-piece", async ({ gameId, color, pieceIdx, refNum }) => {
      const state = await redisClient.json.get(`game:${gameId}`);
      if (!state || state.move.turn !== color || !state.move.moveAllowed) return;

      let moveCount = state.move.moveCount;
      let player = state.players[color];
      let currentPathIdx = player.pieceIdx[pieceIdx];
      let isOpening = currentPathIdx === -1 && moveCount === 6;

      if (currentPathIdx === -1 && !isOpening) return; // Invalid move

      let steps = isOpening ? 1 : moveCount;
      let targetPathIdx = currentPathIdx + steps;
      
      if (targetPathIdx > 56) return; // Exceeds home, invalid

      let targetRef = piecePath[color][targetPathIdx];
      let cutInfo = null;
      let nextTurnBonus = (moveCount === 6); // Reroll on 6

      // --- Detect Cuts ---
      if (!SAFE_CELLS.has(targetRef) && targetPathIdx < 56) {
        for (const oppColor of ["R", "B", "Y", "G"]) {
          if (oppColor === color) continue;
          
          let oppPlayer = state.players[oppColor];
          // Find if opponent has exactly 1 piece on this target cell
          let oppPiecesAtRef = oppPlayer.pieceIdx
            .map((pIdx, i) => ({ pIdx, origIdx: i }))
            .filter(p => p.pIdx !== -1 && piecePath[oppColor][p.pIdx] === targetRef);
          
          if (oppPiecesAtRef.length === 1) { // Can be cut
            let cutPieceOrigIdx = oppPiecesAtRef[0].origIdx;
            oppPlayer.pieceIdx[cutPieceOrigIdx] = -1;
            oppPlayer.homeCount += 1;
            oppPlayer.outCount -= 1;
            
            cutInfo = { color: oppColor, idx: cutPieceOrigIdx, fromRef: targetRef };
            nextTurnBonus = true; // Reroll on cut
          }
        }
      }

      // --- Update Moving Piece State ---
      if (isOpening) {
        player.homeCount -= 1;
        player.outCount += 1;
      }
      
      if (targetPathIdx === 56) {
        player.outCount -= 1;
        player.winCount += 1;
        nextTurnBonus = true; // Reroll on reaching home
        
        if (player.winCount === 4 && player.winPosn === 0) {
          state.meta.winLast += 1;
          player.winPosn = state.meta.winLast;
          if (state.meta.winLast >= state.meta.playerCount - 1) {
            state.meta.status = "FINISHED";
          }
        }
      }

      player.pieceIdx[pieceIdx] = targetPathIdx;

      // --- Re-calculate pieceRef Array (Visual Stacking Fix) ---
      // We must aggregate counts so Zustand receives an array of tuples like [[79, 2], [80, 1]]
      ["R", "B", "Y", "G"].forEach(c => {
        let baseStart = c === 'R' ? 79 : c === 'B' ? 83 : c === 'Y' ? 87 : 91;
        let refCounts = {}; // Temporary object to tally counts

        state.players[c].pieceIdx.forEach((pIdx, i) => {
          let ref = pIdx === -1 ? baseStart - i : piecePath[c][pIdx];
          refCounts[ref] = (refCounts[ref] || 0) + 1;
        });

        // Convert the object back into the array format Zustand expects: [[ref, count], ...]
        state.players[c].pieceRef = Object.entries(refCounts).map(([ref, count]) => [Number(ref), count]);
      });

      // --- Transfer Turn ---
      if (state.meta.status !== "FINISHED" && !nextTurnBonus) {
        let onBoardArr = Array.from(state.meta.onBoard);
        let currIdx = onBoardArr.indexOf(color);
        state.move.turn = onBoardArr[(currIdx + 1) % onBoardArr.length];
      }
      
      if (state.meta.status !== "FINISHED") {
        state.move.rollAllowed = !nextTurnBonus;
        state.move.moveAllowed = false;
        state.move.moveCount = 0;
      }

      // Save to Redis
      await redisClient.json.set(`game:${gameId}`, '.', state);

      // Emit animation commands to the specific game room
      io.to(gameId).emit("piece-moved", {
        animation: { color, pieceIdx, fromRef: refNum, steps, cutInfo },
        newState: state
      });
    });

    // Handle Disconnects (Optional Cleanup)
    socket.on("disconnect", () => {
      // Logic for pausing game or skipping offline player goes here
    });

  });
}