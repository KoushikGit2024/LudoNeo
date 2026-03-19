import { toast } from "react-toastify";
import useGameStore from "./useGameStore";
import piecePath from '../contexts/PiecePath.js'; 
import api from "@/api/axiosConfig";
import { updateUserInfo } from "./userActions";

const initialState = {
  meta: { gameId: "", status: "WAITING", type: "offline", gameStartedAt: [], winLast: 0, playerCount: 4, onBoard: new Set(['R', 'B', 'Y', 'G']), syncTick: 0 },
  move: { playerIdx: 0, turn: 'R', rollAllowed: true, moveCount: 0, ticks: 0, moveAllowed: false, moving: false, timeOut: false },
  players: {
    R: { socketId: '', name: "", username: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[79, 1], [78, 1], [77, 1], [76, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#FF3131", difficulty:null },
    B: { socketId: '', name: "", username: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[83, 1], [82, 1], [81, 1], [80, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#00D4FF", difficulty:null },
    Y: { socketId: '', name: "", username: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[87, 1], [86, 1], [85, 1], [84, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#ffc400", difficulty:null },
    G: { socketId: '', name: "", username: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[91, 1], [90, 1], [89, 1], [88, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#39FF14", difficulty:null },
  },
};

function shortId(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".toLowerCase();
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function getSkeletonPlayer(colorKey) {
  const startIdx = { R: 79, B: 83, Y: 87, G: 91 }[colorKey];
  const hex = { R: "#FF3131", B: "#00D4FF", Y: "#ffc400", G: "#39FF14" }[colorKey];
  return {
    socketId: '', name: "", username: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1],
    pieceRef: new Map([[startIdx, 1], [startIdx - 1, 1], [startIdx - 2, 1], [startIdx - 3, 1]]),
    homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: hex, difficulty:null
  };
}

function loadGameLogic(state, dbState) {
  const hydratedPlayers = {};
  const colors = ["R", "B", "Y", "G"];
  const startIdxMap = { R: 79, B: 83, Y: 87, G: 91 };
  const onBoard = new Set(dbState.meta.onBoard);
  const gameStartedAt=[...dbState.meta.gameStartedAt,Date.now()];
  colors.forEach(c => {
    if (dbState.players[c] && onBoard.has(c)) {
      const pData = dbState.players[c];
      const pieceRefMap = new Map();
      if (pData.pieceIdx) {
        pData.pieceIdx.forEach((pos, i) => {
          let ref;
          if (pos === -1) ref = startIdxMap[c] - i; 
          else if (pos >= 0 && pos <= 56) ref = piecePath[c][pos];  
          if (ref !== undefined) pieceRefMap.set(ref, (pieceRefMap.get(ref) || 0) + 1);
        });
      }
      hydratedPlayers[c] = { ...state.players[c], ...pData, pieceRef: pieceRefMap };
    } else {
      hydratedPlayers[c] = getSkeletonPlayer(c);
    }
  });

  return { ...state, meta: { ...state.meta, ...dbState.meta, onBoard: new Set(dbState.meta.onBoard), gameStartedAt:gameStartedAt }, move: { ...state.move, ...dbState.move }, players: { ...state.players, ...hydratedPlayers } };
}

function initiateOfflineGameLogic(state, gameObj) {
  if (state.meta.status !== "WAITING") return state;
  const genId = shortId(16);
  if (!["offline", "bot", "pof", "poi"].includes(gameObj.type)) return state;
  let userProfile;
  const players = {};
  const colors = ["#FF3131", "#00D4FF", "#ffc400", "#00FF14"];
  const masterOrder = ["R", "B", "Y", "G"];
  const onBoardPlayers = new Set(masterOrder.filter((el) => gameObj.players.includes(el)));
  gameObj.players=[...onBoardPlayers];

  masterOrder.forEach((el, idx) => {
    let startIdx = { R: 79, B: 83, Y: 87, G: 91 }[el];
    const playerIndexInGameObj = onBoardPlayers.has(el);
    if (playerIndexInGameObj) {
      players[el] = {
        ...state.players[el], name: gameObj.names[el], username: "", profile: (gameObj.type==="bot" && gameObj.botDifficulties[el]===null)?gameObj.avatar:"/defaultProfile.png",
        pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[startIdx, 1], [startIdx - 1, 1], [startIdx - 2, 1], [startIdx - 3, 1]]),
        homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: colors[idx],
        ...(gameObj.type === "bot") && { difficulty: gameObj.botDifficulties[el] }
      };
    } else {
      players[el] = getSkeletonPlayer(el);
    }
  });

  return {
    ...state,
    move: { ...state.move, color: gameObj.players[0], playerIdx: 0, turn: gameObj.players[0], rollAllowed: true, moveCount: 0, ticks: 0, version: 0, moveAllowed: false, moving: false, timeOut: false },
    meta: { ...state.meta, playerCount: gameObj.players.length, onBoard: onBoardPlayers, gameId: genId, status: "RUNNING", currentTurn: onBoardPlayers[0], gameStartedAt: [...state.meta.gameStartedAt, Date.now()], type: gameObj.type, color: "R", winLast: 0 },
    players: { ...state.players, ...players },
  };
}

function updateMoveCountLogic(state, moveCount = 0) {
  if (moveCount === 0) return state;
  return { ...state, move: { ...state.move, moveCount, moveAllowed: true, rollAllowed: false, ticks: state.move.ticks + 1 } };
}

function updatePieceStateLogic(state, curColor, pieceIdx, pieceRef, deltaRef = 0, deltaIdx = 0) {
  const player = state.players[curColor];
  const pieceIdxArr = [...player.pieceIdx];
  const pieceRefMap = new Map(player.pieceRef);
  let homeCount = player.homeCount, outCount = player.outCount, winCount = player.winCount, winPosn = player.winPosn;
  let nextStatus = state.meta.status, newGlobalWinLast = state.meta.winLast;

  if (pieceIdx >= 0 && deltaIdx === 1) {
    const nextIdx = pieceIdxArr[pieceIdx] + deltaIdx;
    if (pieceIdxArr[pieceIdx] === -1 && nextIdx === 0) { homeCount -= 1; outCount += 1; }
    if (nextIdx === 56) {
      outCount -= 1; winCount += 1;
      if (winCount === 4 && winPosn === 0) { newGlobalWinLast += 1; winPosn = newGlobalWinLast; }
      if (newGlobalWinLast >= state.meta.playerCount - 1 && state.meta.playerCount > 1) nextStatus = "FINISHED";
    }
    pieceIdxArr[pieceIdx] = nextIdx;
  } else if (pieceIdx >= 0 && deltaIdx === -2) {
    outCount -= 1; homeCount += 1; pieceIdxArr[pieceIdx] = -1;
  }

  if (pieceRef !== null && deltaRef !== 0) {
    const nextCount = (pieceRefMap.get(pieceRef) ?? 0) + deltaRef;
    if (nextCount <= 0) pieceRefMap.delete(pieceRef); else pieceRefMap.set(pieceRef, nextCount);
  }

  return { ...state, meta: { ...state.meta, winLast: newGlobalWinLast, status: nextStatus }, players: { ...state.players, [curColor]: { ...player, homeCount, outCount, winCount, winPosn, pieceIdx: pieceIdxArr, pieceRef: pieceRefMap } } };
}

function transferTurnLogic(state, turnCase = -1) {
  if (turnCase === -1) return state;
  const Obj = { move: { ...state.move }, meta: state.meta };
  const onBoardArray = Array.from(Obj.meta.onBoard);

  if (turnCase === 0) {
    Obj.move = { ...Obj.move, playerIdx: Obj.move.playerIdx, turn: onBoardArray[Obj.move.playerIdx], rollAllowed: true, moveCount: 0, ticks: Obj.move.ticks + 1, moveAllowed: false, moving: false, timeOut: false };
  } else if (turnCase === 1) {
    Obj.move.playerIdx = (Obj.move.playerIdx + 1) % Obj.meta.playerCount;
    Obj.move = { ...Obj.move, playerIdx: Obj.move.playerIdx, turn: onBoardArray[Obj.move.playerIdx], rollAllowed: true, moveCount: 0, ticks: 0, moveAllowed: false, moving: false, timeOut: false };
  } else if (turnCase === 2) {
    Obj.move = { ...Obj.move, playerIdx: Obj.move.playerIdx, turn: onBoardArray[Obj.move.playerIdx], rollAllowed: true, moveCount: 0, ticks: 0, moveAllowed: false, moving: false, timeOut: false };
  }
  return { ...state, move: Obj.move };
}

function updateTimeOutLogic(state, newState) { return { ...state, move: { ...state.move, timeOut: newState } }; }
function setMovingLogic(state, val) { return { ...state, move: { ...state.move, moving: val } }; }
function endGameLogic(state) {
  if (state.meta.status === "FINISHED" || state.meta.status === "WAITING") return state;
  return { ...state, meta: { ...state.meta, status: "FINISHED" }, move: { ...state.move, rollAllowed: false, moveAllowed: false, moving: false, turn: null } };
}

// ==============================================
// INTERNAL AUTOMATIC STAT PROCESSOR
// ==============================================
const recordMatchStats = async (state) => {
    // Only process local game types here; online variants should be handled by socket events
    if (state.meta.type !== "offline" && state.meta.type !== "bot") return;

    const userColor = state.meta.color || "R";

    const statsPayload = {
        gameId: state.meta.gameId,
        // 🐛 FIX: Now directly maps the local user's position (1, 2, 3, 4, or 0)
        result: state.players[userColor].winPosn.toString(),
        opponent: state.meta.type === 'bot' ? 'A.I. Core' : 'Local Challenger',
        gameType: state.meta.type
    };

    try {
        const statsRes = await api.post('/api/games/record-stats', statsPayload);
        if (statsRes.data.success) {
            updateUserInfo(statsRes.data.user);
            toast.success("Match statistics processed & synchronized!");
        }
    } catch (error) {
        console.error("Failed to record stats:", error);
    }
};

const gameActions = {
  initiateGame: (gameObj) => useGameStore.setState((state) => initiateOfflineGameLogic(state, gameObj), false, "initiateGame"),
  updateMoveCount: (moveCount = 0) => useGameStore.setState((state) => updateMoveCountLogic(state, moveCount), false, "updateMoveCount"),
  
  updatePieceState: (curColor, pieceIdx, pieceRef, deltaRef = 0, deltaIdx = 0) => {
    const prevState = useGameStore.getState();
    useGameStore.setState((state) => updatePieceStateLogic(state, curColor, pieceIdx, pieceRef, deltaRef, deltaIdx), false, "updatePieceState");
    
    // Automatically intercept and broadcast stat logic if a piece move triggers FINISHED state
    const newState = useGameStore.getState();
    if (prevState.meta.status !== "FINISHED" && newState.meta.status === "FINISHED") {
        recordMatchStats(newState);
    }
  },

  transferTurn: (turnCase = -1) => useGameStore.setState((state) => transferTurnLogic(state, turnCase), false, "transferTurn"),
  updateTimeOut: (newState) => useGameStore.setState((state) => updateTimeOutLogic(state, newState), false, "updateTimeOut"),
  setMoving: (val) => useGameStore.setState((state) => setMovingLogic(state, val), false, "setMoving"),
  resetStore: () => useGameStore.setState(initialState, false, "resetStore"),
  
  endGame: () => {
    const prevState = useGameStore.getState();
    useGameStore.setState((state) => endGameLogic(state), false, "endGame");
    
    if(prevState.meta.type==="offline") return;
    // Process stats if the game was ended explicitly (e.g., player surrendered)
    const newState = useGameStore.getState();
    if (prevState.meta.status !== "FINISHED" && newState.meta.status === "FINISHED") {
        recordMatchStats(newState);
    }
  },

  saveGameToDB: async (title) => {
    const state = useGameStore.getState();
    if(state.meta.status==="FINISHED") return;
    if (state.meta.type !== "offline" && state.meta.type !== "bot") return;
    
    const sanitizePlayer = (player, color) => {
      if (!state.meta.onBoard.has(color) || !player || !player.name) return getSkeletonPlayer(color);
      const sanitized = { ...player };
      if (sanitized.pieceRef instanceof Map) sanitized.pieceRef = Array.from(sanitized.pieceRef.entries());
      if (!sanitized.username || sanitized.username === "") { delete sanitized.username; delete sanitized.socketId; }
      return sanitized;
    };

    const payload = {
      meta: { gameId: state.meta.gameId, status: state.meta.status, type: state.meta.type, title, playerCount: state.meta.playerCount, onBoard: Array.from(state.meta.onBoard), winLast: state.meta.winLast, gameStartedAt: state.meta.gameStartedAt },
      move: { playerIdx: state.move.playerIdx, turn: state.move.turn, moveCount: state.move.moveCount, rollAllowed: state.move.rollAllowed, ticks: state.move.ticks, moveAllowed: state.move.moveAllowed, moving: state.move.moving, timeOut: state.move.timeOut },
      players: { R: sanitizePlayer(state.players.R, "R"), B: sanitizePlayer(state.players.B, "B"), Y: sanitizePlayer(state.players.Y, "Y"), G: sanitizePlayer(state.players.G, "G") }
    };
    try {
      await api.post('/api/games/save', payload);
      toast.success(state.meta.status === "FINISHED" ? "Match results saved!" : "Game progress saved!", { theme: "dark" });
    } catch (error) { toast.error("Failed to sync with server"); console.log(error) }
  },

  loadGameFromDB: async (gameId) => {
    try {
      const res = await api.get(`/api/games/${gameId}`);
      if (res.data.success && res.data.game) {
        useGameStore.setState((state) => loadGameLogic(state, res.data.game), false, "loadGameFromDB");
        return true; 
      }
      return false;
    } catch (error) {
      toast.error("Saved game not found");
      console.log(error)
      return false;
    }
  }
};

export default gameActions;