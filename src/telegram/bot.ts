// src/telegram/bot.ts
import { Bot, Context, InlineKeyboard } from 'grammy';
import { Menu } from '@grammyjs/menu';
import { CONFIG } from '../config/config.js';
import { TonManager } from '../blockchain/ton-client.js';
import { Database } from '../database/mongodb.js';
import { StonApiClient } from '@ston-fi/api';
import { UserData } from '../types/index.js';
import { AssetInfo } from '@ston-fi/api';  // Add AssetResponse import


export class TelegramBot {
    private bot: Bot;
    private menu!: Menu;
    private stonClient: StonApiClient;

    constructor(
        private tonManager: TonManager,
        private db: Database
    ) {
        this.bot = new Bot(CONFIG.TELEGRAM_TOKEN);
        this.stonClient = new StonApiClient();
        this.setupBot();
    }

    private setupBot() {
        this.menu = new Menu<Context>('main-menu')
            .text('💰 Wallet', async (ctx) => await this.handleWallet(ctx))
            .text('⚙️ Settings', async (ctx) => await this.handleSettings(ctx))
            .text('📊 Trade', async (ctx) => await this.handleTrade(ctx));

        this.bot.use(this.menu);
        
        this.setupCommands();
        this.setupCallbacks();
        this.setupErrorHandling();
    }

    private setupCommands() {
        this.bot.command('start', async (ctx) => {
            if (!ctx.from) {
                console.error('No user information found');
                return;
            }
    
            const userId = ctx.from.id.toString();
            const existingUser = await this.db.getUser(userId);
            
            if (!existingUser?.wallet) {
                const wallet = await this.tonManager.createWallet();
                await this.db.saveUser({
                    userId,
                    wallet: {
                        address: wallet.address,
                        mnemonics: wallet.mnemonics,
                        balance: 0
                    },
                    settings: {
                        maxAmount: 1,
                        slippage: 1,
                        autoTrade: false,
                        inputState: null
                    }
                });
    
                await ctx.reply(
                    `✅ Wallet created automatically!\n\n` +
                    `Address: \`${wallet.address}\`\n\n` +
                    `🔐 Save your recovery phrase:\n` +
                    `\`${wallet.mnemonics.join(' ')}\``,
                    { parse_mode: 'Markdown' }
                );
            }
    
            const keyboard = new InlineKeyboard()
                .text('Buy Token 📈', 'buy_token')
                .text('Sell Token 📉', 'sell_token')
                .row()
                .text('Copy Trade 📋', 'copy_trade')
                .text('Orders 📊', 'view_orders')
                .row()
                .text('Settings ⚙️', 'settings')
                .text('Wallet 💼', 'wallet');
    
            await ctx.reply('Welcome to TON Trading Bot!', { reply_markup: keyboard });
        });

        this.bot.command('wallet', async (ctx) => await this.handleWallet(ctx));
        this.bot.command('trade', async (ctx) => await this.handleTrade(ctx));
        this.bot.command('settings', async (ctx) => await this.handleSettings(ctx));
    }

    private setupCallbacks() {
        // Buy/Sell callbacks
        this.bot.callbackQuery('buy_token', async (ctx) => {
            await ctx.reply('Enter token symbol or address to buy (e.g., TON, USDT):');
            await this.updateUserState(ctx.from.id.toString(), 'waiting_token_buy');
            await ctx.answerCallbackQuery();
        });

        this.bot.callbackQuery('sell_token', async (ctx) => {
            const userId = ctx.from.id.toString();
            const user = await this.db.getUser(userId);
            if (!user?.wallet) {
                await ctx.reply('Please create a wallet first');
                return ctx.answerCallbackQuery();
            }
        
            try {
                const assets = await this.stonClient.getWalletAssets(user.wallet.address);
                if (!assets || assets.length === 0) {
                    await ctx.reply('No tokens found in your wallet');
                    return ctx.answerCallbackQuery();
                }
        
                const keyboard = new InlineKeyboard();
                assets.forEach((asset: AssetInfo) => {
                    keyboard.text(`${asset.displayName}`, `sell_token_${asset.contractAddress}`);
                    keyboard.row();
                });
        
                await ctx.reply('Select token to sell:', { reply_markup: keyboard });
            } catch (error) {
                await ctx.reply('Error fetching your tokens. Please try again.');
            }
            await ctx.answerCallbackQuery();
        });

        // Settings callbacks
        this.bot.callbackQuery('settings', async (ctx) => {
            await this.handleSettings(ctx);
            await ctx.answerCallbackQuery();
        });

        this.bot.callbackQuery('set_amount', async (ctx) => {
            await ctx.reply('Enter trade amount in TON (e.g., 10):');
            await this.updateUserState(ctx.from.id.toString(), 'waiting_amount');
            await ctx.answerCallbackQuery();
        });

        this.bot.callbackQuery('set_slippage', async (ctx) => {
            await ctx.reply('Enter slippage percentage (e.g., 1 for 1%):');
            await this.updateUserState(ctx.from.id.toString(), 'waiting_slippage');
            await ctx.answerCallbackQuery();
        });

        // Wallet callbacks
        this.bot.callbackQuery('wallet', async (ctx) => {
            await this.handleWallet(ctx);
            await ctx.answerCallbackQuery();
        });

        this.bot.callbackQuery('check_balance', async (ctx) => {
            await this.handleCheckBalance(ctx);
            await ctx.answerCallbackQuery();
        });

        this.bot.callbackQuery('deposit_instructions', async (ctx) => {
            await this.handleDepositInstructions(ctx);
            await ctx.answerCallbackQuery();
        });

        // Copy trade callbacks
        this.bot.callbackQuery('copy_trade', async (ctx) => {
            const keyboard = new InlineKeyboard()
                .text('Set Target Wallet', 'set_copy_wallet')
                .row()
                .text('Set Copy Percentage', 'set_copy_percentage');

            await ctx.reply('Copy Trading Setup:', { reply_markup: keyboard });
            await ctx.answerCallbackQuery();
        });
    }

    private setupErrorHandling() {
        this.bot.catch((err: Error) => {
            console.error('Bot error:', err);
        });
    }

    // Message handler
    private async handleTextMessage(ctx: Context) {
        const userId = ctx.from?.id.toString();
        if (!userId) return;
    
        // Ensure that message and message.text exist
        const messageText = ctx.message?.text;
        if (!messageText) return; // If messageText is undefined, return early
    
        const user = await this.db.getUser(userId);
        if (!user?.settings?.inputState) {
            return;
        }
    
        switch (user.settings.inputState) {
            case 'waiting_amount':
                const amount = parseFloat(messageText);
                if (isNaN(amount) || amount <= 0) {
                    await ctx.reply('⚠️ Please enter a valid amount (e.g., 10)');
                    return;
                }
                await this.db.saveUser({
                    userId,
                    wallet: user.wallet,
                    settings: {
                        maxAmount: amount,
                        slippage: user.settings.slippage || 1,
                        autoTrade: user.settings.autoTrade || false,
                        inputState: null
                    }
                });
                await ctx.reply(`✅ Trade amount set to ${amount} TON`);
                break;
    
            case 'waiting_slippage':
                const slippage = parseFloat(messageText);
                if (isNaN(slippage) || slippage < 0 || slippage > 100) {
                    await ctx.reply('⚠️ Please enter a valid slippage percentage between 0 and 100');
                    return;
                }
                await this.db.saveUser({
                    userId,
                    wallet: user.wallet,
                    settings: {
                        maxAmount: user.settings.maxAmount || 0,
                        slippage: slippage,
                        autoTrade: user.settings.autoTrade || false,
                        inputState: null
                    }
                });
                await ctx.reply(`✅ Slippage set to ${slippage}%`);
                break;

            case 'waiting_token_buy':
                try {
                    const assets = await this.stonClient.searchAssets({
                        searchString: messageText,
                        condition: "asset:popular",  // Example condition, change as needed
                      });

                    if (!assets || assets.length === 0) {
                        await ctx.reply('Token not found. Please try again.');
                        return;
                    }

                    const token = assets[0];
                    const keyboard = new InlineKeyboard()
                        .text('0.5 TON', `buy_amount_0.5_${token.contractAddress}`)
                        .text('1 TON', `buy_amount_1_${token.contractAddress}`)
                        .text('3 TON', `buy_amount_3_${token.contractAddress}`)
                        .row()
                        .text('5 TON', `buy_amount_5_${token.contractAddress}`)
                        .text('10 TON', `buy_amount_10_${token.contractAddress}`);

                        await ctx.reply(
                            `Token: ${token.contractAddress}\n` +
                            `Price: $${token.dexPriceUsd}\n` +
                            'Select amount to buy:',
                            { reply_markup: keyboard }
                          );
                        } catch (error) {
                          await ctx.reply('Error fetching token info. Please try again.');
                        }
                break;
        }

        // Reset input state after handling
        await this.updateUserState(userId, null);
    }

    private async handleWallet(ctx: Context) {
        const userId = ctx.from?.id.toString();
        if (!userId) return;

        const user = await this.db.getUser(userId);
        if (!user?.wallet) {
            await ctx.reply('No wallet found. Use /start to create one.');
            return;
        }

        const balance = await this.tonManager.getBalance(user.wallet.address);
        
        const keyboard = new InlineKeyboard()
            .text('Check Balance 💰', 'check_balance')
            .text('Deposit 📥', 'deposit_instructions')
            .row()
            .text('Transaction History 📊', 'tx_history');

        await ctx.reply(
            `💼 Wallet Info:\n\n` +
            `Address: \`${user.wallet.address}\`\n` +
            `Balance: ${balance} TON\n\n` +
            `Select an action:`,
            { 
                parse_mode: 'Markdown',
                reply_markup: keyboard 
            }
        );
    }

    private async handleCheckBalance(ctx: Context) {
        const userId = ctx.from?.id.toString();
        if (!userId) return;

        const user = await this.db.getUser(userId);
        if (!user?.wallet) {
            await ctx.reply('No wallet found');
            return;
        }

        const balance = await this.tonManager.getBalance(user.wallet.address);
        await ctx.reply(
            `💰 Current Balance:\n` +
            `${balance} TON\n\n` +
            `Address: \`${user.wallet.address}\``,
            { parse_mode: 'Markdown' }
        );
    }

    private async handleDepositInstructions(ctx: Context) {
        const userId = ctx.from?.id.toString();
        if (!userId) return;

        const user = await this.db.getUser(userId);
        if (!user?.wallet) {
            await ctx.reply('No wallet found');
            return;
        }

        await ctx.reply(
            `📥 How to deposit TON:\n\n` +
            `1. Copy your wallet address:\n` +
            `\`${user.wallet.address}\`\n\n` +
            `2. Send TON from your wallet or exchange\n` +
            `3. Wait for confirmation (1-2 minutes)\n` +
            `4. Check balance using Check Balance\n\n` +
            `⚠️ Only send TON to this address!`,
            { parse_mode: 'Markdown' }
        );
    }

    private async handleSettings(ctx: Context) {
        const keyboard = new InlineKeyboard()
            .text('Set Trade Amount 💵', 'set_amount')
            .row()
            .text('Set Slippage % 📊', 'set_slippage')
            .row()
            .text('Auto-Trade ⚙️', 'toggle_auto_trade');

        await ctx.reply('⚙️ Trading Settings:', { reply_markup: keyboard });
    }

    private async handleTrade(ctx: Context) {
        const keyboard = new InlineKeyboard()
            .text('Buy Token 📈', 'buy_token')
            .text('Sell Token 📉', 'sell_token')
            .row()
            .text('Copy Trading 📋', 'copy_trade')
            .row()
            .text('View Orders 📊', 'view_orders');

        await ctx.reply('📊 Trading Menu:', { reply_markup: keyboard });
    }

    private async updateUserState(userId: string, state: UserData['settings']['inputState']) {
        const user = await this.db.getUser(userId);
        if (!user) return;

        await this.db.saveUser({
            ...user,
            settings: {
                ...user.settings,
                inputState: state
            }
        });
    }

    private async updateUserSettings(userId: string, settings: Partial<UserData['settings']>) {
        const user = await this.db.getUser(userId);
        if (!user) return;

        await this.db.saveUser({
            ...user,
            settings: {
                ...user.settings,
                ...settings,
            }
        });
    }

    async start() {
        try {
            console.log('Starting bot...');
            await this.bot.api.deleteWebhook();
            await this.bot.start({
                drop_pending_updates: true,
                onStart: (botInfo) => {
                    console.log(`Bot @${botInfo.username} is running`);
                }
            });
        } catch (error) {
            console.error('Failed to start bot:', error);
            throw error;
        }
    }
}