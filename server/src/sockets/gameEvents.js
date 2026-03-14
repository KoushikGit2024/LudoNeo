// import { Socket } from 'socket.io';
// import redisClient from '../config/redis.js';
// import piecePath from '../utils/piecePath.js'; 

// const SAFE_CELLS = new Set([1, 9, 14, 22, 27, 35, 40, 48, 52]);
// const disconnectTimers = new Map();

// // Standardized Turn Order mapping
// const MASTER_TURN_ORDER = ["R", "B", "Y", "G"];

// // Helper to determine next turn
// const getNextTurn = (currentColor, onBoard) => {
//     const activePlayers = MASTER_TURN_ORDER.filter(c => onBoard.includes(c));
//     const currentIndex = activePlayers.indexOf(currentColor);
//     return activePlayers[(currentIndex + 1) % activePlayers.length];
// };

// // Generates a unique 16-char ID for new POI matches
// const generateShortId = (length = 16) => {
//     const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
//     return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
// };

// const getSkeletonPlayer = (colorKey) => {
//     const startIdx = colorKey === 'R' ? 79 : colorKey === 'B' ? 83 : colorKey === 'Y' ? 87 : 91;
//     const hex = colorKey === 'R' ? "#ff0505" : colorKey === 'B' ? "#00D4FF" : colorKey === 'Y' ? "#ffc400" : "#00ff3c";
//     return {
//         socketId: "", userId: "", profile: "", online: false,
//         pieceIdx: [-1, -1, -1, -1],
//         pieceRef: [[startIdx, 1], [startIdx - 1, 1], [startIdx - 2, 1], [startIdx - 3, 1]],
//         homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: hex
//     };
// };

// export default function registerGameHandlers(io) {
  
//   io.on("connection", async (socket) => {
//     console.log("Total sockets:", io.engine.clientsCount);
//     console.log(`[NETWORK] 🟢 Socket Connected: ${socket.id}`);

//     const cancelDisconnectTimer = (gameId, color) => {
//       const timerKey = `${gameId}:${color}`;
//       if (disconnectTimers.has(timerKey)) {
//         console.log(`[DISCONNECT] 🛑 Cancelled purge timer for Node ${color} in ${gameId}`);
//         clearTimeout(disconnectTimers.get(timerKey));
//         disconnectTimers.delete(timerKey);
//         socket.broadcast.to(gameId).emit("player-reconnected", { message: `Node ${color} uplink restored.`, color });
//       }
//     };

//     // ==========================================
//     // 1. "Play with Friends" (POF) Auto-Init Logic 
//     // ==========================================
//     const gameType = socket.handshake.auth?.gameType;
//     if (gameType === "pof" && socket.player) {
//       try {
//         const gameId = socket.player.gameId;
//         const color = socket.player.color;
//         const boardSize = socket.player.size;
//         const username = socket.player.username || socket.user?.name;

//         socket.gameId = gameId;
//         socket.playerColor = color;
//         cancelDisconnectTimer(gameId, color);

//         const curCount = (await io.in(gameId).fetchSockets()).length;
//         let state = await redisClient.json.get(`game:${gameId}`);

//         if (!state) {
//             state = {
//                 meta: { gameId, status: "LOADED", type: "pof", gameStartedAt: [Date.now()], winLast: 0, playerCount: 0, onBoard: [], syncTick: 0 },
//                 move: { playerIdx: 0, turn: color, rollAllowed: true, moveCount: 0, ticks: 0, moveAllowed: false, moving: false, timeOut: false },
//                 players: { R: getSkeletonPlayer('R'), B: getSkeletonPlayer('B'), Y: getSkeletonPlayer('Y'), G: getSkeletonPlayer('G') }
//             };
//         } 
        
//         state.meta.playerCount = boardSize;
//         const normalizeSequence = (arr) => {
//             const order = ["R", "B", "Y", "G"];
//             const set = new Set(arr);
//             return order.filter(c => set.has(c));
//         }

//         state.meta.onBoard = normalizeSequence([...state.meta.onBoard, color]);
//         state.players[color].socketId = socket.id;
//         state.players[color].userId = username;
//         state.players[color].profile = socket.player.profile || "";
//         state.players[color].online = true;

//         if(state.meta.onBoard.length === boardSize) state.meta.status = "RUNNING";

//         await redisClient.json.set(`game:${gameId}`, '.', state);
//         socket.to(gameId).emit('add-player', { color, curCount, username, boardSize });

//         if(state.meta.onBoard.length === boardSize) {
//             setTimeout(() => { io.to(gameId).emit("initiate-game", { state }); }, 1000);
//         }
//       } catch (err) {
//         console.error("❌ [POF INIT] Error:", err);
//       }
//     }

//     // ==========================================
//     // 2. "Play Online" (POI) Manual Join Logic & Matchmaking
//     // ==========================================
//     socket.on("join-game", async ({ type }) => {
//       try {
//         const user = socket.user || {}; 
//         const playerInfo = socket.player || {};
//         let gameId = playerInfo.gameId || socket.handshake.auth.gameId; 
//         const requestedColor = playerInfo.color || null; 

//         // ✅ POI MATCHMAKING LOGIC: Generate or Fetch Game ID
//         if (!gameId && type === "poi") {
//             try {
//                 let waitingRoomId = await redisClient.get('poi_waiting_room');
                
//                 if (waitingRoomId) {
//                     const waitingState = await redisClient.json.get(`game:${waitingRoomId}`);
//                     // Check if room exists, is waiting, and has space
//                     if (waitingState && waitingState.meta.status === "WAITING" && waitingState.meta.playerCount < 4) {
//                         gameId = waitingRoomId;
//                     } else {
//                         // Room is full or started, create a new one
//                         gameId = generateShortId();
//                         await redisClient.set('poi_waiting_room', gameId);
//                     }
//                 } else {
//                     // No waiting room exists, create the first one
//                     gameId = generateShortId();
//                     await redisClient.set('poi_waiting_room', gameId);
//                 }
//             } catch (redisErr) {
//                 console.error("Redis Matchmaking Error:", redisErr);
//                 gameId = generateShortId(); // Fallback
//             }
//         }

//         if (!gameId) return socket.emit("error", "Invalid session data.");

//         let state = await redisClient.json.get(`game:${gameId}`);
        
//         if (!state) {
//             state = {
//                 meta: { gameId, status: "WAITING", type, gameStartedAt: [Date.now()], winLast: 0, playerCount: 0, onBoard: [], syncTick: 0 },
//                 move: { playerIdx: 0, turn: requestedColor || "R", rollAllowed: true, moveCount: 0, ticks: 0, moveAllowed: false, moving: false, timeOut: false },
//                 players: { R: getSkeletonPlayer('R'), B: getSkeletonPlayer('B'), Y: getSkeletonPlayer('Y'), G: getSkeletonPlayer('G') }
//             };
//         }

//         let assignedColor = null;

//         for (const c of ["R", "B", "Y", "G"]) {
//            if (user.userId && state.players[c].userId === user.userId) {
//                assignedColor = c;
//                break;
//            }
//         }

//         if (!assignedColor) {
//             if (state.meta.status === "FINISHED" || (state.meta.status === "RUNNING" && type !== "poi")) return socket.emit("error", "Game has already started or finished.");

//             const availableColors = ["R", "B", "Y", "G"].filter(c => !state.meta.onBoard.includes(c));
//             if (availableColors.length === 0) return socket.emit("error", "Lobby is full.");

//             assignedColor = type === "poi" ? availableColors[Math.floor(Math.random() * availableColors.length)] : (availableColors.includes(requestedColor) ? requestedColor : availableColors[0]); 

//             state.players[assignedColor] = { ...state.players[assignedColor], socketId: socket.id, name: user.name, userId: user.userId, profile: user.profile, online: true };
//             state.meta.onBoard.push(assignedColor);
//             state.meta.onBoard.sort((a, b) => MASTER_TURN_ORDER.indexOf(a) - MASTER_TURN_ORDER.indexOf(b));
//             state.meta.playerCount = state.meta.onBoard.length;

//             if (state.meta.playerCount === 1) state.move.turn = assignedColor;
//             if (state.meta.playerCount >= 2 && (type === "poi" || type === "pof")) state.meta.status = "RUNNING";

//         } else {
//             state.players[assignedColor].socketId = socket.id;
//             state.players[assignedColor].online = true;
//         }

//         socket.gameId = gameId;
//         socket.playerColor = assignedColor;
//         socket.userId = user.userId;
        
//         socket.join(gameId); 
//         cancelDisconnectTimer(gameId, assignedColor);

//         state.syncTick = (state.syncTick || 0) + 1;

//         await redisClient.json.set(`game:${gameId}`, '.', state);
//         await redisClient.expire(`game:${gameId}`, 7200);

//         socket.emit("join-success", { assignedColor, newState: state });
//         io.to(gameId).emit("player-joined", { message: `Pilot ${user.name} established uplink to Node ${assignedColor}.`, newState: state, syncArray: [state.syncTick - 1, state.syncTick] });

//       } catch (err) { console.error("❌ [JOIN] Error:", err); }
//     });

//     // ==========================================
//     // 3. SYNC STATE (Full State)
//     // ==========================================
//     socket.on("sync-state", async ({ gameId, color }) => {
//       try {
//         if (socket.gameId !== gameId || socket.playerColor !== color) return;
//         const state = await redisClient.json.get(`game:${gameId}`);
//         if (state) {
//           socket.join(gameId); 
//           socket.emit("state-synced", state);
//         }
//       } catch (err) { console.error("❌ [SYNC] Redis Error:", err); }
//     });

//     // ==========================================
//     // 4. ROLL DICE (Delta Update)
//     // ==========================================
//     socket.on("roll-dice", async ({ gameId, color }) => {
//       if (socket.playerColor !== color) return;

//       try {
//           const state = await redisClient.json.get(`game:${gameId}`);
//           if (!state || state.meta.status === "FINISHED" || state.move.turn !== color || state.move.moving || !state.move.rollAllowed) return;

//           const diceValue = Math.floor(Math.random() * 6) + 1; 
          
//           state.move.moveCount = diceValue;
//           state.move.rollAllowed = false;
//           state.move.moveAllowed = true;
//           state.move.ticks += 1;
//           state.move.timeOut = false; 

//           const hasValidMove = state.players[color].pieceIdx.some(idx => 
//             (idx === -1 && diceValue === 6) || (idx !== -1 && idx + diceValue <= 56)
//           );

//           if (!hasValidMove) {
//             state.move.turn = getNextTurn(color, state.meta.onBoard);
//             state.move.rollAllowed = true;
//             state.move.moveAllowed = false;
//             state.move.moveCount = 0;
//             state.move.ticks = 0; 
//           }

//           state.syncTick = (state.syncTick || 0) + 1;
//           await redisClient.json.set(`game:${gameId}`, '.', state);
//           await redisClient.expire(`game:${gameId}`, 7200);
          
//           io.to(gameId).emit("dice-rolled", { value: diceValue, moveUpdates: state.move, syncArray: [state.syncTick - 1, state.syncTick] });
//       } catch (err) { console.error("❌ [ROLL] Error:", err); }
//     });

//     // ==========================================
//     // 5. MOVE PIECE (Delta Update)
//     // ==========================================
//     socket.on("move-piece", async ({ gameId, color, pieceIdx, refNum }) => {
//         if (socket.playerColor !== color) return;

//         try {
//             const state = await redisClient.json.get(`game:${gameId}`);
//             if (!state || state.meta.status === "FINISHED" || state.move.turn !== color || !state.move.moveAllowed) return;

//             let moveCount = state.move.moveCount;
//             let player = state.players[color];
//             if (!player) return;

//             let currentPathIdx = player.pieceIdx[pieceIdx];
//             let isOpening = currentPathIdx === -1 && moveCount === 6;

//             if (currentPathIdx === -1 && !isOpening) return;

//             let steps = isOpening ? 1 : moveCount;
//             let targetPathIdx = currentPathIdx + steps;
//             if (targetPathIdx > 56) return;

//             let targetRef = piecePath[color][targetPathIdx];
//             let cutInfo = null;
//             let nextTurnBonus = (moveCount === 6); 
//             let updatedPlayers = { [color]: player };

//             if (!SAFE_CELLS.has(targetRef) && targetPathIdx < 56) {
//                 for (const oppColor of MASTER_TURN_ORDER) {
//                     if (oppColor === color || !state.meta.onBoard.includes(oppColor)) continue;

//                     let oppPlayer = state.players[oppColor];
//                     let oppPiecesAtRef = oppPlayer.pieceIdx
//                         .map((pIdx, i) => ({ pIdx, origIdx: i }))
//                         .filter(p => p.pIdx !== -1 && piecePath[oppColor][p.pIdx] === targetRef);

//                     if (oppPiecesAtRef.length === 1) {
//                         let cutPieceOrigIdx = oppPiecesAtRef[0].origIdx;
//                         oppPlayer.pieceIdx[cutPieceOrigIdx] = -1; 
//                         oppPlayer.homeCount += 1;
//                         oppPlayer.outCount -= 1;

//                         cutInfo = { color: oppColor, idx: cutPieceOrigIdx, fromRef: targetRef };
//                         nextTurnBonus = true; 
//                         updatedPlayers[oppColor] = oppPlayer;
//                     }
//                 }
//             }

//             if (isOpening) { player.homeCount -= 1; player.outCount += 1; }

//             if (targetPathIdx === 56) {
//                 player.outCount -= 1;
//                 player.winCount += 1;
//                 nextTurnBonus = true; 

//                 if (player.winCount === 4 && player.winPosn === 0) {
//                     state.meta.winLast += 1;
//                     player.winPosn = state.meta.winLast;

//                     if (state.meta.winLast >= state.meta.playerCount - 1) {
//                         state.meta.status = "FINISHED";
//                     }
//                 }
//             }

//             player.pieceIdx[pieceIdx] = targetPathIdx;

//             MASTER_TURN_ORDER.forEach(c => {
//                 if (!state.players[c]) return;
//                 let baseStart = c === 'R' ? 79 : c === 'B' ? 83 : c === 'Y' ? 87 : 91;
//                 let refCounts = {};

//                 state.players[c].pieceIdx.forEach((pIdx, i) => {
//                     let ref = pIdx === -1 ? baseStart - i : piecePath[c][pIdx];
//                     refCounts[ref] = (refCounts[ref] || 0) + 1;
//                 });
//                 state.players[c].pieceRef = Object.entries(refCounts).map(([ref, count]) => [Number(ref), count]);
//             });

//             if (state.meta.status !== "FINISHED" && !nextTurnBonus) {
//                 state.move.turn = getNextTurn(color, state.meta.onBoard);
//             } 

//             if (state.meta.status !== "FINISHED") {
//                 state.move.rollAllowed = true;
//                 state.move.moveAllowed = false;
//                 state.move.moveCount = 0;
//                 state.move.ticks = 0;
//             }

//             state.syncTick = (state.syncTick || 0) + 1;
//             await redisClient.json.set(`game:${gameId}`, '.', state);
//             await redisClient.expire(`game:${gameId}`, 7200);

//             io.to(gameId).emit("piece-moved", {
//                 animation: { color, pieceIdx, fromRef: refNum, steps, cutInfo },
//                 updates: { move: state.move, metaUpdates: { status: state.meta.status, winLast: state.meta.winLast }, playerUpdates: updatedPlayers },
//                 syncArray: [state.syncTick - 1, state.syncTick]
//             });

//         } catch (err) { console.error("❌ [MOVE] Critical Socket Error:", err); }
//     });

//     // ==========================================
//     // 6. TIME-OUT / AUTO-SKIP TURN (Delta Update)
//     // ==========================================
//     socket.on("turn-timeout", async ({ gameId, color }) => {
//         if (socket.playerColor !== color) return;

//         try {
//             const state = await redisClient.json.get(`game:${gameId}`);
//             if (!state || state.move.turn !== color || state.meta.status === "FINISHED") return;

//             state.move.turn = getNextTurn(color, state.meta.onBoard);
//             state.move.rollAllowed = true;
//             state.move.moveAllowed = false;
//             state.move.moveCount = 0;
//             state.move.ticks = 0;
//             state.move.timeOut = true; 

//             state.syncTick = (state.syncTick || 0) + 1;
//             await redisClient.json.set(`game:${gameId}`, '.', state);
//             await redisClient.expire(`game:${gameId}`, 7200);

//             io.to(gameId).emit("turn-timeout-update", { moveUpdates: state.move, syncArray: [state.syncTick - 1, state.syncTick] });
//         } catch(err) { console.error("❌ [TIMEOUT] Error:", err); }
//     });

//     // ==========================================
//     // 7. DELAYED DISCONNECT LOGIC 
//     // ==========================================
//     socket.on("disconnect", (reason) => {
//       console.log(`[NETWORK] 🔴 Socket Disconnected: ${socket.id} | Reason: ${reason}`);
      
//       const gameId = socket.gameId || socket.player?.gameId;
//       const color = socket.playerColor || socket.player?.color;
//       if (!gameId || !color) return; 

//       io.to(gameId).emit("player-offline-warning", { message: `WARNING: player ${color} signal lost.`, color });

//       const timerKey = `${gameId}:${color}`;
      
//       const purgeTimer = setTimeout(async () => {
//         try {
//           const state = await redisClient.json.get(`game:${gameId}`);
//           if (!state || state.meta.status === "FINISHED") return;

//           const boardIndex = state.meta.onBoard.indexOf(color);
//           if (boardIndex === -1) return;

//           state.meta.onBoard.splice(boardIndex, 1);
//           state.meta.playerCount = state.meta.onBoard.length;
//           state.players[color] = getSkeletonPlayer(color);

//           if (state.move.turn === color && state.meta.onBoard.length > 0) {
//             state.move.turn = getNextTurn(color, state.meta.onBoard);
//             state.move.rollAllowed = true;
//             state.move.moveAllowed = false;
//             state.move.moveCount = 0;
//             state.move.ticks = 0;
//           }

//           if (state.meta.onBoard.length < 2) {
//             state.meta.status = "FINISHED";
//             state.move.rollAllowed = false;
//             state.move.moveAllowed = false;
//             state.move.turn = null;
//           }

//           state.syncTick = (state.syncTick || 0) + 1;
//           await redisClient.json.set(`game:${gameId}`, '.', state);
//           await redisClient.expire(`game:${gameId}`, 7200);
          
//           io.to(gameId).emit("player-left", { 
//             message: `CRITICAL: Node ${color} purged from memory core.`,
//             newState: state,
//             syncArray: [state.syncTick - 1, state.syncTick]
//           });
          
//           disconnectTimers.delete(timerKey);
//         } catch (err) { console.error("❌ [PURGE] Error:", err); }
//       }, 10000); 

//       disconnectTimers.set(timerKey, purgeTimer);
//     });
//   });
// }
import { 
  handlePofInit, 
  handleJoinGame, 
  handleSyncState, 
  handleRollDice, 
  handleMovePiece, 
  handleTurnTimeout, 
  handleDisconnect 
} from './gameControlers.js';

export default function registerGameHandlers(io) {
  io.on("connection", async (socket) => {
    console.log(`[NETWORK] 🟢 Socket Connected: ${socket.id}`);
    // console.log(await io.fetchSockets())
    // Auto-init for "Play with Friends" (POF) if auth data exists
    const gameType = socket.handshake.auth?.gameType;
    if (gameType === "pof" && socket.player) {
      handlePofInit(io, socket);
    }

    // Bind Event Listeners to Controllers
    socket.on("join-game", (data) => handleJoinGame(io, socket, data));
    
    socket.on("sync-state", (data) => handleSyncState(socket, data));
    
    socket.on("roll-dice", (data) => handleRollDice(io, socket, data));
    
    socket.on("move-piece", (data) => handleMovePiece(io, socket, data));
    
    socket.on("turn-timeout", (data) => handleTurnTimeout(io, socket, data));
    
    socket.on("disconnect", (reason) => handleDisconnect(io, socket, reason));
  });
}