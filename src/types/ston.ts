// Define the Operation interface based on STON.fi API
export interface Operation {
    type: string;
    amount: string;
    symbol: string;
    timestamp: string;
}

// Define search params interface
export interface AssetSearchParams {
    searchString: string;
    condition?: string;
    walletAddress?: string;
}