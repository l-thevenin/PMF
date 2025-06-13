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
    const [totalStrategies, totalTrades, successfulTrades, totalProfit] = await Promise.all([
      prisma.strategy.count(),
      prisma.trade.count(),
      prisma.trade.count({ where: { status: 'EXECUTED' } }),
      prisma.trade.aggregate({
        _sum: { profit: true },
        where: { profit: { not: null } }
      })
    ]);

    const successRate = totalTrades > 0 ? (successfulTrades / totalTrades) * 100 : 0;

    res.json({
      totalStrategies,
      totalTrades,
      successfulTrades,
      successRate: Math.round(successRate * 100) / 100,
      totalProfit: totalProfit._sum.profit || 0
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
    const strategies = await prisma.strategy.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        trades: {
          select: {
            id: true,
            status: true,
            profit: true
          }
        }
      }
    });    const strategiesWithStats = strategies.map((strategy: any) => ({
      ...strategy,
      tradesCount: strategy.trades.length,
      successfulTrades: strategy.trades.filter((t: any) => t.status === 'EXECUTED').length,
      totalProfit: strategy.trades.reduce((sum: number, trade: any) => sum + (trade.profit || 0), 0)
    }));

    res.json(strategiesWithStats);
  } catch (error) {
    console.error('Error fetching strategies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get recent trades
app.get('/api/trades', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    
    const where = status ? { status } : {};
    
    const trades = await prisma.trade.findMany({
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
    });

    res.json(trades);
  } catch (error) {
    console.error('Error fetching trades:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get performance statistics
app.get('/api/performance', async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trades = await prisma.trade.findMany({
      where: {
        createdAt: { gte: startDate }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group trades by day
    const dailyStats = trades.reduce((acc: Record<string, any>, trade: any) => {
      const date = trade.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = {
          date,
          trades: 0,
          successful: 0,
          profit: 0
        };
      }
      acc[date].trades += 1;
      if (trade.status === 'EXECUTED') {
        acc[date].successful += 1;
      }
      acc[date].profit += trade.profit || 0;
      return acc;
    }, {} as Record<string, any>);

    res.json(Object.values(dailyStats));
  } catch (error) {
    console.error('Error fetching performance:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get trades by symbol
app.get('/api/trades-by-symbol', async (req, res) => {
  try {
    const trades = await prisma.trade.groupBy({
      by: ['symbol'],
      _count: { _all: true },
      _sum: { profit: true },
      _avg: { profit: true }
    });

    const symbolStats = trades.map((trade: any) => ({
      symbol: trade.symbol,
      count: trade._count._all,
      totalProfit: trade._sum.profit || 0,
      avgProfit: trade._avg.profit || 0
    }));

    res.json(symbolStats);
  } catch (error) {
    console.error('Error fetching trades by symbol:', error);
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
