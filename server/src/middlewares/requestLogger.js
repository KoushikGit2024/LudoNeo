import jwt from "jsonwebtoken";
import Log from "../models/logModel.js";

// Helper: Converts heavy payloads into tiny metadata fingerprints
const getTinyReference = (payload) => {
  if (!payload || Object.keys(payload).length === 0) return undefined;
  
  const reference = {};
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) {
      reference[key] = `[Array: ${value.length}]`;
    } else if (value !== null && typeof value === 'object') {
      reference[key] = `[Object: ${Object.keys(value).length} keys]`;
    } else {
      // Keep completely harmless routing IDs intact for easy debugging, 
      // but mask everything else (emails, passwords, tokens) as just their type.
      if (['gameId', 'boardType'].includes(key)) {
         reference[key] = value;
      } else {
         reference[key] = `[${typeof value}]`;
      }
    }
  }
  return reference;
};

const requestLogger = (req, res, next) => {
  let currentUserId = null;
  const token = req.cookies?.token || req.headers.authorization?.split(" ")[1];

  if (token) {
    try {
      const decoded = jwt.decode(token);
      if (decoded && decoded.id) currentUserId = decoded.id;
    } catch (err) {
      // Ignore token errors here
    }
  }

  Log.create({
    method: req.method,
    url: req.originalUrl.split('?')[0],
    ip: req.ip || req.connection?.remoteAddress,
    userAgent: req.headers["user-agent"],
    userId: currentUserId,
    actionDetails: {
      // Generate the tiny fingerprints
      bodyRef: getTinyReference(req.body),
      queryRef: getTinyReference(req.query),
      paramsRef: getTinyReference(req.params),
      hasFile: !!req.file
    }
  }).catch((err) => {
    console.error("⚠️ System Log Failure:", err.message);
  });

  next();
};

export default requestLogger;