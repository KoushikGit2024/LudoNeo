import express from "express";
import { 
    initOnlineGameRedis, 
    saveGame, 
    getSavedGamesList, 
    getGameById, 
    deleteSavedGame,
    recordMatchStats
} from "../handlers/gameHandlers.js";
import tokenChecker from "../middlewares/tokenCheker.js"; 

const gameRoute = express.Router();

// Redis Route
gameRoute.post("/init-online", tokenChecker, initOnlineGameRedis);

// MongoDB Routes
gameRoute.post("/record-stats", tokenChecker, recordMatchStats);
gameRoute.post("/save", tokenChecker, saveGame);
gameRoute.get("/saved", tokenChecker, getSavedGamesList);
gameRoute.get("/:gameId", tokenChecker, getGameById);
gameRoute.delete('/saved/:id', tokenChecker, deleteSavedGame);

export default gameRoute;