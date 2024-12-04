import dotenv from 'dotenv';
dotenv.config();
if (!process.env.TELEGRAM_TOKEN || !process.env.TON_API_KEY) {
    throw new Error('Required environment variables are not set');
}
export const CONFIG = {
    TELEGRAM_TOKEN: process.env.TELEGRAM_TOKEN,
    TON_ENDPOINT: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    TON_API_KEY: process.env.TON_API_KEY,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/ton_bot'
};