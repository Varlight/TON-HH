// src/types/index.ts
export interface WalletInfo {
    address: string;
    mnemonics?: string[];
    balance: number;
}

export interface TradingSettings {
    maxAmount: number;
    slippage: number;
    autoTrade: boolean;
    inputState?: 'waiting_token_buy' | 'waiting_token_sell' | 'waiting_amount' | 
                 'waiting_slippage' | 'waiting_copy_wallet' | null;
}

export interface UserData {
    userId: string;
    wallet?: WalletInfo;
    settings: TradingSettings;
}

export interface TradingPair {
    baseToken: string;
    quoteToken: string;
    baseDecimals: number;
    quoteDecimals: number;
}

export enum OrderType {
    BUY = 'BUY',
    SELL = 'SELL'
}

export enum OrderStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    CANCELLED = 'CANCELLED'
}

export interface TradeOrder {
    id: string;
    userId: string;
    pair: TradingPair;
    type: OrderType;
    amount: number;
    price?: number;
    status: OrderStatus;
    timestamp: Date;
    walletAddress: string;
    slippage: number;
    error?: string;
}

export interface CopyTrader {
    userId: string;
    walletAddress: string;
    totalTrades: number;
    successRate: number;
    profitLoss: number;
    followers: number;
}