import express from 'express';
import path from 'path';
import { PrismaClient } from '@prisma/client';

const app = express();
const PORT = process.env.PORT || 3002;
const prisma = new PrismaClient();

// Middleware
app.use(express.json());

// Enable CORS manually
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  next();
});

// Serve static files from React app
app.use(express.static(path.join(__dirname, '../frontend/build')));

// API Routes

// Get dashboard overview
app.get('/api/overview', async (req, res) => {
  try {
    const [totalStrategies, totalProfit, activeTrades, monitoredTrades] = await Promise.all([
      prisma.strategy.count(),
      prisma.trade.aggregate({
        _sum: { profit: true },
        where: { profit: { not: null } }
      }),
      prisma.trade.count({ where: { status: 'PENDING' } }),
      prisma.trade.count({ 
        where: { 
          status: 'EXECUTED',
          sellPrice: null // Trades en cours de surveillance
        } 
      })
    ]);

    res.json({
      totalStrategies,
      totalProfit: totalProfit._sum.profit || 0,
      activeTrades,
      monitoredTrades
    });
  } catch (error) {
    console.error('Error fetching overview:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent strategies
app.get('/api/strategies', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const page = parseInt(req.query.page as string) || 1;
    const offset = (page - 1) * limit;
    
    const [strategies, total] = await Promise.all([
      prisma.strategy.findMany({
        skip: offset,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.strategy.count()
    ]);

    res.json({
      data: strategies,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent trades
app.get('/api/trades', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const page = parseInt(req.query.page as string) || 1;
    const status = req.query.status as string;
    const offset = (page - 1) * limit;
    
    // Exclure les trades échoués par défaut
    const where = status 
      ? { status } 
      : { status: { notIn: ['FAILED', 'SELL_FAILED'] } };
    
    const [trades, total] = await Promise.all([
      prisma.trade.findMany({
        skip: offset,
        take: limit,
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          strategy: {
            select: {
              id: true,
              symbol: true,
              timeframe: true,
              confidence: true
            }
          }
        }
      }),
      prisma.trade.count({ where })
    ]);

    res.json({
      data: trades,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    });
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Dashboard server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
