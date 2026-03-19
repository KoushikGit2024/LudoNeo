import redisClient from '../config/redis.js';
import piecePath from '../utils/piecePath.js';
import User from '../models/userModel.js';

const SAFE_CELLS = new Set([1, 9, 14, 22, 27, 35, 40, 48, 52]);
const disconnectTimers = new Map();
const turnTimers = new Map();
const MASTER_TURN_ORDER = ["R", "B", "Y", "G"];
const AUTO_SKIP_LIMIT = 5;

// ─────────────────────────────────────────────────────────────────────────────
// ROOM MUTEX LOCKS
// ─────────────────────────────────────────────────────────────────────────────
const gameLocks = new Map();

const acquireLock = async (gameId) => {
  while (gameLocks.get(gameId)) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  gameLocks.set(gameId, true);
};

const releaseLock = (gameId) => {
  gameLocks.delete(gameId);
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const getNextTurn = (currentColor, onBoard) => {
  const onBoardSet = new Set(onBoard);
  const activePlayers = MASTER_TURN_ORDER.filter(c => onBoardSet.has(c));
  const currentIndex = activePlayers.indexOf(currentColor);
  return activePlayers[(currentIndex + 1) % activePlayers.length];
};

const generateShortId = (length = 16) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
};

const getSkeletonPlayer = (colorKey) => {
  const startIdx = colorKey === 'R' ? 79 : colorKey === 'B' ? 83 : colorKey === 'Y' ? 87 : 91;
  const hex = colorKey === 'R' ? "#ff0505" : colorKey === 'B' ? "#00D4FF" : colorKey === 'Y' ? "#ffc400" : "#00ff3c";
  return {
    socketId: "", username: "", profile: "", online: false,
    pieceIdx: [-1, -1, -1, -1],
    pieceRef: [[startIdx, 1], [startIdx - 1, 1], [startIdx - 2, 1], [startIdx - 3, 1]],
    homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: hex
  };
};

const cancelDisconnectTimer = (socket, gameId, color) => {
  const timerKey = `${gameId}:${color}`;
  if (disconnectTimers.has(timerKey)) {
    clearTimeout(disconnectTimers.get(timerKey));
    disconnectTimers.delete(timerKey);
    socket.broadcast.to(gameId).emit("player-reconnected", {
      message: `Node ${color} uplink restored.`, color
    });
  }
};

const applyPieceMove = (state, color, pieceIdx, moveCount) => {
  let player         = state.players[color];
  let currentPathIdx = player.pieceIdx[pieceIdx];
  let isOpening      = currentPathIdx === -1 && moveCount === 6;

  let baseStart = color === 'R' ? 79 : color === 'B' ? 83 : color === 'Y' ? 87 : 91;
  let fromRef   = currentPathIdx === -1 ? baseStart - pieceIdx : piecePath[color][currentPathIdx];

  if (currentPathIdx === -1 && !isOpening) return { moved: false, nextTurnBonus: false };

  let steps         = isOpening ? 1 : moveCount;
  let targetPathIdx = currentPathIdx + steps;
  if (targetPathIdx > 56) return { moved: false, nextTurnBonus: false };

  let targetRef      = piecePath[color][targetPathIdx];
  let cutInfo        = null;
  let nextTurnBonus  = (moveCount === 6);
  let updatedPlayers = { [color]: player };

  if (!SAFE_CELLS.has(targetRef) && targetPathIdx < 56) {
    for (const oppColor of MASTER_TURN_ORDER) {
      if (oppColor === color || !state.meta.onBoard.includes(oppColor)) continue;
      let oppPlayer = state.players[oppColor];
      let oppPiecesAtRef = oppPlayer.pieceIdx
        .map((pIdx, i) => ({ pIdx, origIdx: i }))
        .filter(p => p.pIdx !== -1 && piecePath[oppColor][p.pIdx] === targetRef);

      if (oppPiecesAtRef.length === 1) {
        let cutPieceOrigIdx = oppPiecesAtRef[0].origIdx;
        oppPlayer.pieceIdx[cutPieceOrigIdx] = -1;
        oppPlayer.homeCount += 1;
        oppPlayer.outCount  -= 1;
        cutInfo       = { color: oppColor, idx: cutPieceOrigIdx, fromRef: targetRef };
        nextTurnBonus = true; 
        updatedPlayers[oppColor] = oppPlayer;
      }
    }
  }

  if (isOpening) { player.homeCount -= 1; player.outCount += 1; }

  if (targetPathIdx === 56) {
    player.outCount  -= 1;
    player.winCount  += 1;
    nextTurnBonus = true; 

    if (player.winCount === 4 && player.winPosn === 0) {
      state.meta.winLast += 1;
      player.winPosn = state.meta.winLast;
      const targetCount = state.meta.targetPlayerCount || state.meta.playerCount;
      if (state.meta.winLast >= targetCount - 1) {
        state.meta.status = "FINISHED";
      }
    }
  }

  player.pieceIdx[pieceIdx] = targetPathIdx;

  MASTER_TURN_ORDER.forEach(c => {
    if (!state.players[c]) return;
    let baseStart = c === 'R' ? 79 : c === 'B' ? 83 : c === 'Y' ? 87 : 91;
    let refCounts = {};
    state.players[c].pieceIdx.forEach((pIdx, i) => {
      let ref = pIdx === -1 ? baseStart - i : piecePath[c][pIdx];
      refCounts[ref] = (refCounts[ref] || 0) + 1;
    });
    state.players[c].pieceRef = Object.entries(refCounts).map(([ref, count]) => [Number(ref), count]);
  });

  if (state.meta.status !== "FINISHED" && !nextTurnBonus) {
    state.move.turn = getNextTurn(color, state.meta.onBoard);
  }

  if (state.meta.status !== "FINISHED") {
    state.move.rollAllowed   = true;
    state.move.moveAllowed   = false;
    state.move.moveCount     = 0;
    state.move.ticks         = 0;
    state.move.turnStartedAt = Date.now();
  }

  return { moved: true, nextTurnBonus, cutInfo, steps, targetPathIdx, updatedPlayers, pieceIdx, fromRef };
};

// ─────────────────────────────────────────────────────────────────────────────
// ABANDON PENALTY (Rage-Quit/AFK Fix)
// ─────────────────────────────────────────────────────────────────────────────
const recordAbandonLoss = async (username, gameId, gameType, opponentsList) => {
  try {
    if (!username) return;
    const user = await User.findOne({ username });
    if (!user) return;

    user.stats.xp += 25; 
    user.stats.totalMatches += 1;
    user.stats.losses += 1;

    user.stats.winRate = user.stats.totalMatches > 0 
      ? ((user.stats.wins / user.stats.totalMatches) * 100).toFixed(1) + '%' 
      : "0%";

    const opponentString = opponentsList.length > 0 ? opponentsList.join(", ") : "AI/Offline";

    user.stats.matchHistory.push({ 
      gameId, 
      date: new Date(), 
      result: "0", // 🐛 FIX: 0 indicates "Abandoned/DNF"
      opponent: opponentString, 
      gameType 
    });
    
    if (user.stats.matchHistory.length > 50) {
        user.stats.matchHistory.shift();
    }

    await user.save();
    console.log(`[SCORE] 🚫 Abandon penalty (Position 0) applied to ${username}`);
  } catch (err) {
    console.error("❌ [SCORE] Failed to apply abandon penalty:", err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// TIMER MANAGEMENT & AUTO-MOVE (2-Step Async Lock Pattern)
// ─────────────────────────────────────────────────────────────────────────────
const manageTurnTimer = (io, gameId, color) => {
  if (turnTimers.has(gameId)) {
    clearTimeout(turnTimers.get(gameId));
    turnTimers.delete(gameId);
  }

  const timer = setTimeout(async () => {
    let diceValue, validPieces = [];

    await acquireLock(gameId);
    try {
      const state = await redisClient.json.get(`game:${gameId}`);
      if (!state || state.meta.status !== "RUNNING" || state.move.turn !== color) return;

      if (!state.meta.timeoutCounts) state.meta.timeoutCounts = {};
      state.meta.timeoutCounts[color] = (state.meta.timeoutCounts[color] || 0) + 1;
      const skipCount = state.meta.timeoutCounts[color];

      if (skipCount >= AUTO_SKIP_LIMIT - 2 && skipCount < AUTO_SKIP_LIMIT) {
        io.to(gameId).emit("auto-skip-warning", {
          color, skipsLeft: AUTO_SKIP_LIMIT - skipCount,
          message: `WARNING: Node ${color} has been auto-skipped ${skipCount} times. ${AUTO_SKIP_LIMIT - skipCount} skips until removal.`
        });
      }

      if (skipCount >= AUTO_SKIP_LIMIT) {
        const nextTurnColor = getNextTurn(color, state.meta.onBoard);

        const leaverUsername = state.players[color]?.username;
        const gameType = state.meta.type;
        const opponents = MASTER_TURN_ORDER
          .map(c => state.players[c]?.username)
          .filter(name => name && name !== leaverUsername);

        state.meta.onBoard = state.meta.onBoard.filter(c => c !== color);
        state.meta.playerCount = state.meta.onBoard.length;
        state.players[color] = getSkeletonPlayer(color);
        delete state.meta.timeoutCounts[color];

        if (leaverUsername) {
          recordAbandonLoss(leaverUsername, gameId, gameType, opponents);
        }

        if (state.meta.onBoard.length === 0) {
          await redisClient.del(`game:${gameId}`);
          const waitingRoomId = await redisClient.get('poi_waiting_room');
          if (waitingRoomId === gameId) await redisClient.del('poi_waiting_room');
          return;
        }

        if (state.meta.onBoard.length < 2) {
          state.meta.status      = "FINISHED";
          state.move.rollAllowed = false;
          state.move.moveAllowed = false;
          state.move.turn        = null;
          
          // 🐛 FIX: Dynamically assign the next available win rank to the survivor
          const survivor = state.meta.onBoard[0];
          if (survivor && state.players[survivor].winPosn === 0) {
            state.meta.winLast += 1;
            state.players[survivor].winPosn = state.meta.winLast; 
          }
        } else {
          state.move.turn          = nextTurnColor;
          state.move.rollAllowed   = true;
          state.move.moveAllowed   = false;
          state.move.moveCount     = 0;
          state.move.ticks         = 0;
          state.move.turnStartedAt = Date.now();
        }

        state.meta.syncTick = (state.meta.syncTick || 0) + 1;
        await redisClient.json.set(`game:${gameId}`, '.', state);
        await redisClient.expire(`game:${gameId}`, 7200);

        io.to(gameId).emit("player-removed-afk", {
          color, message: `Node ${color} removed: exceeded auto-skip limit.`, newState: state, syncArray: [state.meta.syncTick - 1, state.meta.syncTick]
        });

        if (state.meta.status === "FINISHED") {
          await flushScoresToProfiles(gameId, state); 
        } else {
          manageTurnTimer(io, gameId, state.move.turn);
        }
        return;
      }

      diceValue = Math.floor(Math.random() * 6) + 1;
      state.move.moveCount   = diceValue;
      state.move.rollAllowed = false;
      state.move.timeOut     = true;
      state.move.moving      = true; 

      validPieces = state.players[color].pieceIdx
        .map((idx, i) => ({ idx, i }))
        .filter(({ idx }) => (idx === -1 && diceValue === 6) || (idx !== -1 && idx + diceValue <= 56));

      state.move.moveAllowed = validPieces.length > 0;
      state.meta.syncTick = (state.meta.syncTick || 0) + 1;

      await redisClient.json.set(`game:${gameId}`, '.', state);
      await redisClient.expire(`game:${gameId}`, 7200);

      io.to(gameId).emit("dice-rolled", {
        value: diceValue,
        moveUpdates: state.move,
        syncArray: [state.meta.syncTick - 1, state.meta.syncTick],
        autoMove: true
      });
    } catch (err) {
      console.error("❌ [AUTO-SKIP-PRE] Error:", err);
      return;
    } finally {
      releaseLock(gameId); 
    }

    setTimeout(async () => {
      await acquireLock(gameId);
      try {
        const delayedState = await redisClient.json.get(`game:${gameId}`);
        if (!delayedState || delayedState.meta.status !== "RUNNING" || delayedState.move.turn !== color) return;

        delayedState.move.timeOut = false;
        delayedState.move.moving = false;

        if (validPieces.length === 0) {
          delayedState.move.turn          = getNextTurn(color, delayedState.meta.onBoard);
          delayedState.move.rollAllowed   = true;
          delayedState.move.moveAllowed   = false;
          delayedState.move.moveCount     = 0;
          delayedState.move.turnStartedAt = Date.now();
          delayedState.meta.syncTick      = (delayedState.meta.syncTick || 0) + 1;

          await redisClient.json.set(`game:${gameId}`, '.', delayedState);
          io.to(gameId).emit("turn-timeout-update", { moveUpdates: delayedState.move, syncArray: [delayedState.meta.syncTick - 1, delayedState.meta.syncTick] });
          manageTurnTimer(io, gameId, delayedState.move.turn);
        } else {
          let chosen = validPieces.find(p => p.idx !== -1) || validPieces[0];
          const result = applyPieceMove(delayedState, color, chosen.i, diceValue);

          delayedState.meta.syncTick = (delayedState.meta.syncTick || 0) + 1;
          await redisClient.json.set(`game:${gameId}`, '.', delayedState);

          if (result.moved) {
            io.to(gameId).emit("piece-moved", {
              animation: { color, pieceIdx: result.pieceIdx, fromRef: result.fromRef, steps: result.steps, cutInfo: result.cutInfo || null, autoMove: true },
              updates: { move: delayedState.move, metaUpdates: { status: delayedState.meta.status, winLast: delayedState.meta.winLast }, playerUpdates: result.updatedPlayers || { [color]: delayedState.players[color] } },
              syncArray: [delayedState.meta.syncTick - 1, delayedState.meta.syncTick]
            });
          }

          if (delayedState.meta.status === "FINISHED") {
            await flushScoresToProfiles(gameId, delayedState); 
          } else {
            manageTurnTimer(io, gameId, delayedState.move.turn);
          }
        }
      } catch (err) {
        console.error("❌ [AUTO-SKIP-POST] Error:", err);
      } finally {
        releaseLock(gameId);
      }
    }, 2000);
  }, 30000);

  turnTimers.set(gameId, timer);
};

// ─────────────────────────────────────────────────────────────────────────────
// SCORE DB FLUSH (Optimized Bulk Operations)
// ─────────────────────────────────────────────────────────────────────────────
const flushScoresToProfiles = async (gameId, state) => {
  try {
    if (!state) return;
    
    const gameType = state.meta.type;

    const scores = {};
    for (const color of MASTER_TURN_ORDER) {
      const p = state.players[color];
      if (!p || !p.username) continue; 
      
      scores[p.username] = {
        color, username: p.username, winPosn: p.winPosn, winCount: p.winCount,
        gameId, status: state.meta.status
      };
    }

    const allUsernames = Object.keys(scores);
    if (allUsernames.length === 0) return;

    const users = await User.find({ username: { $in: allUsernames } });
    const bulkOps = [];

    for (const user of users) {
      const entry = scores[user.username];
      
      // 🐛 FIX: Dynamic XP scaling based on exact finishing position
      let xpGain = 200;
      if (entry.winPosn === 1) xpGain = 750;
      else if (entry.winPosn === 2) xpGain = 500;
      else if (entry.winPosn === 3) xpGain = 300;

      user.stats.xp += xpGain;
      user.stats.totalMatches += 1;
      
      if (entry.winPosn === 1) user.stats.wins += 1;
      else user.stats.losses += 1;

      while (user.stats.xp >= user.stats.nextLevelXp) {
          user.stats.level += 1;
          user.stats.xp -= user.stats.nextLevelXp;
          user.stats.nextLevelXp = Math.floor(user.stats.nextLevelXp * 1.6);
      }

      user.stats.winRate = user.stats.totalMatches > 0 
          ? ((user.stats.wins / user.stats.totalMatches) * 100).toFixed(1) + '%' 
          : "0%";

      const opponentsList = allUsernames.filter(name => name !== user.username);
      const opponentString = opponentsList.length > 0 ? opponentsList.join(", ") : "AI/Offline";

      // 🐛 FIX: Save the actual position (1, 2, 3, 4) as a string
      user.stats.matchHistory.push({ 
          gameId, 
          date: new Date(), 
          result: entry.winPosn.toString(), // e.g., "1", "2", "3"
          opponent: opponentString, 
          gameType 
      });
      
      if (user.stats.matchHistory.length > 50) {
          user.stats.matchHistory.shift();
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: user._id },
          update: { $set: { stats: user.stats } }
        }
      });
    }

    if (bulkOps.length > 0) {
      await User.bulkWrite(bulkOps);
    }

    console.log(`[SCORE] ✅ Final scores calculated and flushed to profiles for game ${gameId}`);
  } catch (err) {
    console.error("❌ [SCORE] Failed to flush scores to profiles:", err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTED CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────
export const handlePofInit = async (io, socket) => {
  const gameId    = socket.player.gameId;
  const color     = socket.player.color;
  const boardSize = socket.player.size;
  const username  = socket.player.username;

  await acquireLock(gameId);
  try {
    socket.gameId       = gameId;
    socket.playerColor  = color;
    socket.join(gameId);
    cancelDisconnectTimer(socket, gameId, color);

    const curCount = (await io.in(gameId).fetchSockets()).length;
    let state = await redisClient.json.get(`game:${gameId}`);

    if (!state) {
      state = {
        meta: {
          gameId, status: "LOADED", type: "pof", gameStartedAt: [Date.now()], winLast: 0,
          playerCount: 0, targetPlayerCount: boardSize, onBoard: [], syncTick: 0, timeoutCounts: {}
        },
        move: {
          playerIdx: 0, turn: color, rollAllowed: true, moveCount: 0, ticks: 0,
          moveAllowed: false, moving: false, timeOut: false, turnStartedAt: Date.now()
        },
        players: {
          R: getSkeletonPlayer('R'), B: getSkeletonPlayer('B'),
          Y: getSkeletonPlayer('Y'), G: getSkeletonPlayer('G')
        }
      };
    }

    if (!state.meta.targetPlayerCount) state.meta.targetPlayerCount = boardSize;
    if (!state.meta.timeoutCounts) state.meta.timeoutCounts = {};

    const normalizeSequence = (arr) => MASTER_TURN_ORDER.filter(c => new Set(arr).has(c));

    if (!state.meta.onBoard.includes(color)) {
      state.meta.onBoard = normalizeSequence([...state.meta.onBoard, color]);
    }
    state.meta.playerCount = state.meta.onBoard.length;

    state.players[color].socketId = socket.id;
    state.players[color].username   = username;
    state.players[color].profile  = socket.player.profile || "/defaultProfile.png";
    state.players[color].online   = true;

    if (state.meta.onBoard.length === boardSize) state.meta.status = "RUNNING";

    state.meta.syncTick = (state.meta.syncTick || 0) + 1;
    await redisClient.json.set(`game:${gameId}`, '.', state);

    socket.to(gameId).emit('add-player', {
      color, curCount, username, boardSize, syncArray: [state.meta.syncTick - 1, state.meta.syncTick]
    });

    if (state.meta.status === "RUNNING") {
      setTimeout(() => {
        io.to(gameId).emit("initiate-game", { state });
        manageTurnTimer(io, gameId, state.move.turn);
      }, 1000);
    }
  } catch (err) {
    console.error("❌ [POF INIT] Error:", err);
  } finally {
    releaseLock(gameId);
  }
};

export const handleJoinGame = async (io, socket, { type }) => {
  if (socket.handshake.auth?.gameType === "pof") return;

  let gameId = null;

  try {
    const playerInfo = socket.player || {};
    gameId = playerInfo.gameId || socket.handshake.auth?.gameId || null;
    const requestedColor = playerInfo.color || null;

    if (!gameId && type === "poi") {
      await acquireLock('__matchmaking__');
      try {
        let waitingRoomId = await redisClient.get('poi_waiting_room');
        if (waitingRoomId) {
          const waitingState = await redisClient.json.get(`game:${waitingRoomId}`);
          if (waitingState && waitingState.meta.status === "WAITING" && waitingState.meta.playerCount < 4) {
            gameId = waitingRoomId;
          } else {
            gameId = generateShortId();
            await redisClient.set('poi_waiting_room', gameId);
          }
        } else {
          gameId = generateShortId();
          await redisClient.set('poi_waiting_room', gameId);
        }
      } catch (redisErr) {
        console.error("Redis Matchmaking Error:", redisErr);
        gameId = generateShortId();
      } finally {
        releaseLock('__matchmaking__');
      }
    }

    if (!gameId) return socket.emit("error", "Invalid session data.");

    await acquireLock(gameId);
    try {
      let state = await redisClient.json.get(`game:${gameId}`);

      if (!state) {
        state = {
          meta: {
            gameId, status: "WAITING", type, gameStartedAt: [Date.now()], winLast: 0,
            playerCount: 0, targetPlayerCount: 4, onBoard: [], syncTick: 0, timeoutCounts: {}
          },
          move: {
            playerIdx: 0, turn: requestedColor || "R", rollAllowed: true, moveCount: 0, ticks: 0,
            moveAllowed: false, moving: false, timeOut: false, turnStartedAt: Date.now()
          },
          players: {
            R: getSkeletonPlayer('R'), B: getSkeletonPlayer('B'),
            Y: getSkeletonPlayer('Y'), G: getSkeletonPlayer('G')
          }
        };
      }

      if (!state.meta.timeoutCounts) state.meta.timeoutCounts = {};

      let assignedColor = null;
      for (const c of ["R", "B", "Y", "G"]) {
        if (playerInfo.username && state.players[c].username === playerInfo.username) {
          assignedColor = c;
          break;
        }
      }

      let isGameStartingNow = false;

      if (!assignedColor) {
        if (state.meta.status === "FINISHED" || (state.meta.status === "RUNNING" && type !== "poi")) {
          return socket.emit("error", "Game has already started or finished.");
        }

        const availableColors = ["R", "B", "Y", "G"].filter(c => !state.meta.onBoard.includes(c));
        if (availableColors.length === 0) return socket.emit("error", "Lobby is full.");

        assignedColor = type === "poi"
          ? availableColors[Math.floor(Math.random() * availableColors.length)]
          : (availableColors.includes(requestedColor) ? requestedColor : availableColors[0]);

        state.players[assignedColor] = {
          ...state.players[assignedColor],
          socketId: socket.id, name: playerInfo.username, username: playerInfo.username,
          profile: playerInfo.profile || "", online: true,
        };
        state.meta.onBoard.push(assignedColor);
        state.meta.onBoard.sort((a, b) => MASTER_TURN_ORDER.indexOf(a) - MASTER_TURN_ORDER.indexOf(b));
        state.meta.playerCount = state.meta.onBoard.length;

        if (state.meta.playerCount === 1) state.move.turn = assignedColor;

        if (state.meta.playerCount >= 2 && state.meta.status !== "RUNNING" && (type === "poi" || type === "pof")) {
          if (type === "poi" && state.meta.playerCount < 4) {
            const waitKey = `__wait__${gameId}`;
            if (turnTimers.has(waitKey)) {
              clearTimeout(turnTimers.get(waitKey));
              turnTimers.delete(waitKey);
            }
            const waitTimer = setTimeout(async () => {
              await acquireLock(gameId);
              try {
                const latestState = await redisClient.json.get(`game:${gameId}`);
                if (!latestState || latestState.meta.status !== "WAITING") return;
                latestState.meta.status = "RUNNING";
                latestState.meta.syncTick = (latestState.meta.syncTick || 0) + 1;
                await redisClient.json.set(`game:${gameId}`, '.', latestState);
                await redisClient.expire(`game:${gameId}`, 7200);
                io.to(gameId).emit("initiate-game", { state: latestState });
                manageTurnTimer(io, gameId, latestState.move.turn);
                const currentWaitingRoom = await redisClient.get('poi_waiting_room');
                if (currentWaitingRoom === gameId) await redisClient.del('poi_waiting_room');
              } catch (e) {
                console.error("❌ [WAIT-START] Error:", e);
              } finally {
                releaseLock(gameId);
                turnTimers.delete(waitKey);
              }
            }, 10000);
            turnTimers.set(waitKey, waitTimer);
            state.meta.status = "WAITING";
          } else {
            state.meta.status = "RUNNING";
            isGameStartingNow = true;
            if (type === "poi") {
              const currentWaitingRoom = await redisClient.get('poi_waiting_room');
              if (currentWaitingRoom === gameId) await redisClient.del('poi_waiting_room');
            }
          }
        }
      } else {
        state.players[assignedColor].socketId = socket.id;
        state.players[assignedColor].online   = true;
        if (!state.meta.onBoard.includes(assignedColor)) {
          state.meta.onBoard.push(assignedColor);
          state.meta.onBoard.sort((a, b) => MASTER_TURN_ORDER.indexOf(a) - MASTER_TURN_ORDER.indexOf(b));
          state.meta.playerCount = state.meta.onBoard.length;
        }
      }

      socket.gameId      = gameId;
      socket.playerColor = assignedColor;
      socket.username      = playerInfo.username;

      socket.join(gameId);
      cancelDisconnectTimer(socket, gameId, assignedColor);

      state.meta.syncTick = (state.meta.syncTick || 0) + 1;
      await redisClient.json.set(`game:${gameId}`, '.', state);
      await redisClient.expire(`game:${gameId}`, 7200);

      socket.emit("join-success", { assignedColor, newState: state });
      io.to(gameId).emit("player-joined", {
        message:   `Pilot ${playerInfo.username} established uplink to Node ${assignedColor}.`,
        newState:  state,
        syncArray: [state.meta.syncTick - 1, state.meta.syncTick]
      });

      if (isGameStartingNow) {
        manageTurnTimer(io, gameId, state.move.turn);
      }
    } finally {
      releaseLock(gameId);
    }
  } catch (err) {
    console.error("❌ [JOIN] Error:", err);
  }
};

export const handleSyncState = async (socket, { gameId, color }) => {
  try {
    if (socket.gameId !== gameId) return;
    if (color !== null && color !== undefined && socket.playerColor !== color) return;
    const state = await redisClient.json.get(`game:${gameId}`);
    if (state) {
      socket.join(gameId);
      socket.emit("state-synced", state);
    }
  } catch (err) {
    console.error("❌ [SYNC] Error:", err);
  }
};

export const handleRollDice = async (io, socket, payload) => {
  const gameId = payload.gameId || socket.gameId;
  const color = payload.color || socket.playerColor;

  if (socket.playerColor !== color) return;

  let diceValue, validPieces, needSkip = false;

  await acquireLock(gameId);
  try {
    const state = await redisClient.json.get(`game:${gameId}`);
    
    if (!state || state.meta.status === "FINISHED" || state.move.turn !== color || state.move.moving || !state.move.rollAllowed) return;

    if (!state.meta.timeoutCounts) state.meta.timeoutCounts = {};
    state.meta.timeoutCounts[color] = 0;

    diceValue = Math.floor(Math.random() * 6) + 1;
    state.move.moveCount   = diceValue;
    state.move.rollAllowed = false;
    state.move.ticks      += 1;
    state.move.timeOut     = false;

    validPieces = state.players[color].pieceIdx.some(idx =>
      (idx === -1 && diceValue === 6) || (idx !== -1 && idx + diceValue <= 56)
    );

    if (!validPieces) {
      state.move.moveAllowed = false;
      needSkip = true;
      state.move.timeOut = true; 
      state.move.moving = true;
    } else {
      state.move.moveAllowed = true;
    }

    state.move.turnStartedAt = Date.now();
    state.meta.syncTick = (state.meta.syncTick || 0) + 1;

    await redisClient.json.set(`game:${gameId}`, '.', state);
    await redisClient.expire(`game:${gameId}`, 7200);

    io.to(gameId).emit("dice-rolled", {
      value: diceValue,
      moveUpdates: state.move,
      syncArray: [state.meta.syncTick - 1, state.meta.syncTick]
    });

    if (!needSkip) {
      manageTurnTimer(io, gameId, state.move.turn);
    }
  } catch (err) {
    console.error("❌ [ROLL] Error:", err);
  } finally {
    releaseLock(gameId);
  }

  if (needSkip) {
    setTimeout(async () => {
      await acquireLock(gameId);
      try {
        const delayedState = await redisClient.json.get(`game:${gameId}`);
        if (!delayedState || delayedState.meta.status === "FINISHED" || delayedState.move.turn !== color) return;

        delayedState.move.timeOut       = false;
        delayedState.move.moving        = false;
        delayedState.move.turn          = getNextTurn(color, delayedState.meta.onBoard);
        delayedState.move.rollAllowed   = true;
        delayedState.move.moveAllowed   = false;
        delayedState.move.moveCount     = 0;
        delayedState.move.ticks         = 0;
        delayedState.move.turnStartedAt = Date.now();
        delayedState.meta.syncTick      = (delayedState.meta.syncTick || 0) + 1;

        await redisClient.json.set(`game:${gameId}`, '.', delayedState);
        io.to(gameId).emit("turn-timeout-update", {
          moveUpdates: delayedState.move,
          syncArray: [delayedState.meta.syncTick - 1, delayedState.meta.syncTick]
        });
        manageTurnTimer(io, gameId, delayedState.move.turn);
      } catch (err) {
        console.error("❌ [ROLL-SKIP] Error:", err);
      } finally {
        releaseLock(gameId);
      }
    }, 2000);
  }
};

export const handleMovePiece = async (io, socket, payload) => {
  const gameId = payload.gameId || socket.gameId;
  const color = payload.color || socket.playerColor;
  const pieceIdx = payload.pieceIdx;
  const refNum = payload.refNum;

  if (socket.playerColor !== color) return;

  await acquireLock(gameId);
  try {
    const state = await redisClient.json.get(`game:${gameId}`);
    
    if (!state || state.meta.status === "FINISHED" || state.move.turn !== color || !state.move.moveAllowed || state.move.timeOut || state.move.moving) return;

    if (!state.meta.timeoutCounts) state.meta.timeoutCounts = {};
    state.meta.timeoutCounts[color] = 0;

    const moveCount = state.move.moveCount;
    const result = applyPieceMove(state, color, pieceIdx, moveCount);

    if (!result.moved) return; 

    if (state.meta.status === "FINISHED") {
      if (turnTimers.has(gameId)) {
        clearTimeout(turnTimers.get(gameId));
        turnTimers.delete(gameId);
      }
    }

    state.meta.syncTick = (state.meta.syncTick || 0) + 1;
    await redisClient.json.set(`game:${gameId}`, '.', state);
    await redisClient.expire(`game:${gameId}`, 7200);

    io.to(gameId).emit("piece-moved", {
      animation: { color, pieceIdx: result.pieceIdx, fromRef: refNum, steps: result.steps, cutInfo: result.cutInfo || null },
      updates: { move: state.move, metaUpdates: { status: state.meta.status, winLast: state.meta.winLast }, playerUpdates: result.updatedPlayers || { [color]: state.players[color] } },
      syncArray: [state.meta.syncTick - 1, state.meta.syncTick]
    });

    if (state.meta.status === "FINISHED") {
      await flushScoresToProfiles(gameId, state); 
    } else {
      manageTurnTimer(io, gameId, state.move.turn);
    }
  } catch (err) {
    console.error("❌ [MOVE] Error:", err);
  } finally {
    releaseLock(gameId);
  }
};

export const handleTurnTimeout = async (io, socket, payload) => {
  const gameId = payload.gameId || socket.gameId;
  const color = payload.color || socket.playerColor;

  if (socket.playerColor !== color) return;

  await acquireLock(gameId);
  try {
    const state = await redisClient.json.get(`game:${gameId}`);
    if (!state || state.move.turn !== color || state.meta.status === "FINISHED") return;

    state.move.turn          = getNextTurn(color, state.meta.onBoard);
    state.move.rollAllowed   = true;
    state.move.moveAllowed   = false;
    state.move.moveCount     = 0;
    state.move.ticks         = 0;
    state.move.timeOut       = true;
    state.move.turnStartedAt = Date.now();

    state.meta.syncTick = (state.meta.syncTick || 0) + 1;
    await redisClient.json.set(`game:${gameId}`, '.', state);
    await redisClient.expire(`game:${gameId}`, 7200);

    io.to(gameId).emit("turn-timeout-update", {
      moveUpdates: state.move,
      syncArray: [state.meta.syncTick - 1, state.meta.syncTick]
    });

    manageTurnTimer(io, gameId, state.move.turn);
  } catch (err) {
    console.error("❌ [MANUAL-TIMEOUT] Error:", err);
  } finally {
    releaseLock(gameId);
  }
};

export const handleDisconnect = (io, socket, reason) => {
  console.log(`[NETWORK] 🔴 Socket Disconnected: ${socket.id} | Reason: ${reason}`);

  const gameId = socket.gameId || socket.player?.gameId;
  const color  = socket.playerColor || socket.player?.color;
  if (!gameId || !color) return;

  io.to(gameId).emit("player-offline-warning", { message: `WARNING: player ${color} signal lost.`, color });

  const timerKey = `${gameId}:${color}`;

  const purgeTimer = setTimeout(async () => {
    await acquireLock(gameId);
    try {
      const state = await redisClient.json.get(`game:${gameId}`);
      if (!state) return;

      if (state.meta.status === "FINISHED") {
        return; 
      } 

      const boardIndex = state.meta.onBoard.indexOf(color);
      if (boardIndex === -1) return;

      let nextTurn = null;
      if (state.move.turn === color && state.meta.status !== "FINISHED" && state.meta.onBoard.length >= 2) {
        nextTurn = getNextTurn(color, state.meta.onBoard);
      }

      // 🐛 FIX: Catch the leaver's info before wiping them
      const leaverUsername = state.players[color]?.username;
      const gameType = state.meta.type;
      const opponents = MASTER_TURN_ORDER
        .map(c => state.players[c]?.username)
        .filter(name => name && name !== leaverUsername);

      state.meta.onBoard.splice(boardIndex, 1);
      state.meta.playerCount = state.meta.onBoard.length;
      state.players[color]   = getSkeletonPlayer(color);

      // 🐛 FIX: Apply the loss penalty immediately
      if (leaverUsername) {
        recordAbandonLoss(leaverUsername, gameId, gameType, opponents);
      }

      if (state.meta.onBoard.length === 0) {
        await redisClient.del(`game:${gameId}`);
        const waitingRoomId = await redisClient.get('poi_waiting_room');
        if (waitingRoomId === gameId) await redisClient.del('poi_waiting_room');
        if (turnTimers.has(gameId)) { clearTimeout(turnTimers.get(gameId)); turnTimers.delete(gameId); }
        const waitKey = `__wait__${gameId}`;
        if (turnTimers.has(waitKey)) { clearTimeout(turnTimers.get(waitKey)); turnTimers.delete(waitKey); }
        console.log(`[CLEANUP] Memory core purged empty grid: ${gameId}`);
        return;
      }

      if (state.meta.status === "RUNNING" && state.meta.onBoard.length < 2) {
        state.meta.status      = "FINISHED";
        state.move.rollAllowed = false;
        state.move.moveAllowed = false;
        state.move.turn        = null;
        
        // 🐛 FIX: Dynamically assign the next available win rank to the survivor
        const survivor = state.meta.onBoard[0];
        if (survivor && state.players[survivor].winPosn === 0) {
          state.meta.winLast += 1;
          state.players[survivor].winPosn = state.meta.winLast; 
        }
        if (turnTimers.has(gameId)) { clearTimeout(turnTimers.get(gameId)); turnTimers.delete(gameId); }
      }

      if (nextTurn && state.meta.status !== "FINISHED") {
        state.move.turn          = nextTurn;
        state.move.rollAllowed   = true;
        state.move.moveAllowed   = false;
        state.move.moveCount     = 0;
        state.move.ticks         = 0;
        state.move.turnStartedAt = Date.now();
        manageTurnTimer(io, gameId, state.move.turn);
      }

      state.meta.syncTick = (state.meta.syncTick || 0) + 1;
      await redisClient.json.set(`game:${gameId}`, '.', state);
      await redisClient.expire(`game:${gameId}`, 7200);

      io.to(gameId).emit("player-left", {
        message:   `CRITICAL: Node ${color} purged from memory core.`,
        newState:  state,
        syncArray: [state.meta.syncTick - 1, state.meta.syncTick]
      });

      if (state.meta.status === "FINISHED") {
        await flushScoresToProfiles(gameId, state); 
      }
    } catch (err) {
      console.error("❌ [PURGE] Error:", err);
    } finally {
      disconnectTimers.delete(timerKey);
      releaseLock(gameId);
    }
  }, 10000);

  disconnectTimers.set(timerKey, purgeTimer);
};