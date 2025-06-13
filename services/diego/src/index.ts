import { PrismaClient } from '@prisma/client';
import { createServer } from './server';

async function start() {
  console.log('Starting Diego service...');
  
  const prisma = new PrismaClient();
  
  try {
    // Test database connection
    await prisma.$connect();
    console.log('Database connected successfully');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }
  
  const app = await createServer({
    port: parseInt(process.env.PORT || '3000'),
    prisma,
    binanceConfig: {
      apiKey: process.env.BINANCE_TEST_API_KEY || '',
      apiSecret: process.env.BINANCE_TEST_API_SECRET || '',
      test: true
    }
  });
  const PORT = parseInt(process.env.PORT || '3000');
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Diego service listening on port ${PORT}`);
  });
}

start().catch(console.error);
