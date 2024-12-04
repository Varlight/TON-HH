import { TonClient, WalletContractV4, Address } from "ton";
import { internal } from "ton-core";
import { mnemonicNew, mnemonicToPrivateKey } from "ton-crypto";
import { CONFIG } from '../config/config.js';

export class TonManager {
    private client: TonClient;

    constructor() {
        this.client = new TonClient({
            endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',  // Use testnet
            apiKey: CONFIG.TON_API_KEY
        });
        console.log('TON Client initialized with API key');
    }

    async createWallet() {
        try {
            const mnemonics = await mnemonicNew();
            const keyPair = await mnemonicToPrivateKey(mnemonics);
            
            const wallet = WalletContractV4.create({
                workchain: 0,
                publicKey: keyPair.publicKey
            });

            const contract = this.client.open(wallet);
            const address = contract.address.toString();

            return {
                address,
                mnemonics,
                keyPair
            };
        } catch (error) {
            console.error('Failed to create wallet:', error);
            throw error;
        }
    }

    async getBalance(address: string): Promise<number> {
        try {
            const balance = await this.client.getBalance(
                Address.parse(address)
            );
            return Number(balance) / 1e9;
        } catch (error) {
            console.error('Failed to get balance:', error);
            throw error;
        }
    }
}