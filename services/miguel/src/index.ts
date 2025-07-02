import express from 'express';
import { PrismaClient } from '@prisma/client';
import Binance from 'node-binance-api';
import { Strategy, StrategyParameters, Trade } from '@pmf/shared';
import axios from 'axios';
import crypto from 'crypto';

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

// Services URLs - Portfolio service removed for simplification

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
      // Ajuster la quantité selon les règles Binance
      const adjustedQuantity = await getAdjustedQuantity(strategy.symbol, quantity);
      
      // Exécuter l'achat sur Binance testnet
      console.log(`🛒 Executing BUY order: ${adjustedQuantity} ${strategy.symbol} at market price`);
      console.log(`📊 Strategy parameters - Stop Loss: ${stopLoss}, Take Profit: ${takeProfit}`);
      
      const buyOrder = await binance.marketBuy(strategy.symbol, adjustedQuantity);
      console.log('✅ Buy order executed on Binance testnet:', buyOrder);
      
      const executedPrice = parseFloat(buyOrder.fills[0].price) || price;
      const executedQuantity = parseFloat(buyOrder.executedQty) || adjustedQuantity;
      
      // Si on a des paramètres de stop loss et take profit, créer un ordre OCO
      if (stopLoss && takeProfit) {
        try {
          console.log(`🎯 Creating OCO order for automatic stop loss and take profit management`);
          console.log(`📊 OCO Parameters - SL: ${stopLoss}, TP: ${takeProfit}, Qty: ${executedQuantity}`);
          
          // Ajuster la quantité pour les ordres OCO selon les règles Binance
          const adjustedOcoQuantity = await getAdjustedQuantity(strategy.symbol, executedQuantity);
          
          console.log(`📊 Adjusted OCO quantity: ${executedQuantity} -> ${adjustedOcoQuantity}`);
          
          // Créer un ordre OCO en utilisant l'API REST directement avec la bonne signature
          const timestamp = Date.now();
          const ocoParams = {
            symbol: strategy.symbol,
            side: 'SELL',
            quantity: adjustedOcoQuantity.toString(),
            price: takeProfit.toString(),
            stopPrice: stopLoss.toString(),
            stopLimitPrice: stopLoss.toString(),
            stopLimitTimeInForce: 'GTC',
            timestamp: timestamp.toString()
          };

          // Créer la query string pour la signature
          const queryString = Object.entries(ocoParams)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join('&');
          
          const signature = crypto
            .createHmac('sha256', process.env.BINANCE_TEST_API_SECRET!)
            .update(queryString)
            .digest('hex');

          // Ajouter la signature
          const finalParams = { ...ocoParams, signature };

          const response = await axios.post(
            'https://testnet.binance.vision/api/v3/order/oco',
            new URLSearchParams(finalParams).toString(),
            {
              headers: {
                'X-MBX-APIKEY': process.env.BINANCE_TEST_API_KEY!,
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            }
          );

          const ocoResponse = response.data as any;
          console.log('✅ OCO order created successfully:', ocoResponse);
          
          // Mettre à jour le trade avec l'ID de l'ordre OCO
          await prisma.trade.update({
            where: { id: trade.id },
            data: { 
              status: 'EXECUTED',
              executionPrice: executedPrice,
              quantity: executedQuantity,
              holdingStartTime: new Date(),
              // Stocker l'ID de l'ordre OCO pour le suivi
              metadata: JSON.stringify({ ocoOrderId: ocoResponse.orderListId })
            }
          });
          
          console.log(`✅ Buy trade executed with OCO protection at price: ${executedPrice}`);
          
          // Démarrer uniquement la surveillance légère pour les ordres OCO
          startOCOMonitoring(trade.id, {
            symbol: strategy.symbol,
            buyPrice: executedPrice,
            quantity: executedQuantity,
            stopLoss,
            takeProfit,
            holdingDurationMs: holdingDurationMs || 60000,
            strategyId: strategy.id,
            buyTime: new Date()
          }, ocoResponse.orderListId);
          
        } catch (ocoError) {
          console.error('Failed to create OCO order, falling back to manual monitoring:', ocoError);
          
          // En cas d'échec de l'ordre OCO, revenir au système de surveillance manuel
          await prisma.trade.update({
            where: { id: trade.id },
            data: { 
              status: 'EXECUTED',
              executionPrice: executedPrice,
              quantity: executedQuantity,
              holdingStartTime: new Date()
            }
          });
          
          // Démarrer la surveillance automatique manuelle
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
        }
      } else {
        // Pas de SL/TP, utiliser le système de surveillance manuel avec limite de temps uniquement
        await prisma.trade.update({
          where: { id: trade.id },
          data: { 
            status: 'EXECUTED',
            executionPrice: executedPrice,
            quantity: executedQuantity,
            holdingStartTime: new Date()
          }
        });
        
        console.log(`✅ Buy trade executed at price: ${executedPrice} (no SL/TP, time-based only)`);
        
        // Démarrer la surveillance automatique pour la vente basée sur le temps
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
      }
      
      // Calculer les frais de trading (0.1%)
      const tradingFees = executedPrice * executedQuantity * 0.001;
      
      console.log(`💰 Trading fees calculated: ${tradingFees}`);
      
      // Envoyer le feedback d'achat à Diego
      await sendFeedbackToDiego(strategy.id, trade.id, {
        buyPrice: executedPrice,
        quantity: executedQuantity,
        symbol: strategy.symbol,
        status: 'BOUGHT'
      });
      
      res.json({
        ...trade,
        executionPrice: executedPrice,
        quantity: executedQuantity,
        status: 'EXECUTED',
        message: stopLoss && takeProfit ? 'Buy order executed with OCO protection' : 'Buy order executed with time-based monitoring'
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

// Fonction pour surveiller les ordres OCO
function startOCOMonitoring(tradeId: string, monitoringData: SellMonitoringData, ocoOrderId: string): void {
  console.log(`🎯 Starting OCO monitoring for trade ${tradeId}, OCO order ID: ${ocoOrderId}`);
  
  // Vérifier le statut de l'ordre OCO toutes les 10 secondes
  const ocoCheckInterval = 10000;
  
  const monitoringInterval = setInterval(async () => {
    try {
      // Utiliser l'API REST pour vérifier le statut de l'ordre OCO
      const timestamp = Date.now();
      const queryString = `orderListId=${ocoOrderId}&timestamp=${timestamp}`;
      const signature = crypto
        .createHmac('sha256', process.env.BINANCE_TEST_API_SECRET!)
        .update(queryString)
        .digest('hex');

      const response = await axios.get(
        `https://testnet.binance.vision/api/v3/orderList?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': process.env.BINANCE_TEST_API_KEY!
          }
        }
      );

      const orderStatus = response.data as any;
      
      if (orderStatus.listOrderStatus === 'ALL_DONE') {
        console.log(`✅ OCO order completed for trade ${tradeId}`);
        clearInterval(monitoringInterval);
        activeSellMonitorings.delete(tradeId);
        
        // Déterminer si c'était un stop loss ou take profit
        const executedOrders = orderStatus.orders.filter((order: any) => order.status === 'FILLED');
        
        if (executedOrders.length > 0) {
          const executedOrder = executedOrders[0];
          const sellPrice = parseFloat(executedOrder.price);
          const sellQuantity = parseFloat(executedOrder.executedQty);
          
          // Déterminer la raison de la vente
          const reason = sellPrice <= monitoringData.stopLoss! ? 'STOP_LOSS' : 'TAKE_PROFIT';
          
          // Calculer le profit
          const profit = (sellPrice - monitoringData.buyPrice) * sellQuantity;
          
          // Mettre à jour le trade
          await prisma.trade.update({
            where: { id: tradeId },
            data: { 
              status: 'SOLD',
              sellPrice: sellPrice,
              sellTime: new Date(), // Heure exacte de la vente
              sellReason: reason,
              profit: Math.round(profit * 100) / 100
            }
          });
          
          console.log(`✅ OCO sell completed for ${tradeId}: ${profit.toFixed(2)} profit, reason: ${reason}`);
          
          // Envoyer le feedback à Diego
          await sendFeedbackToDiego(monitoringData.strategyId, tradeId, {
            buyPrice: monitoringData.buyPrice,
            sellPrice: sellPrice,
            quantity: sellQuantity,
            symbol: monitoringData.symbol,
            status: 'SOLD',
            profit: profit,
            reason: reason
          });
        }
      }
    } catch (error) {
      console.error(`Error checking OCO status for trade ${tradeId}:`, error);
    }
  }, ocoCheckInterval);
  
  // Fallback: arrêter après la durée maximale de holding si l'OCO ne s'est pas exécuté
  const timeoutId = setTimeout(async () => {
    console.log(`⏰ OCO timeout reached for trade ${tradeId}, cancelling OCO and executing manual sell`);
    clearInterval(monitoringInterval);
    
    try {
      // Annuler l'ordre OCO avec l'API REST
      const timestamp = Date.now();
      const queryString = `symbol=${monitoringData.symbol}&orderListId=${ocoOrderId}&timestamp=${timestamp}`;
      const signature = crypto
        .createHmac('sha256', process.env.BINANCE_TEST_API_SECRET!)
        .update(queryString)
        .digest('hex');

      await axios.delete(
        `https://testnet.binance.vision/api/v3/orderList?${queryString}&signature=${signature}`,
        {
          headers: {
            'X-MBX-APIKEY': process.env.BINANCE_TEST_API_KEY!
          }
        }
      );
      console.log(`❌ OCO order cancelled for trade ${tradeId}`);
      
      // Exécuter une vente manuelle
      await executeSell(tradeId, monitoringData, 'TIME_LIMIT');
    } catch (error) {
      console.error(`Error handling OCO timeout for trade ${tradeId}:`, error);
    }
    
    activeSellMonitorings.delete(tradeId);
  }, monitoringData.holdingDurationMs);
  
  // Stocker l'ID du timeout
  activeSellMonitorings.set(tradeId, timeoutId);
}

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
    
    // Ajuster la quantité de vente selon les règles Binance
    const adjustedSellQuantity = await getAdjustedQuantity(monitoringData.symbol, monitoringData.quantity);
    
    // Exécuter la vente sur Binance testnet
    const sellOrder = await binance.marketSell(monitoringData.symbol, adjustedSellQuantity);
    console.log('✅ Sell order executed on Binance testnet:', sellOrder);
    
    const sellPrice = parseFloat(sellOrder.fills[0].price) || 0;
    const sellQuantity = parseFloat(sellOrder.executedQty) || adjustedSellQuantity;
    
    // Calculer les frais de trading (0.1%)
    const tradingFees = sellPrice * sellQuantity * 0.001;
    
    console.log(`💰 Sell trading fees calculated: ${tradingFees}`);
    
    // Calculer le profit/perte
    const profit = (sellPrice - monitoringData.buyPrice) * sellQuantity - (tradingFees * 2); // Frais d'achat et de vente
    
    // Mettre à jour le trade dans la base de données
    await prisma.trade.update({
      where: { id: tradeId },
      data: { 
        status: 'SOLD',
        sellPrice: sellPrice,
        sellTime: new Date(), // Heure exacte de la vente
        sellReason: reason,
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
      data: { 
        status: 'SELL_FAILED',
        sellTime: new Date(), // Heure de l'échec de vente
        sellReason: 'SELL_ERROR'
      }
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

// Helper function to get symbol info and adjust quantity
async function getAdjustedQuantity(symbol: string, quantity: number): Promise<number> {
  try {
    // Get exchange info for the symbol
    const exchangeInfo = await binance.exchangeInfo();
    const symbolInfo = exchangeInfo.symbols.find((s: any) => s.symbol === symbol);
    
    if (!symbolInfo) {
      console.warn(`Symbol ${symbol} not found in exchange info`);
      return quantity;
    }
    
    // Find LOT_SIZE filter
    const lotSizeFilter = symbolInfo.filters.find((f: any) => f.filterType === 'LOT_SIZE');
    
    if (lotSizeFilter) {
      const stepSize = parseFloat(lotSizeFilter.stepSize);
      const minQty = parseFloat(lotSizeFilter.minQty);
      
      // Adjust quantity to comply with step size
      let adjustedQty = Math.floor(quantity / stepSize) * stepSize;
      
      // Make sure it meets minimum quantity
      if (adjustedQty < minQty) {
        adjustedQty = minQty;
      }
      
      console.log(`📊 Quantity adjusted for ${symbol}: ${quantity} -> ${adjustedQty} (step: ${stepSize}, min: ${minQty})`);
      return adjustedQty;
    }
    
    return quantity;
  } catch (error) {
    console.error('Error getting exchange info:', error);
    return quantity;
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
