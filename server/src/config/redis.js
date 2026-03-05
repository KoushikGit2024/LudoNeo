import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === "production";
const redisUrl = isProduction ? process.env.REDIS_URL : process.env.REDIS_URL_DEV;

const redis = new Redis(redisUrl, {
    // 1. FIXED: Only apply TLS for production (Upstash)
    ...(isProduction && {
        tls: {
            rejectUnauthorized: false 
        }
    }),

    // 2. FIXED: Set to null for compatibility with Socket.io adapters
    maxRetriesPerRequest: null, 

    retryStrategy(times) {
        // Stop retrying if we've failed too many times to prevent infinite loops
        if (times > 10) {
            console.error("❌ Redis connection failed permanently.");
            return null; 
        }
        // Log connection attempt only in dev for cleaner production logs
        if (!isProduction) console.log(`🔄 Retrying Redis connection: attempt ${times}`);
        
        return Math.min(times * 100, 3000); // Exponential backoff
    },
});

redis.on('connect', () => {
    console.log(`🚀 Redis Connected (${isProduction ? 'Production' : 'Development'})`);
});

redis.on('error', (err) => {
    // Only log actual errors, ignore expected disconnects during restart
    if (err.message !== 'Connection is closed.') {
        console.error('❌ Redis Error:', err.message);
    }
});

export default redis;