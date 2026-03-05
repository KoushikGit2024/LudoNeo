import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

// Initial State only
const initialState = {
  meta: {
    gameId: "",
    status: "WAITING",
    type: "offline",
    version: 0,
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



const useGameStore = create(
  devtools(
    persist(
      () => initialState, // Your existing initial state with Maps and Sets
      {
        name: "ludo-neo-vault",
        storage: {
          getItem: (name) => {
            const str = localStorage.getItem(name);
            if (!str) return null;
            
            // Custom Parser: Reconstructs Map/Set from saved Arrays
            return JSON.parse(str, (key, value) => {
              if (value && value.__type === 'Map') return new Map(value.value);
              if (value && value.__type === 'Set') return new Set(value.value);
              return value;
            });
          },
          setItem: (name, newValue) => {
            // Custom Stringifier: Converts Map/Set to Arrays with metadata
            const str = JSON.stringify(newValue, (key, value) => {
              if (value instanceof Map) {
                return { __type: 'Map', value: Array.from(value.entries()) };
              }
              if (value instanceof Set) {
                return { __type: 'Set', value: Array.from(value.values()) };
              }
              return value;
            });
            localStorage.setItem(name, str);
          },
        },
      }
    )
  )
);

export default useGameStore;

