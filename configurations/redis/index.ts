import { config } from 'dotenv';
import Redis from 'ioredis';

// Load environment variables
config();

interface RedisConfig {
    host: string;
    port: number;
}

// Parse Redis endpoint into host and port
const [host, portStr] = (process.env.REDIS_CACHE_HOST_ENDPOINT || '').split(':');
const port = parseInt(portStr || '6379', 10);

const redisConfig: RedisConfig = {
    host,
    port
};

// Initialize Redis client
const redis = new Redis(redisConfig);

// Function to check Redis connection
export const checkRedisConnection = async (): Promise<void> => {
    try {
        await redis.ping();
        console.log(`Connected to Redis Cache: ${process.env.REDIS_CACHE_HOST_ENDPOINT}`);
    } catch (error) {
        console.error('Redis connection error:', error);
        throw new Error('Failed to connect to Redis');
    }
};

// Export Redis client as default
export default redis;
