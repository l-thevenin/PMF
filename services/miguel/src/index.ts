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
          
          // Créer un ordre OCO en utilisant la nouvelle API REST /api/v3/orderList/oco
          const timestamp = Date.now();
          
          // Paramètres pour la nouvelle API OCO
          const ocoParams = {
            symbol: strategy.symbol,
            side: 'SELL',
            quantity: adjustedOcoQuantity.toString(),
            // Ordre "above" = Take Profit (LIMIT_MAKER)
            aboveType: 'LIMIT_MAKER',
            abovePrice: takeProfit.toString(),
            // Ordre "below" = Stop Loss (STOP_LOSS_LIMIT)
            belowType: 'STOP_LOSS_LIMIT',
            belowPrice: stopLoss.toString(),
            belowStopPrice: stopLoss.toString(),
            belowTimeInForce: 'GTC',
            newOrderRespType: 'RESULT',
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
            'https://testnet.binance.vision/api/v3/orderList/oco',
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
              metadata: JSON.stringify({ 
                ocoOrderId: ocoResponse.orderListId,
                ocoOrders: ocoResponse.orders,
                stopLossPrice: stopLoss,
                takeProfitPrice: takeProfit
              })
            }
          });
          
          console.log(`✅ Buy trade executed with OCO protection at price: ${executedPrice}`);
          console.log(`🎯 OCO order will automatically handle stop loss at ${stopLoss} and take profit at ${takeProfit}`);
          
          // Démarrer uniquement la vérification du statut OCO
          startOCOStatusCheck(trade.id, {
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
          console.error('Failed to create OCO order:', ocoError);
          
          // En cas d'échec de l'ordre OCO, marquer le trade comme échoué
          await prisma.trade.update({
            where: { id: trade.id },
            data: { 
              status: 'FAILED',
              metadata: JSON.stringify({ 
                error: 'OCO_CREATION_FAILED',
                ocoError: ocoError instanceof Error ? ocoError.message : 'Unknown error'
              })
            }
          });
          
          return res.status(500).json({ 
            error: 'Failed to create OCO order',
            details: ocoError instanceof Error ? ocoError.message : 'Unknown error'
          });
        }
      } else {
        // Pas de SL/TP, juste marquer comme exécuté - aucune surveillance nécessaire
        await prisma.trade.update({
          where: { id: trade.id },
          data: { 
            status: 'EXECUTED',
            executionPrice: executedPrice,
            quantity: executedQuantity,
            holdingStartTime: new Date()
          }
        });
        
        console.log(`✅ Buy trade executed at price: ${executedPrice} (no SL/TP, no monitoring needed)`);
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
        message: stopLoss && takeProfit ? 'Buy order executed with Binance OCO protection' : 'Buy order executed (no SL/TP)'
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

// Fonction pour vérifier uniquement le statut des ordres OCO (pas de surveillance de prix)
function startOCOStatusCheck(tradeId: string, monitoringData: SellMonitoringData, ocoOrderId: string): void {
  console.log(`🎯 Starting OCO status check for trade ${tradeId}, OCO order ID: ${ocoOrderId}`);
  console.log(`📊 Binance OCO will automatically execute at SL: ${monitoringData.stopLoss} or TP: ${monitoringData.takeProfit}`);
  
  // Vérifier le statut de l'ordre OCO toutes les 30 secondes (pas besoin de plus fréquent)
  const ocoCheckInterval = 30000;
  
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
      console.log(`📊 OCO Status for ${tradeId}: ${orderStatus.listOrderStatus}`);
      
      if (orderStatus.listOrderStatus === 'ALL_DONE') {
        console.log(`✅ OCO order completed for trade ${tradeId} - Binance automatically executed SL or TP`);
        clearInterval(monitoringInterval);
        activeSellMonitorings.delete(tradeId);
        
        // Analyser les ordres exécutés pour déterminer la raison exacte
        const executedOrders = orderStatus.orderReports?.filter((order: any) => order.status === 'FILLED') || [];
        
        if (executedOrders.length > 0) {
          const executedOrder = executedOrders[0];
          const sellPrice = parseFloat(executedOrder.price);
          const sellQuantity = parseFloat(executedOrder.executedQty);
          
          // Déterminer la raison basée sur le type d'ordre exécuté
          let reason = 'UNKNOWN';
          if (executedOrder.type === 'LIMIT_MAKER') {
            reason = 'TAKE_PROFIT';
          } else if (executedOrder.type === 'STOP_LOSS_LIMIT') {
            reason = 'STOP_LOSS';
          }
          
          // Calculer le profit net
          const grossProfit = (sellPrice - monitoringData.buyPrice) * sellQuantity;
          const tradingFees = (monitoringData.buyPrice + sellPrice) * sellQuantity * 0.001;
          const netProfit = grossProfit - tradingFees;
          
          // Mettre à jour le trade avec les informations exactes
          await prisma.trade.update({
            where: { id: tradeId },
            data: { 
              status: 'SOLD',
              sellPrice: sellPrice,
              sellTime: new Date(),
              sellReason: reason,
              profit: Math.round(netProfit * 100) / 100,
              metadata: JSON.stringify({
                ocoOrderId: ocoOrderId,
                executedOrderId: executedOrder.orderId,
                grossProfit: Math.round(grossProfit * 100) / 100,
                tradingFees: Math.round(tradingFees * 100) / 100,
                executionType: 'BINANCE_OCO_AUTOMATIC'
              })
            }
          });
          
          console.log(`✅ OCO sell completed for ${tradeId}: ${netProfit.toFixed(4)} net profit, reason: ${reason}, price: ${sellPrice}`);
          
          // Envoyer le feedback détaillé à Diego
          await sendFeedbackToDiego(monitoringData.strategyId, tradeId, {
            buyPrice: monitoringData.buyPrice,
            sellPrice: sellPrice,
            quantity: sellQuantity,
            symbol: monitoringData.symbol,
            status: 'SOLD',
            profit: netProfit,
            reason: reason,
            executionType: 'BINANCE_OCO_AUTOMATIC'
          });
        }
      }
    } catch (error) {
      console.error(`Error checking OCO status for trade ${tradeId}:`, error);
      
      // En cas d'erreur répétée de l'API, juste logger (ne pas basculer vers surveillance manuelle)
      if (error instanceof Error && error.message.includes('Order does not exist')) {
        console.log(`❌ OCO order not found for trade ${tradeId} - may have been executed already`);
        clearInterval(monitoringInterval);
        activeSellMonitorings.delete(tradeId);
      }
    }
  }, ocoCheckInterval);
  
  // Timeout de sécurité - arrêter la vérification après la durée de holding
  const timeoutId = setTimeout(async () => {
    console.log(`⏰ Stopping OCO status check for trade ${tradeId} after ${monitoringData.holdingDurationMs}ms`);
    clearInterval(monitoringInterval);
    activeSellMonitorings.delete(tradeId);
    
    // Le trade devrait déjà être complété par l'OCO à ce stade
    console.log(`ℹ️ Trade ${tradeId} monitoring timeout - OCO should have handled the trade automatically`);
  }, monitoringData.holdingDurationMs);
  
  // Stocker l'ID du timeout pour pouvoir l'annuler si nécessaire
  activeSellMonitorings.set(tradeId, timeoutId);
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
  console.log('\nReceived SIGINT, stopping all OCO status checks...');
  activeSellMonitorings.forEach((timeoutId, tradeId) => {
    console.log(`Stopping OCO status check for trade ${tradeId}`);
    clearTimeout(timeoutId);
  });
  activeSellMonitorings.clear();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, stopping all OCO status checks...');
  activeSellMonitorings.forEach((timeoutId, tradeId) => {
    console.log(`Stopping OCO status check for trade ${tradeId}`);
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
    console.log('- Binance OCO automatic stop loss and take profit');
    console.log('- OCO status monitoring (no manual price surveillance)');
    console.log('- Real-time feedback to Diego');
  });
});
