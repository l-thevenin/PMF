import { SMA, RSI, MACD } from 'technicalindicators';
import type { Strategy, StrategyParameters, Candlestick } from '@pmf/shared';

export interface Trend {
    direction: 'UP' | 'DOWN' | 'SIDEWAYS';
    strength: number;
    support: number;
    resistance: number;
}

interface MACDResult {
    MACD: number;
    signal: number;
    histogram: number;
}

export async function analyzeTrend(candlesticks: Candlestick[]): Promise<Trend> {
  const closePrices = candlesticks.map(candle => parseFloat(candle.close));
  
  const smaValues = SMA.calculate({ period: 20, values: closePrices });
  const rsiValues = RSI.calculate({ period: 14, values: closePrices });
  const macdResult = MACD.calculate({
    SimpleMAOscillator: false,
    SimpleMASignal: false,
    values: closePrices,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
  }) as MACDResult[];
  
  const currentPrice = closePrices[closePrices.length - 1];
  const currentSMA = smaValues[smaValues.length - 1];
  const currentRSI = rsiValues[rsiValues.length - 1];
  const currentMACD = macdResult[macdResult.length - 1];
  
  let direction: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
  let strength = 0;

  if (currentMACD && currentPrice && currentSMA) {
    if (currentPrice > currentSMA && currentMACD.MACD > currentMACD.signal) {
      direction = 'UP';
      strength = Math.min(currentRSI / 30, 1);
    } else if (currentPrice < currentSMA && currentMACD.MACD < currentMACD.signal) {
      direction = 'DOWN';
      strength = Math.min((100 - currentRSI) / 30, 1);
    }
  }
  
  const support = Math.min(...closePrices.slice(-20));
  const resistance = Math.max(...closePrices.slice(-20));
  
  return {
    direction,
    strength,
    support,
    resistance
  };
}

export async function generateStrategy(
  trend: Trend,
  symbol: string,
  timeframe: string
): Promise<Omit<Strategy, 'id' | 'createdAt'>> {
  const riskFactor = 0.02; // 2% risk per trade
  const leverageRatio = 5; // 5x leverage
  
  if (trend.direction === 'SIDEWAYS') {
    throw new Error('No clear trend direction for strategy generation');
  }

  if (!trend.support || !trend.resistance) {
    throw new Error('Support and resistance levels are required for strategy generation');
  }

  const action = trend.direction === 'UP' ? 'BUY' : 'SELL';
  const price = action === 'BUY' ? trend.resistance : trend.support;
  const stopLoss = action === 'BUY' ? trend.support : trend.resistance;
  const priceMove = Math.abs(price - stopLoss);
  const takeProfit = action === 'BUY' ? price + priceMove * 2 : price - priceMove * 2;
  
  const quantity = (riskFactor * leverageRatio) / (priceMove / price);
  
  const parameters: StrategyParameters = {
    action,
    price: parseFloat(price.toFixed(8)),
    quantity: parseFloat(quantity.toFixed(8)),
    stopLoss: parseFloat(stopLoss.toFixed(8)),
    takeProfit: parseFloat(takeProfit.toFixed(8))
  };
  
  return {
    symbol,
    timeframe,
    parameters,
    confidence: trend.strength
  };
}
