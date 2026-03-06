import express from 'express';
import { saveGame, getGame } from '../handlers/gameControler.js';

const gameRoute = express.Router();

// POST request to save/update the game
gameRoute.post('/save', saveGame);

// GET request to retrieve a specific game by ID
gameRoute.get('/:gameId', getGame);

export default gameRoute;