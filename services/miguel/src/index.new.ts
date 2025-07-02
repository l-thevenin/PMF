import express from 'express';
import { PrismaClient } from '@prisma/client';
import Binance from 'node-binance-api';
import { Strategy, StrategyParameters, Trade, TradeResult } from '@pmf/shared';
import axios from 'axios';
import fetch from 'node-fetch';

// Interface for Portfolio API responses
interface PortfolioCanBuyResponse {
  canBuy: boolean;
  reason?: string;
}

interface PortfolioCanSellResponse {
  canSell: boolean;
  reason?: string;
}

// Interface pour les données de surveillance de vente
interface SellMonitoringData {
  symbol: string;
  buyPrice: number;
  quantity: number;
  stopLoss?: number;
  takeProfit?: number;
  holdingDurationMs: number;
  strategyId: string;
  buyTime: Date;
}

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

// Map pour stocker les surveillances actives
const activeSellMonitorings = new Map<string, NodeJS.Timeout>();

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
  const { strategyId, holdingDurationMs } = req.body;
  
  if (!strategyId) {
    return res.status(400).json({ error: 'Missing required parameter: strategyId' });
  }
  
  try {
    console.log(`Executing strategy with ID: ${strategyId}, holding duration: ${holdingDurationMs}ms`);
    
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
    
    // Ne traiter que les signaux d'achat
    if (action !== 'BUY') {
      console.log(`Ignoring ${action} signal - only processing BUY signals`);
      return res.json({ message: 'Strategy ignored - only processing BUY signals' });
    }
    
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
      // Exécuter l'achat sur Binance testnet
      console.log(`🛒 Executing BUY order: ${quantity} ${strategy.symbol} at market price`);
      const buyOrder = await binance.marketBuy(strategy.symbol, quantity);
      console.log('✅ Buy order executed on Binance testnet:', buyOrder);
      
      const executedPrice = parseFloat(buyOrder.fills[0].price) || price;
      const executedQuantity = parseFloat(buyOrder.executedQty) || quantity;
      
      // Calculer les frais de trading (0.1%)
      const tradingFees = executedPrice * executedQuantity * 0.001;
      
      // Exécuter le trade dans le service Portfolio
      const portfolioResult = await executeTradeInPortfolio({
        symbol: strategy.symbol,
        type: 'BUY',
        quantity: executedQuantity,
        price: executedPrice,
        fees: tradingFees
      });
      
      if (!portfolioResult.success) {
        throw new Error(`Portfolio execution failed: ${portfolioResult.message}`);
      }
      
      // Mettre à jour le trade avec les informations d'exécution
      const updatedTrade = await prisma.trade.update({
        where: { id: trade.id },
        data: { 
          status: 'EXECUTED',
          executionPrice: executedPrice,
          quantity: executedQuantity
        }
      });

      console.log(`✅ Buy trade executed successfully at price: ${executedPrice}`);

      // Envoyer le feedback d'achat à Diego
      await sendFeedbackToDiego(strategy.id, trade.id, {
        buyPrice: executedPrice,
        quantity: executedQuantity,
        symbol: strategy.symbol,
        status: 'BOUGHT'
      });
      
      // Démarrer la surveillance automatique pour la vente
      startAutomaticSellMonitoring(trade.id, {
        symbol: strategy.symbol,
        buyPrice: executedPrice,
        quantity: executedQuantity,
        stopLoss,
        takeProfit,
        holdingDurationMs: holdingDurationMs || 60000,
        strategyId: strategy.id,
        buyTime: new Date()
      });
      
      res.json({
        ...updatedTrade,
        message: 'Buy order executed, automatic sell monitoring started'
      });
      
    } catch (error) {
      console.error('Error executing buy order:', error);
      
      // Mettre à jour le statut du trade en cas d'échec
      await prisma.trade.update({
        where: { id: trade.id },
        data: { status: 'FAILED' }
      });

      // Envoyer le feedback d'échec à Diego
      await sendFeedbackToDiego(strategy.id, trade.id, {
        buyPrice: price,
        quantity,
        symbol: strategy.symbol,
        status: 'FAILED'
      });
      
      res.status(500).json({ 
        error: 'Failed to execute buy trade',
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

// Fonction pour démarrer la surveillance automatique de vente
function startAutomaticSellMonitoring(tradeId: string, monitoringData: SellMonitoringData): void {
  console.log(`🕐 Starting automatic sell monitoring for trade ${tradeId}, holding duration: ${monitoringData.holdingDurationMs}ms`);
  
  // Vérifier le prix toutes les 5 secondes
  const priceCheckInterval = 5000;
  
  const monitoringInterval = setInterval(async () => {
    try {
      await checkSellConditions(tradeId, monitoringData);
    } catch (error) {
      console.error(`Error checking sell conditions for trade ${tradeId}:`, error);
    }
  }, priceCheckInterval);
  
  // Arrêter la surveillance après la durée de holding maximale
  const timeoutId = setTimeout(async () => {
    console.log(`⏰ Holding duration reached for trade ${tradeId}, executing time-based sell`);
    clearInterval(monitoringInterval);
    await executeSell(tradeId, monitoringData, 'TIME_LIMIT');
    activeSellMonitorings.delete(tradeId);
  }, monitoringData.holdingDurationMs);
  
  // Stocker l'ID du timeout pour pouvoir l'annuler si nécessaire
  activeSellMonitorings.set(tradeId, timeoutId);
}

// Fonction pour vérifier les conditions de vente
async function checkSellConditions(tradeId: string, monitoringData: SellMonitoringData): Promise<void> {
  try {
    // Obtenir le prix actuel depuis Binance
    const ticker = await binance.prices(monitoringData.symbol);
    const currentPrice = parseFloat(ticker[monitoringData.symbol]);
    
    if (!currentPrice) {
      console.error(`Failed to get current price for ${monitoringData.symbol}`);
      return;
    }
    
    const { buyPrice, stopLoss, takeProfit } = monitoringData;
    
    // Vérifier la condition de stop loss
    if (stopLoss && currentPrice <= stopLoss) {
      console.log(`🛑 Stop loss triggered for trade ${tradeId}: ${currentPrice} <= ${stopLoss}`);
      await executeSell(tradeId, monitoringData, 'STOP_LOSS');
      return;
    }
    
    // Vérifier la condition de take profit
    if (takeProfit && currentPrice >= takeProfit) {
      console.log(`🎯 Take profit triggered for trade ${tradeId}: ${currentPrice} >= ${takeProfit}`);
      await executeSell(tradeId, monitoringData, 'TAKE_PROFIT');
      return;
    }
    
    // Log périodique du prix actuel (toutes les 12 vérifications = 1 minute)
    if (Math.random() < 0.08) { // ~8% de chance de logger
      const pnl = ((currentPrice - buyPrice) / buyPrice * 100).toFixed(2);
      console.log(`📊 Price check for trade ${tradeId}: ${monitoringData.symbol} at ${currentPrice} (${pnl}% from buy price ${buyPrice})`);
    }
    
  } catch (error) {
    console.error(`Error checking price for trade ${tradeId}:`, error);
  }
}

// Fonction pour exécuter la vente
async function executeSell(tradeId: string, monitoringData: SellMonitoringData, reason: 'STOP_LOSS' | 'TAKE_PROFIT' | 'TIME_LIMIT'): Promise<void> {
  try {
    console.log(`💰 Executing sell for trade ${tradeId}, reason: ${reason}`);
    
    // Annuler la surveillance active
    const timeoutId = activeSellMonitorings.get(tradeId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      activeSellMonitorings.delete(tradeId);
    }
    
    // Exécuter la vente sur Binance testnet
    const sellOrder = await binance.marketSell(monitoringData.symbol, monitoringData.quantity);
    console.log('✅ Sell order executed on Binance testnet:', sellOrder);
    
    const sellPrice = parseFloat(sellOrder.fills[0].price) || 0;
    const sellQuantity = parseFloat(sellOrder.executedQty) || monitoringData.quantity;
    
    // Calculer les frais de trading (0.1%)
    const tradingFees = sellPrice * sellQuantity * 0.001;
    
    // Exécuter la vente dans le service Portfolio
    const portfolioResult = await executeTradeInPortfolio({
      symbol: monitoringData.symbol,
      type: 'SELL',
      quantity: sellQuantity,
      price: sellPrice,
      fees: tradingFees
    });
    
    if (!portfolioResult.success) {
      console.error(`Portfolio sell execution failed: ${portfolioResult.message}`);
    }
    
    // Calculer le profit/perte
    const profit = (sellPrice - monitoringData.buyPrice) * sellQuantity - (tradingFees * 2); // Frais d'achat et de vente
    
    // Mettre à jour le trade dans la base de données
    await prisma.trade.update({
      where: { id: tradeId },
      data: { 
        status: 'SOLD',
        profit: Math.round(profit * 100) / 100 // Arrondir à 2 décimales
      }
    });
    
    console.log(`✅ Sell trade completed for ${tradeId}: ${profit.toFixed(2)} profit, reason: ${reason}`);
    
    // Envoyer le feedback de vente à Diego
    await sendFeedbackToDiego(monitoringData.strategyId, tradeId, {
      buyPrice: monitoringData.buyPrice,
      sellPrice: sellPrice,
      quantity: sellQuantity,
      symbol: monitoringData.symbol,
      status: 'SOLD',
      profit: profit,
      reason: reason
    });
    
  } catch (error) {
    console.error(`Error executing sell for trade ${tradeId}:`, error);
    
    // Marquer le trade comme échoué
    await prisma.trade.update({
      where: { id: tradeId },
      data: { status: 'SELL_FAILED' }
    });
    
    // Envoyer le feedback d'échec à Diego
    await sendFeedbackToDiego(monitoringData.strategyId, tradeId, {
      buyPrice: monitoringData.buyPrice,
      quantity: monitoringData.quantity,
      symbol: monitoringData.symbol,
      status: 'SELL_FAILED'
    });
  }
}

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

async function sendFeedbackToDiego(strategyId: string, tradeId: string, feedbackData: any): Promise<void> {
  const diegoUrl = process.env.DIEGO_URL || 'http://diego:3000';
  try {
    console.log(`Sending feedback to Diego for trade ${tradeId}:`, feedbackData);
    await axios.post(`${diegoUrl}/feedback`, {
      strategyId,
      tradeId,
      ...feedbackData
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
      const data = await response.json() as PortfolioCanBuyResponse;
      return {
        allowed: data.canBuy,
        reason: data.reason
      };
    } else if (action === 'SELL') {
      const response = await fetch(`${PORTFOLIO_SERVICE_URL}/portfolio/can-sell/${symbol}?quantity=${quantity}`);
      const data = await response.json() as PortfolioCanSellResponse;
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

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, stopping all sell monitorings...');
  activeSellMonitorings.forEach((timeoutId, tradeId) => {
    console.log(`Stopping monitoring for trade ${tradeId}`);
    clearTimeout(timeoutId);
  });
  activeSellMonitorings.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, stopping all sell monitorings...');
  activeSellMonitorings.forEach((timeoutId, tradeId) => {
    console.log(`Stopping monitoring for trade ${tradeId}`);
    clearTimeout(timeoutId);
  });
  activeSellMonitorings.clear();
  process.exit(0);
});

const PORT = parseInt(process.env.PORT || '3001');

initializeService().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Miguel service listening on port ${PORT}`);
    console.log('Automatic trading system ready with:');
    console.log('- Buy signal processing');
    console.log('- Stop loss monitoring');
    console.log('- Take profit monitoring'); 
    console.log('- Time-based sell execution');
    console.log('- Real-time feedback to Diego');
  });
});
