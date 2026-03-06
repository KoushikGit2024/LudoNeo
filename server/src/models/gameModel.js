import mongoose from "mongoose";

const playerSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    name: String,
    profile: String,
    color: String,
    pieceIdx: { type: [Number], default: [-1, -1, -1, -1] },
    homeCount: { type: Number, default: 4 },
    outCount: { type: Number, default: 0 },
    winCount: { type: Number, default: 0 },
    winPosn: { type: Number, default: 0 },
    online: { type: Boolean, default: false }
}, { _id: false }); // No need for separate IDs for each player sub-doc

const gameStoreSchema = new mongoose.Schema({
    meta: {
        gameId: { type: String, required: true, unique: true },
        status: { 
            type: String, 
            enum: ["WAITING", "RUNNING", "FINISHED"], 
            default: "WAITING" 
        },
        type: { type: String, default: "offline" },
        title: { type:String },
        playerCount: { type: Number, default: 4 },
        onBoard: [String], // Array of active colors like ['R', 'G']
        winLast: { type: Number, default: 0 }
    },
    move: {
        playerIdx: { type: Number, default: 0 },
        turn: { type: String, default: 'R' },
        moveCount: { type: Number, default: 0 },
        rollAllowed: { type: Boolean, default: true }
    },
    players: {
        R: playerSchema,
        B: playerSchema,
        Y: playerSchema,
        G: playerSchema
    },
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

const GameStore = mongoose.models.GameStore || mongoose.model('gamestore', gameStoreSchema);

export default GameStore;