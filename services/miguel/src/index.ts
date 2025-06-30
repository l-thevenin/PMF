import express from 'express';
import { PrismaClient } from '@prisma/client';
import Binance from 'node-binance-api';
import { Strategy, StrategyParameters, Trade, TradeResult } from '@pmf/shared';
import axios from 'axios';
import fetch from 'node-fetch';

console.log('Starting Miguel service...');

const prisma = new PrismaClient();
const app = express();
app.use(express.json());

// Services URLs
const PORTFOLIO_SERVICE_URL = process.env.PORTFOLIO_SERVICE_URL || 'http://portfolio:3003';

// CORS middleware for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

const binance = new Binance().options({
  APIKEY: process.env.BINANCE_TEST_API_KEY,
  APISECRET: process.env.BINANCE_TEST_API_SECRET,
  test: true
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'miguel', timestamp: new Date().toISOString() });
});

// Simple test endpoint
app.get('/test', async (req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({ 
      message: 'Miguel service is working correctly',
      database: 'connected',
      binance: 'test mode'
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Service check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/execute-strategy', async (req, res) => {
  const { strategyId } = req.body;
  
  if (!strategyId) {
    return res.status(400).json({ error: 'Missing required parameter: strategyId' });
  }
  
  try {
    console.log(`Executing strategy with ID: ${strategyId}`);
    
    // Récupérer la stratégie depuis la base de données
    const strategy = await prisma.strategy.findUnique({
      where: { id: strategyId }
    });
    
    if (!strategy) {
      return res.status(404).json({ error: 'Strategy not found' });
    }

    console.log(`Found strategy for ${strategy.symbol}`);

    let params: StrategyParameters;
    try {
      params = typeof strategy.parameters === 'string' 
        ? JSON.parse(strategy.parameters) 
        : strategy.parameters as any;
    } catch (parseError) {
      console.error('Failed to parse strategy parameters:', parseError);
      return res.status(400).json({ error: 'Invalid strategy parameters format' });
    }

    const { action, price, quantity, stopLoss, takeProfit } = params;
    
    // Vérifier le portefeuille avant d'exécuter le trade
    const portfolioCheck = await checkPortfolioBeforeTrade(action, strategy.symbol, quantity, price);
    
    if (!portfolioCheck.allowed) {
      return res.status(400).json({ 
        error: 'Portfolio check failed',
        reason: portfolioCheck.reason || 'Unknown reason'
      });
    }

    // Créer un nouveau trade dans la base de données
    const trade = await prisma.trade.create({
      data: {
        strategyId: strategy.id,
        symbol: strategy.symbol,
        type: action,
        price,
        quantity,
        status: 'PENDING'
      }
    });
    
    console.log(`Created trade with ID: ${trade.id}`);
    
    try {
      // Au lieu de simulation, vraie exécution Binance
      if (action === 'BUY') {
        const order = await binance.marketBuy(strategy.symbol, quantity);
        console.log('Real Binance order executed:', order);
      } else {
        const order = await binance.marketSell(strategy.symbol, quantity);
        console.log('Real Binance order executed:', order);
      }
      
      // Calculer les frais de trading simulés (0.1%)
      const tradingFees = price * quantity * 0.001;
      
      // Exécuter le trade dans le service Portfolio
      console.log(`Executing trade in Portfolio service: ${action} ${quantity} ${strategy.symbol} at ${price}`);
      
      const portfolioResult = await executeTradeInPortfolio({
        symbol: strategy.symbol,
        type: action,
        quantity,
        price,
        fees: tradingFees
      });
      
      if (!portfolioResult.success) {
        throw new Error(`Portfolio execution failed: ${portfolioResult.message}`);
      }
      
      console.log(`Portfolio trade executed successfully. Profit: $${portfolioResult.profit?.toFixed(2) || 0}`);
      
      // Mettre à jour le statut du trade avec le profit calculé
      const updatedTrade = await prisma.trade.update({
        where: { id: trade.id },
        data: { 
          status: 'EXECUTED',
          executionPrice: price,
          profit: Math.round((portfolioResult.profit || 0) * 100) / 100 // Arrondir à 2 décimales
        }
      });

      console.log(`Trade executed successfully at price: ${price}, profit: $${portfolioResult.profit?.toFixed(2) || 0}`);

      // Envoyer le feedback à Diego
      await sendFeedbackToDiego(strategy.id, trade.id, 'EXECUTED');
      
      res.json(updatedTrade);
    } catch (error) {
      console.error('Error executing orders:', error);
      
      // Mettre à jour le statut du trade en cas d'échec
      const failedTrade = await prisma.trade.update({
        where: { id: trade.id },
        data: { status: 'FAILED' }
      });

      // Envoyer le feedback d'échec à Diego
      await sendFeedbackToDiego(strategy.id, trade.id, 'FAILED');
      
      res.status(500).json({ 
        error: 'Failed to execute trade',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  } catch (error) {
    console.error('Error executing strategy:', error);
    res.status(500).json({ 
      error: 'Failed to execute strategy',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper function to execute trade in Portfolio service
async function executeTradeInPortfolio(tradeData: {
  symbol: string;
  type: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  fees?: number;
}): Promise<TradeResult> {
  try {
    const response = await fetch(`${PORTFOLIO_SERVICE_URL}/portfolio/execute-trade`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(tradeData)
    });
    
    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Portfolio service error (${response.status}): ${errorData}`);
    }
    
    return await response.json() as TradeResult;
  } catch (error) {
    console.error('Error executing trade in portfolio:', error);
    throw error;
  }
}

async function sendFeedbackToDiego(strategyId: string, tradeId: string, status: string): Promise<void> {
  const diegoUrl = process.env.DIEGO_URL || 'http://diego:3000';
  try {
    console.log(`Sending feedback to Diego: ${status} for trade ${tradeId}`);
    await axios.post(`${diegoUrl}/feedback`, {
      strategyId,
      tradeId,
      status
    }, {
      timeout: 5000
    });
    console.log('Feedback sent successfully to Diego');
  } catch (error) {
    console.error('Error sending feedback to Diego:', error);
    // Don't throw error as this is not critical for the main operation
  }
}

// Fonction pour vérifier le portefeuille avant d'exécuter un trade
async function checkPortfolioBeforeTrade(action: string, symbol: string, quantity: number, price: number): Promise<{ allowed: boolean; reason?: string }> {
  try {
    if (action === 'BUY') {
      const amount = quantity * price;
      const response = await fetch(`${PORTFOLIO_SERVICE_URL}/portfolio/can-buy?amount=${amount}`);
      const data = await response.json();
      return {
        allowed: data.canBuy,
        reason: data.reason
      };
    } else if (action === 'SELL') {
      const response = await fetch(`${PORTFOLIO_SERVICE_URL}/portfolio/can-sell/${symbol}?quantity=${quantity}`);
      const data = await response.json();
      return {
        allowed: data.canSell,
        reason: data.reason
      };
    }
    
    return { allowed: false, reason: 'Unknown action' };
  } catch (error) {
    console.error('⚠️ [MIGUEL] Erreur vérification portefeuille:', error);
    return { allowed: false, reason: 'Portfolio check failed' };
  }
}

// Test database connection on startup
async function initializeService() {
  try {
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
}

const PORT = parseInt(process.env.PORT || '3001');

initializeService().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Miguel service listening on port ${PORT}`);
  });
});
