import { StonApiClient } from '@ston-fi/api';
import { TonClient } from 'ton';
import { Database } from '../database/mongodb.js';

export class StonFiTradingService {
    private stonClient: StonApiClient;

    constructor(
        private tonClient: TonClient,
        private db: Database
    ) {
        this.stonClient = new StonApiClient();
    }

    async getAssetPrice(assetAddress: string) {
        try {
            const asset = await this.stonClient.getAsset(assetAddress);
            return asset.dexPriceUsd;
        } catch (error) {
            console.error('Failed to get asset price:', error);
            throw error;
        }
    }

    async simulateSwap(params: {
        fromAddress: string;
        toAddress: string;
        amount: string;
        walletAddress: string;
        slippage: number;
    }) {
        try {
            const simulation = await this.stonClient.simulateSwap({
                fromAsset: params.fromAddress,
                toAsset: params.toAddress,
                amount: params.amount,
                userWalletAddress: params.walletAddress,
                slippage: params.slippage
            });

            return {
                expectedAmount: simulation.expectedAmount,
                priceImpact: simulation.priceImpact,
                route: simulation.route
            };
        } catch (error) {
            console.error('Swap simulation failed:', error);
            throw error;
        }
    }

    async getWalletAssets(walletAddress: string) {
        try {
            return await this.stonClient.getWalletAssets(walletAddress);
        } catch (error) {
            console.error('Failed to get wallet assets:', error);
            throw error;
        }
    }

    async getAvailablePairs() {
        try {
            return await this.stonClient.getSwapPairs();
        } catch (error) {
            console.error('Failed to get swap pairs:', error);
            throw error;
        }
    }

    async getOperationHistory(walletAddress: string) {
        try {
            const now = new Date();
            const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30));

            return await this.stonClient.getWalletOperations({
                walletAddress,
                since: thirtyDaysAgo,
                until: new Date()
            });
        } catch (error) {
            console.error('Failed to get operation history:', error);
            throw error;
        }
    }

    async searchAssets(searchString: string, walletAddress?: string) {
        try {
            return await this.stonClient.searchAssets({
                searchString,
                walletAddress
            });
        } catch (error) {
            console.error('Asset search failed:', error);
            throw error;
        }
    }
}