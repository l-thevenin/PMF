const API_BASE_URL = process.env.NODE_ENV === 'production' 
  ? '' 
  : 'http://localhost:3002';

export interface Overview {
  totalStrategies: number;
  totalTrades: number;
  successfulTrades: number;
  successRate: number;
  totalProfit: number;
}

export interface Strategy {
  id: string;
  createdAt: string;
  symbol: string;
  timeframe: string;
  parameters: any;
  confidence: number;
  tradesCount: number;
  successfulTrades: number;
  totalProfit: number;
}

export interface Trade {
  id: string;
  createdAt: string;
  strategyId: string;
  symbol: string;
  type: string;
  price: number;
  quantity: number;
  status: string;
  executionPrice?: number;
  profit?: number;
  strategy: {
    id: string;
    symbol: string;
    timeframe: string;
    confidence: number;
  };
}

export interface PerformanceData {
  date: string;
  trades: number;
  successful: number;
  profit: number;
}

export interface SymbolStats {
  symbol: string;
  count: number;
  totalProfit: number;
  avgProfit: number;
}

export const dashboardApi = {
  async getOverview(): Promise<Overview> {
    const response = await fetch(`${API_BASE_URL}/api/overview`);
    if (!response.ok) throw new Error('Failed to fetch overview');
    return response.json();
  },

  async getStrategies(limit = 10): Promise<Strategy[]> {
    const response = await fetch(`${API_BASE_URL}/api/strategies?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch strategies');
    return response.json();
  },

  async getTrades(limit = 20, status?: string): Promise<Trade[]> {
    const url = status 
      ? `${API_BASE_URL}/api/trades?limit=${limit}&status=${status}`
      : `${API_BASE_URL}/api/trades?limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch trades');
    return response.json();
  },

  async getPerformance(days = 7): Promise<PerformanceData[]> {
    const response = await fetch(`${API_BASE_URL}/api/performance?days=${days}`);
    if (!response.ok) throw new Error('Failed to fetch performance');
    return response.json();
  },

  async getTradesBySymbol(): Promise<SymbolStats[]> {
    const response = await fetch(`${API_BASE_URL}/api/trades-by-symbol`);
    if (!response.ok) throw new Error('Failed to fetch trades by symbol');
    return response.json();
  }
};
