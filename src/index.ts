import { TonManager } from './blockchain/ton-client.js';
import { Database } from './database/mongodb.js';
import { TelegramBot } from './telegram/bot.js';

async function main() {
    try {
        // Initialize services
        const db = new Database();
        await db.connect();

        const ton = new TonManager();
        const bot = new TelegramBot(ton, db);

        // Start bot
        await bot.start();
        console.log('TON Trading Bot is running');
    } catch (error) {
        console.error('Failed to start bot:', error);
        process.exit(1);
    }
}

main().catch(console.error);