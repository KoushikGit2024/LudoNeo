import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const redisUrl = isProduction ? process.env.REDIS_URL : process.env.REDIS_URL_DEV;

if (!redisUrl) {
    console.error("❌ ERROR: Redis connection URL is missing in .env");
    process.exit(1);
}

// Create the client
const redisClient = createClient({
    url: redisUrl,
    socket: {
        // 1. Production Security: Enable TLS for Upstash/Managed Redis
        tls: isProduction ? true : false,
        rejectUnauthorized: false,
        
        // 2. Reconnect Strategy: node-redis uses a function that returns the delay
        reconnectStrategy: (retries) => {
            if (retries > 15) {
                console.error("❌ Redis: Max retries reached. Connection failed.");
                return new Error("Redis connection failed");
            }
            const delay = Math.min(retries * 100, 3000);
            if (!isProduction) console.log(`🔄 Redis: Reconnecting attempt ${retries}...`);
            return delay;
        }
    }
});

// --- Event Listeners ---

redisClient.on('connect', () => {
    console.log(`🚀 Redis: Connected to ${isProduction ? 'Production' : 'Development'}`);
});

redisClient.on('ready', () => {
    console.log('✅ Redis: Client ready and RedisJSON enabled');
});

redisClient.on('error', (err) => {
    console.error('❌ Redis Error:', err.message);
});

// --- Initialize Connection ---
// Unlike ioredis, node-redis requires you to call .connect() manually
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        console.error("❌ Redis Initial Connection Error:", err);
    }
})();

export default redisClient;