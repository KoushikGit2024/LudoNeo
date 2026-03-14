import useGameStore from "./useGameStore";

// ==========================================
// PURE LOGIC HELPERS (ONLINE SPECIFIC)
// ==========================================

function getSkeletonPlayer(colorKey) {
  const startIdx = { R: 79, B: 83, Y: 87, G: 91 }[colorKey];
  const hex = { R: "#FF3131", B: "#00D4FF", Y: "#ffc400", G: "#39FF14" }[colorKey];
  return {
    socketId: '', name: "", userId: "", profile: "", online: false,
    pieceIdx: [-1, -1, -1, -1],
    pieceRef: new Map([[startIdx, 1], [startIdx - 1, 1], [startIdx - 2, 1], [startIdx - 3, 1]]),
    homeCount: 4, outCount: 0, winCount: 0, winPosn: 0, color: hex
  };
}

function syncStateLogic(state, serverState) {
  const hydratedPlayers = {};
  const onBoard = new Set(serverState.meta.onBoard);

  ["R", "B", "Y", "G"].forEach(c => {
    if (serverState.players[c] && onBoard.has(c)) {
      hydratedPlayers[c] = {
        ...serverState.players[c],
        // Safely map Redis Arrays back to JS Maps for rendering
        pieceRef: Array.isArray(serverState.players[c].pieceRef) 
          ? new Map(serverState.players[c].pieceRef) 
          : new Map()
      };
    } else {
      hydratedPlayers[c] = getSkeletonPlayer(c);
    }
  });

  console.log({
    ...state,
    meta: {
      ...serverState.meta,
      onBoard: new Set(serverState.meta.onBoard),
      syncTick: serverState.syncTick ?? serverState.meta.syncTick ?? 0
    },
    move: {
      ...serverState.move,
      // ⏱️ Strictly enforce the timestamp fallback for full initial syncs
      turnStartedAt: serverState.move?.turnStartedAt || Date.now() 
    },
    players: { ...state.players, ...hydratedPlayers }
  })
  
  return {
    ...state,
    meta: {
      ...serverState.meta,
      onBoard: new Set(serverState.meta.onBoard),
      syncTick: serverState.syncTick ?? serverState.meta.syncTick ?? 0
    },
    move: {
      ...serverState.move,
      // ⏱️ Strictly enforce the timestamp fallback for full initial syncs
      turnStartedAt: serverState.move?.turnStartedAt || Date.now() 
    },
    players: { ...state.players, ...hydratedPlayers }
  };
}

function patchStateLogic(state, updates, syncTick) {
  const newPlayers = { ...state.players };

  if (updates.playerUpdates) {
      Object.keys(updates.playerUpdates).forEach(pColor => {
          const pData = updates.playerUpdates[pColor];
          newPlayers[pColor] = { 
            ...newPlayers[pColor], 
            ...pData,
            pieceRef: pData.pieceRef ? (Array.isArray(pData.pieceRef) ? new Map(pData.pieceRef) : pData.pieceRef) : newPlayers[pColor].pieceRef
          };
      });
  }

  // ⏱️ Safely patch move updates, prioritizing the incoming server timestamp
  const updatedMove = updates.move ? {
    ...state.move,
    ...updates.move,
    turnStartedAt: updates.move.turnStartedAt || state.move.turnStartedAt || Date.now()
  } : state.move;

  return {
      ...state,
      move: updatedMove,
      meta: { ...state.meta, ...(updates.metaUpdates || {}), syncTick: syncTick ?? state.meta.syncTick },
      players: newPlayers
  };
}

const onlineGameActions = {
  syncFullState: (serverState) => 
    useGameStore.setState((state) => syncStateLogic(state, serverState), false, "syncFullState"),    

  patchDeltaState: (updates, syncTick) =>
    useGameStore.setState((state) => patchStateLogic(state, updates, syncTick), false, "patchDeltaState"),

  setMoving: (val) => 
    useGameStore.setState((state) => ({ move: { ...state.move, moving: val } }), false, "setMoving"),
};

export default onlineGameActions;