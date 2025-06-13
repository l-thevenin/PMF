import express, { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import Binance from 'node-binance-api';
import { analyzeTrend, generateStrategy } from './analysis';
import { notifyMiguel } from './communication';

interface ServerConfig {
  port: number;
  prisma: PrismaClient;
  binanceConfig: {
    apiKey: string;
    apiSecret: string;
    test: boolean;
  };
}

export async function createServer(config: ServerConfig): Promise<express.Application> {
  const app = express();
  app.use(express.json());

  // CORS middleware for development
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    next();
  });

  const binance = new Binance().options({
    APIKEY: config.binanceConfig.apiKey,
    APISECRET: config.binanceConfig.apiSecret,
    test: config.binanceConfig.test
  });
  // Health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'diego', timestamp: new Date().toISOString() });
  });

  // Simple test endpoint
  app.get('/test', async (req: Request, res: Response) => {
    try {
      // Test database connection
      await config.prisma.$queryRaw`SELECT 1`;
      
      res.json({ 
        message: 'Diego service is working correctly',
        database: 'connected',
        binance: config.binanceConfig.test ? 'test mode' : 'live mode'
      });
    } catch (error) {
      res.status(500).json({ 
        error: 'Service check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
  const analyzeHandler = async (req: Request, res: Response): Promise<void> => {
    const { symbol, timeframe } = req.body;

    // Validation des paramètres
    if (!symbol || !timeframe) {
      res.status(400).json({ error: 'Missing required parameters: symbol and timeframe are required' });
      return;
    }

    // Validation du timeframe
    const validTimeframes = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w', '1M'];
    if (!validTimeframes.includes(timeframe)) {
      res.status(400).json({ error: 'Invalid timeframe' });
      return;
    }
    
    try {
      console.log(`Analyzing ${symbol} on ${timeframe} timeframe`);
      
      // Obtenir les données du marché
      const rawCandlesticks = await binance.candlesticks(symbol, timeframe);

      if (!rawCandlesticks || rawCandlesticks.length === 0) {
        res.status(400).json({ error: 'No market data available for the specified symbol/timeframe' });
        return;
      }

      // Adapter les données pour correspondre au type Candlestick attendu
      const candlesticks = rawCandlesticks.map((candle: any) => ({
        openTime: candle[0],
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5],
        closeTime: candle[6],
        quoteAssetVolume: candle[7],
        trades: candle[8],
        takerBuyBaseAssetVolume: candle[9],
        takerBuyQuoteAssetVolume: candle[10]
      }));

      // Analyser la tendance
      const trend = await analyzeTrend(candlesticks);
      
      // Générer une stratégie
      const strategy = await generateStrategy(trend, symbol, timeframe);
      
      // Sauvegarder la stratégie dans la base de données
      const savedStrategy = await config.prisma.strategy.create({
        data: {
          symbol,
          timeframe,
          parameters: JSON.stringify(strategy.parameters),
          confidence: strategy.confidence
        }
      });
      
      console.log(`Strategy created with ID: ${savedStrategy.id}`);
      
      // Notifier Miguel de la nouvelle stratégie
      try {
        await notifyMiguel({
          ...savedStrategy,
          parameters: JSON.parse(savedStrategy.parameters as string)
        });
        console.log(`Miguel notified successfully for strategy ${savedStrategy.id}`);
      } catch (miguelError) {
        console.error('Failed to notify Miguel, but strategy was saved:', miguelError);
        // Continue anyway as strategy was saved
      }
       
      res.json({
        ...savedStrategy,
        parameters: JSON.parse(savedStrategy.parameters as string)
      });
    } catch (error) {
      console.error('Error analyzing market:', error);
      res.status(500).json({ 
        error: 'Failed to analyze market',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  app.post('/analyze', analyzeHandler);
  app.post('/feedback', async (req: Request, res: Response): Promise<void> => {
    const { tradeId, profit, status } = req.body;
    
    if (!tradeId) {
      res.status(400).json({ error: 'Missing required parameter: tradeId' });
      return;
    }
    
    try {
      const updateData: any = {};
      if (profit !== undefined) updateData.profit = profit;
      if (status !== undefined) updateData.status = status;
      
      const updatedTrade = await config.prisma.trade.update({
        where: { id: tradeId },
        data: updateData
      });
      
      console.log(`Trade ${tradeId} updated with feedback:`, updateData);
      res.json(updatedTrade);
    } catch (error) {
      console.error('Error processing feedback:', error);
      res.status(500).json({ 
        error: 'Failed to process feedback',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  return app;
}
