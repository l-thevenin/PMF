export interface StrategyParameters {
    action: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    stopLoss: number;
    takeProfit: number;
    leverage?: number;
}

export interface Strategy {
    id: string;
    symbol: string;
    createdAt: Date;
    timeframe: string;
    parameters: StrategyParameters;
    confidence: number;
}

export interface Trade {
    id: string;
    strategyId: string;
    symbol: string;
    type: 'BUY' | 'SELL';
    price: number;
    quantity: number;
    status: 'PENDING' | 'EXECUTED' | 'FAILED';
    executionPrice?: number;
    profit?: number;
}

export interface Candlestick {
    openTime: number;
    open: string;
    high: string;
    low: string;
    close: string;
    volume: string;
    closeTime: number;
    quoteAssetVolume: string;
    trades: number;
    takerBuyBaseAssetVolume: string;
    takerBuyQuoteAssetVolume: string;
}