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
  // Configuration dynamique selon le timeframe
  const timeframeConfig = getTimeframeConfig(timeframe);
  const riskFactor = timeframeConfig.riskFactor;
  const leverageRatio = timeframeConfig.leverageRatio;
  
  if (trend.direction === 'SIDEWAYS') {
    throw new Error(`No clear trend direction for strategy generation on ${symbol} (${timeframe})`);
  }

  // Ne générer que des stratégies d'achat (BUY)
  if (trend.direction === 'DOWN') {
    throw new Error(`No BUY opportunity detected - trend is DOWN on ${symbol} (${timeframe})`);
  }

  if (!trend.support || !trend.resistance) {
    throw new Error(`Support and resistance levels are required for strategy generation on ${symbol} (${timeframe})`);
  }

  const action = 'BUY'; // Toujours BUY
  const price = trend.resistance;
  const stopLoss = trend.support;
  const priceMove = Math.abs(price - stopLoss);
  
  // Ajuster le take profit selon le timeframe (toujours pour BUY)
  const takeProfitMultiplier = timeframeConfig.takeProfitMultiplier;
  const takeProfit = price + priceMove * takeProfitMultiplier;
  
  // Calculer la quantité selon le risque et le timeframe
  const quantity = (riskFactor * leverageRatio) / (priceMove / price);
  
  const parameters: StrategyParameters = {
    action,
    price: parseFloat(price.toFixed(8)),
    quantity: parseFloat(quantity.toFixed(8)),
    stopLoss: parseFloat(stopLoss.toFixed(8)),
    takeProfit: parseFloat(takeProfit.toFixed(8))
  };
  
  // Ajuster la confiance selon le timeframe et la force de la tendance
  const adjustedConfidence = Math.min(trend.strength * timeframeConfig.confidenceMultiplier, 1);
  
  return {
    symbol,
    timeframe,
    parameters,
    confidence: adjustedConfidence
  };
}

interface TimeframeConfig {
  riskFactor: number;
  leverageRatio: number;
  takeProfitMultiplier: number;
  confidenceMultiplier: number;
}

function getTimeframeConfig(timeframe: string): TimeframeConfig {
  switch (timeframe) {
    case '1m':
    case '3m':
      // Scalping rapide - risque plus élevé, profits plus petits
      return {
        riskFactor: 0.015, // 1.5% risk
        leverageRatio: 3,
        takeProfitMultiplier: 1.5,
        confidenceMultiplier: 0.8 // Moins de confiance sur les très courts termes
      };
    
    case '5m':
    case '15m':
      // Scalping standard
      return {
        riskFactor: 0.02, // 2% risk
        leverageRatio: 5,
        takeProfitMultiplier: 2,
        confidenceMultiplier: 1.0
      };
    
    case '30m':
    case '1h':
      // Trading intraday
      return {
        riskFactor: 0.025, // 2.5% risk
        leverageRatio: 4,
        takeProfitMultiplier: 2.5,
        confidenceMultiplier: 1.1
      };
    
    case '2h':
    case '4h':
      // Trading swing court
      return {
        riskFactor: 0.03, // 3% risk
        leverageRatio: 3,
        takeProfitMultiplier: 3,
        confidenceMultiplier: 1.2
      };
    
    default:
      // Timeframes plus longs - trading swing
      return {
        riskFactor: 0.035, // 3.5% risk
        leverageRatio: 2,
        takeProfitMultiplier: 4,
        confidenceMultiplier: 1.3 // Plus de confiance sur les timeframes longs
      };
  }
}
