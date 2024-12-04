// src/database/mongodb.ts
import { MongoClient, Db, Collection } from 'mongodb';
import { CONFIG } from '../config/config.js';
import { UserData, TradeOrder, CopyTrader } from '../types/index.js';

export class Database {
    private client: MongoClient;
    private db!: Db;
    private users!: Collection<UserData>;
    private orders!: Collection<TradeOrder>;
    private copyTraders!: Collection<CopyTrader>;

    constructor() {
        this.client = new MongoClient(CONFIG.MONGODB_URI);
    }

    async connect() {
        await this.client.connect();
        this.db = this.client.db('ton_trading_bot');
        
        // Initialize typed collections
        this.users = this.db.collection<UserData>('users');
        this.orders = this.db.collection<TradeOrder>('orders');
        this.copyTraders = this.db.collection<CopyTrader>('copyTraders');
        
        // Create indexes
        await this.users.createIndex({ userId: 1 }, { unique: true });
        await this.orders.createIndex({ userId: 1 });
        await this.orders.createIndex({ timestamp: 1 });
        await this.copyTraders.createIndex({ userId: 1 }, { unique: true });
        console.log('Connected to MongoDB');
    }

    // User methods
    async saveUser(userData: UserData) {
        await this.users.updateOne(
            { userId: userData.userId },
            { $set: userData },
            { upsert: true }
        );
    }

    async getUser(userId: string): Promise<UserData | null> {
        return this.users.findOne({ userId });
    }

    // Order methods
    async saveOrder(order: TradeOrder) {
        await this.orders.insertOne(order);
    }

    async updateOrder(order: TradeOrder) {
        await this.orders.updateOne(
            { id: order.id },
            { $set: order }
        );
    }

    async getOrder(orderId: string): Promise<TradeOrder | null> {
        return this.orders.findOne({ id: orderId });
    }

    async getOrders(userId: string): Promise<TradeOrder[]> {
        const cursor = this.orders
            .find({ userId })
            .sort({ timestamp: -1 });
        return cursor.toArray();
    }

    // Copy trading methods
    async saveCopyTrader(trader: CopyTrader) {
        await this.copyTraders.updateOne(
            { userId: trader.userId },
            { $set: trader },
            { upsert: true }
        );
    }

    async getCopyTraders(limit: number = 10): Promise<CopyTrader[]> {
        const cursor = this.copyTraders
            .find()
            .sort({ successRate: -1 })
            .limit(limit);
        return cursor.toArray();
    }

    async getCopyTrader(userId: string): Promise<CopyTrader | null> {
        return this.copyTraders.findOne({ userId });
    }

    async updateTraderStats(userId: string, trade: TradeOrder) {
        const trader = await this.getCopyTrader(userId);
        if (!trader) {
            return;
        }

        // Update trader statistics based on trade result
        const stats = {
            totalTrades: trader.totalTrades + 1,
            successRate: trade.status === 'COMPLETED' 
                ? (trader.successRate * trader.totalTrades + 100) / (trader.totalTrades + 1)
                : (trader.successRate * trader.totalTrades) / (trader.totalTrades + 1)
        };

        await this.copyTraders.updateOne(
            { userId },
            { $set: stats }
        );
    }
}