// Pure game logic helpers for useGameStore.
// These functions are state updaters that do not depend on React,
// so they can be imported and tested directly without causing rerenders.

import { Bounce, toast } from "react-toastify";
import useGameStore from "./useGameStore";
// Add this helper near your other logic functions
// This rebuilds the pieceRef Maps based on pieceIdx since MongoDB doesn't save Maps natively
import piecePath from '../contexts/PiecePath.js'; // Ensure you import your path logic!

function loadGameLogic(state, dbState) {
  const hydratedPlayers = {};
  const colors = ["R", "B", "Y", "G"];
  const startIdxMap = { R: 79, B: 83, Y: 87, G: 91 };

  colors.forEach(c => {
    if (dbState.players[c]) {
      const pData = dbState.players[c];
      const pieceRefMap = new Map();

      // Recalculate pieceRef from pieceIdx
      pData.pieceIdx.forEach((pos, i) => {
        let ref;
        if (pos === -1) {
          ref = startIdxMap[c] - i; // Base positions (e.g., 79, 78, 77, 76 for Red)
        } else if (pos >= 0 && pos <= 56) {
          ref = piecePath[c][pos];  // Active board position
        }
        
        if (ref !== undefined) {
          pieceRefMap.set(ref, (pieceRefMap.get(ref) || 0) + 1);
        }
      });

      hydratedPlayers[c] = {
        ...state.players[c],
        ...pData,
        pieceRef: pieceRefMap
      };
    }
  });

  return {
    ...state,
    meta: {
      ...state.meta,
      ...dbState.meta,
      onBoard: new Set(dbState.meta.onBoard) // Convert Array back to Set
    },
    move: {
      ...state.move,
      ...dbState.move
    },
    players: {
      ...state.players,
      ...hydratedPlayers
    }
  };
}

// ... your existing gameActions ...

// const gameActions = {
//   // ... Keep all existing actions ...

//   // === 1. SAVE GAME ===
  

//   // === 2. LOAD/RETRIEVE GAME ===
  
// };

// export default gameActions;

function shortId(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function initiateOfflineGameLogic(state, gameObj) {
  if (state.meta.status !== "WAITING") return state;

  const genId = shortId(16);

  // 1. Ensure type matches
  if (!["offline", "bot", "pof", "poi"].includes(gameObj.type)) {
    return state;
  }
  console.log(gameObj);
  const players = {};
  const colors = ["#FF3131", "#00D4FF", "#ffc400", "#00FF14"];
  const masterOrder = ["R", "B", "Y", "G"];

  masterOrder.forEach((el, idx) => {
    let startIdx;
    if (el === "R") startIdx = 79;
    if (el === "B") startIdx = 83;
    if (el === "Y") startIdx = 87;
    if (el === "G") startIdx = 91;

    // 2. FIXED: Find the actual index of this color in the incoming gameObj payload
    const playerIndexInGameObj = gameObj.players.indexOf(el);

    if (playerIndexInGameObj !== -1) {
      players[el] = {
        ...state.players[el],
        // Pull the name using the dynamic index, NOT the master array index
        name: gameObj.names[playerIndexInGameObj], 
        userId: "",
        profile: "/defaultProfile.png",
        pieceIdx: [-1, -1, -1, -1],
        pieceRef: new Map([
          [startIdx, 1],
          [startIdx - 1, 1],
          [startIdx - 2, 1],
          [startIdx - 3, 1],
        ]),
        homeCount: 4,
        outCount: 0,
        winCount: 0,
        winPosn: 0,
        color: colors[idx],
      };
    } else {
      players[el] = {
        ...state.players[el],
        color: colors[idx],
      };
    }
  });

  // 3. Safer way to push to array without structuredClone
  const startTime = [...state.meta.gameStartedAt, Date.now()];
  console.log({
    ...state,
    move: {
      ...state.move,
      playerIdx: 0,
      turn: gameObj.players[0], // Safe because gameObj.players is always RBYG sorted now
      rollAllowed: true,
      moveCount: 0,
      ticks: 0,
      version: 0,
      moveAllowed: false,
      moving: false,
      timeOut: false,
    },
    meta: {
      ...state.meta,
      playerCount: gameObj.players.length,
      onBoard: new Set(gameObj.players),
      gameId: genId,
      status: "RUNNING",
      currentTurn: gameObj.players[0],
      gameStartedAt: startTime,
      type: gameObj.type,
      winLast: 0,
    },
    players: {
      ...state.players,
      ...players,
    },
  })
  return {
    ...state,
    move: {
      ...state.move,
      playerIdx: 0,
      turn: gameObj.players[0], // Safe because gameObj.players is always RBYG sorted now
      rollAllowed: true,
      moveCount: 0,
      ticks: 0,
      version: 0,
      moveAllowed: false,
      moving: false,
      timeOut: false,
    },
    meta: {
      ...state.meta,
      playerCount: gameObj.players.length,
      onBoard: new Set(gameObj.players),
      gameId: genId,
      status: "RUNNING",
      currentTurn: gameObj.players[0],
      gameStartedAt: startTime,
      type: gameObj.type,
      winLast: 0,
    },
    players: {
      ...state.players,
      ...players,
    },
  };
}

function updateMoveCountLogic(state, moveCount = 0) {
  if (moveCount === 0) return state;
  return {
    ...state,
    move: {
      ...state.move,
      moveCount,
      moveAllowed: true,
      rollAllowed: false,
      ticks: state.move.ticks + 1,
    },
  };
}

function updatePieceStateLogic(
  state,
  curColor,
  pieceIdx,
  pieceRef,
  deltaRef = 0,
  deltaIdx = 0
) {
  const player = state.players[curColor];

  const pieceIdxArr = [...player.pieceIdx];
  const pieceRefMap = new Map(player.pieceRef);

  let homeCount = player.homeCount;
  let outCount = player.outCount;
  let winCount = player.winCount;
  let winPosn = player.winPosn;
  let nextStatus = state.meta.status;

  let newGlobalWinLast = state.meta.winLast;

  if (pieceIdx >= 0 && deltaIdx === 1) {
    const prevIdx = pieceIdxArr[pieceIdx];
    const nextIdx = prevIdx + deltaIdx;

    if (prevIdx === -1 && nextIdx === 0) {
      homeCount -= 1;
      outCount += 1;
    }

    if (nextIdx === 56) {
      outCount -= 1;
      winCount += 1;

      if (winCount === 4 && winPosn === 0) {
        newGlobalWinLast += 1;
        winPosn = newGlobalWinLast;
        console.log(`Player ${curColor} finished! Rank: ${winPosn}`);
      }
      
      if (newGlobalWinLast >= state.meta.playerCount - 1 && state.meta.playerCount > 1) {
        nextStatus = "FINISHED";
      }
    }

    pieceIdxArr[pieceIdx] = nextIdx;
  } else if (pieceIdx >= 0 && deltaIdx === -2) {
    outCount -= 1;
    homeCount += 1;
    pieceIdxArr[pieceIdx] = -1;
  }

  if (pieceRef !== null && deltaRef !== 0) {
    const prevCount = pieceRefMap.get(pieceRef) ?? 0;
    const nextCount = prevCount + deltaRef;

    if (nextCount <= 0) {
      pieceRefMap.delete(pieceRef);
    } else {
      pieceRefMap.set(pieceRef, nextCount);
    }
  }
  // console.log(state.meta)
  return {
    ...state,
    meta: {
      ...state.meta,
      winLast: newGlobalWinLast,
      status: nextStatus,
    },
    players: {
      ...state.players,
      [curColor]: {
        ...player,
        homeCount,
        outCount,
        winCount,
        winPosn,
        pieceIdx: pieceIdxArr,
        pieceRef: pieceRefMap,
      },
    },
  };
}

function transferTurnLogic(state, turnCase = -1) {
  // toast('Toast is on!', {
  //             position: "bottom-left",
  //             autoClose: 3000,
  //             hideProgressBar: true,
  //             closeOnClick: true,
  //             pauseOnHover: true,
  //             draggable: false,
  //             theme: "dark",
  //             transition: Bounce,
  //             })
  if (turnCase === -1) return state;

  const Obj = { move: state.move, meta: state.meta };
  let playerIdx;
  const onBoardArray = Array.from(Obj.meta.onBoard);
  let turn;

  if (turnCase === 0) {
    playerIdx = Obj.move.playerIdx;
    turn = onBoardArray[playerIdx];
    Obj.move = {
      playerIdx,
      turn,
      rollAllowed: true,
      moveCount: 0,
      ticks: Obj.move.ticks + 1,
      moveAllowed: false,
      moving: false,
      timeOut: false,
    };
  } else if (turnCase === 1) {
    playerIdx = (Obj.move.playerIdx + 1) % Obj.meta.playerCount;
    turn = onBoardArray[playerIdx];
    Obj.move = {
      playerIdx,
      turn,
      rollAllowed: true,
      moveCount: 0,
      ticks: 0,
      moveAllowed: false,
      moving: false,
      timeOut: false,
    };
  } else if (turnCase === 2) {
    playerIdx = Obj.move.playerIdx;
    turn = onBoardArray[playerIdx];
    Obj.move = {
      playerIdx,
      turn,
      rollAllowed: true,
      moveCount: 0,
      ticks: 0,
      moveAllowed: false,
      moving: false,
      timeOut: false,
    };
  }

  return {
    ...state,
    move: {
      ...Obj.move,
    },
  };
}

function updateTimeOutLogic(state, newState) {
  return {
    ...state,
    move: {
      ...state.move,
      timeOut: newState,
    },
  };
}

function setMovingLogic(state, val) {
  return {
    ...state,
    move: {
      ...state.move,
      moving: val,
    },
  };
}

const initialState = {
  meta: {
    gameId: "",
    status: "WAITING",
    type: "offline",
    gameStartedAt: [],
    winLast: 0,
    playerCount: 4,
    onBoard: new Set(['R', 'B', 'Y', 'G']),
  },
  move: {
    playerIdx: 0,
    turn: 'R',
    rollAllowed: true,
    moveCount: 0,
    ticks: 0,
    moveAllowed: false,
    moving: false,
    timeOut: false,
  },
  players: {
    R: { socketId: '', name: "", userId: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[79, 1], [78, 1], [77, 1], [76, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#FF3131" },
    B: { socketId: '', name: "", userId: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[83, 1], [82, 1], [81, 1], [80, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#00D4FF" },
    Y: { socketId: '', name: "", userId: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[87, 1], [86, 1], [85, 1], [84, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#ffc400" },
    G: { socketId: '', name: "", userId: "", profile: "", online: false, pieceIdx: [-1, -1, -1, -1], pieceRef: new Map([[91, 1], [90, 1], [89, 1], [88, 1]]), homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: "#39FF14" },
  },
};

function endGameLogic(state) {
  // If the game is already finished or hasn't started, do nothing
  if (state.meta.status === "FINISHED" || state.meta.status === "WAITING") return state;

  return {
    ...state,
    meta: {
      ...state.meta,
      status: "FINISHED",
    },
    move: {
      ...state.move,
      rollAllowed: false,
      moveAllowed: false,
      moving: false,
      turn: null, // Clear active turn
    },
  };
}

function syncStateLogic(state, serverState) {
  // Re-hydrate the pieceRef Maps because JSON stringifies them as Arrays
  const hydratedPlayers = {};
  ["R", "B", "Y", "G"].forEach(c => {
    if (serverState.players[c]) {
      hydratedPlayers[c] = {
        ...serverState.players[c],
        pieceRef: new Map(serverState.players[c].pieceRef)
      };
    }
  });
  
  // Ensure Sets are hydrated
  const hydratedMeta = {
    ...serverState.meta,
    onBoard: new Set(serverState.meta.onBoard)
  };

  return {
    meta: hydratedMeta,
    move: serverState.move,
    players: { ...state.players, ...hydratedPlayers }
  };
}

const gameActions = {
  initiateGame: (gameObj) => 
    useGameStore.setState((state) => initiateOfflineGameLogic(state, gameObj), false, "initiateGame"),

  updateMoveCount: (moveCount = 0) => 
    useGameStore.setState((state) => updateMoveCountLogic(state, moveCount), false, "updateMoveCount"),

  updatePieceState: (curColor, pieceIdx, pieceRef, deltaRef = 0, deltaIdx = 0) => 
    useGameStore.setState((state) => updatePieceStateLogic(state, curColor, pieceIdx, pieceRef, deltaRef, deltaIdx), false, "updatePieceState"),

  transferTurn: (turnCase = -1) => 
    useGameStore.setState((state) => transferTurnLogic(state, turnCase), false, "transferTurn"),

  updateTimeOut: (newState) => 
    useGameStore.setState((state) => updateTimeOutLogic(state, newState), false, "updateTimeOut"),

  setMoving: (val) => 
    useGameStore.setState((state) => setMovingLogic(state, val), false, "setMoving"),
    
  resetStore: () => useGameStore.setState(initialState, false, "resetStore"),
  
  syncGameState: (serverState) => useGameStore.setState((state) => syncStateLogic(state, serverState), false, "syncGameState"),    
  
  setMoving: (val) => useGameStore.setState((state) => ({ move: { ...state.move, moving: val } }), false, "setMoving"),

  endGame: () => 
    useGameStore.setState((state) => endGameLogic(state), false, "endGame"),

  // NEW: Async function to save the game to the database
  saveGameToDB: async (title) => {
    const state = useGameStore.getState();

    // Only save offline/bot games
    if (state.meta.type !== "offline" && state.meta.type !== "bot") return;

    // Format payload to exactly match your Mongoose Schema
    const payload = {
      meta: {
        gameId: state.meta.gameId,
        status: state.meta.status,
        type: state.meta.type,
        title,
        playerCount: state.meta.playerCount,
        onBoard: Array.from(state.meta.onBoard), // Zustand Set -> Mongoose Array
        winLast: state.meta.winLast
      },
      move: {
        playerIdx: state.move.playerIdx,
        turn: state.move.turn,
        moveCount: state.move.moveCount,
        rollAllowed: state.move.rollAllowed
      },
      players: {
        R: state.players.R, // Only the fields in playerSchema will be saved by Mongoose
        B: state.players.B,
        Y: state.players.Y,
        G: state.players.G
      }
    };

    try {
      await api.post('/api/games/save', payload);
      const msg = state.meta.status === "FINISHED" ? "Match results saved!" : "Game progress saved!";
      toast.success(msg, { theme: "dark" });
    } catch (error) {
      console.error("Failed to save game to DB:", error);
      toast.error("Failed to sync with server");
    }
  },
  loadGameFromDB: async (gameId) => {
    try {
      const res = await api.get(`/api/games/${gameId}`);
      
      if (res.data.success && res.data.game) {
        useGameStore.setState((state) => loadGameLogic(state, res.data.game), false, "loadGameFromDB");
        return true; // Return success so UI can navigate to board
      }
      return false;
    } catch (error) {
      console.error("Failed to load game from DB:", error);
      toast.error("Saved game not found");
      return false;
    }
  }
};


export default gameActions;