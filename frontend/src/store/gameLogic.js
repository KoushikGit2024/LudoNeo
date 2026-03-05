// Pure game logic helpers for useGameStore.
// These functions are state updaters that do not depend on React,
// so they can be imported and tested directly without causing rerenders.

import { Bounce, toast } from "react-toastify";
import useGameStore from "./useGameStore";

function shortId(length = 6) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join("");
}

function initiateOfflineGameLogic(state, gameObj) {
  if (state.meta.status !== "WAITING") return state;

  const genId = shortId(16);

  if (gameObj.type !== "offline") {
    return state;
  }

  const player = {};
  const colors = ["#FF3131", "#00D4FF", "#ffc400", "#00FF14"];
  const onBoardSet = new Set(gameObj.players);

  ["R", "B", "Y", "G"].forEach((el, idx) => {
    let startIdx;
    if (el === "R") startIdx = 79;
    if (el === "B") startIdx = 83;
    if (el === "Y") startIdx = 87;
    if (el === "G") startIdx = 91;

    if (onBoardSet.has(el)) {
      player[el] = {
        ...state.players[el],
        name: gameObj.names[idx],
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
      player[el] = {
        ...state.players[el],
        color: colors[idx],
      };
    }
  });

  const startTime = structuredClone(state.meta.gameStartedAt);
  startTime.push(Date.now());

  return {
    ...state,
    move: {
      playerIdx: 0,
      turn: gameObj.players[0],
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
      type: "offline",
      winLast: 0,
    },
    players: {
      ...state.players,
      ...player,
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
};


export default gameActions;