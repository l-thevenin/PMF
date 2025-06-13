import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { createServer } from '../services/diego/src/server';
import { Candlestick } from '@pmf/shared';

// Mock pour node-binance-api
jest.mock('node-binance-api', () => {
  return jest.fn().mockImplementation(() => ({
    options: () => ({
      candlesticks: jest.fn().mockResolvedValue([
        [
          1623456789000, // openTime
          "45000.00",    // open
          "46000.00",    // high
          "44000.00",    // low
          "45500.00",    // close
          "100.5",       // volume
          1623460389000, // closeTime
          "4572750.00",  // quoteAssetVolume
          150,           // trades
          "60.5",        // takerBuyBaseAssetVolume
          "2752875.00"   // takerBuyQuoteAssetVolume
        ]
      ])
    })
  }));
});

// Mock pour la communication avec Miguel
jest.mock('../services/diego/src/communication', () => ({
  notifyMiguel: jest.fn().mockResolvedValue(undefined)
}));

describe('Diego Service - /analyze Integration Tests', () => {
  let app: express.Application;
  let prisma: PrismaClient;

  beforeAll(async () => {
    // Initialiser une nouvelle instance de PrismaClient pour les tests    prisma = new PrismaClient();

    // Créer une instance du serveur avec la configuration de test
    app = await createServer({
      port: 3000,
      prisma,
      binanceConfig: {
        apiKey: 'test-key',
        apiSecret: 'test-secret',
        test: true
      }
    });
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await prisma.trade.deleteMany();
    await prisma.strategy.deleteMany();
  });

  afterAll(async () => {
    // Fermer la connexion Prisma après tous les tests
    await prisma.$disconnect();
  });

  describe('POST /analyze', () => {
    it('should analyze market data and create a strategy', async () => {
      const testData = {
        symbol: 'BTCUSDT',
        timeframe: '1h'
      };

      const response = await request(app)
        .post('/analyze')
        .send(testData)
        .expect(200);

      // Vérifier la structure de la réponse
      expect(response.body).toMatchObject({
        id: expect.any(String),
        symbol: 'BTCUSDT',
        timeframe: '1h',
        parameters: expect.any(String),
        confidence: expect.any(Number)
      });

      // Vérifier que la stratégie a été sauvegardée en base de données
      const savedStrategy = await prisma.strategy.findUnique({
        where: { id: response.body.id }
      });
      
      expect(savedStrategy).toBeTruthy();
      expect(savedStrategy?.symbol).toBe('BTCUSDT');
      expect(savedStrategy?.timeframe).toBe('1h');

      // Vérifier que les paramètres sont un JSON valide
      expect(() => JSON.parse(response.body.parameters)).not.toThrow();
      
      const parameters = JSON.parse(response.body.parameters);
      expect(parameters).toMatchObject({
        action: expect.stringMatching(/^(BUY|SELL)$/),
        price: expect.any(Number),
        quantity: expect.any(Number),
        stopLoss: expect.any(Number),
        takeProfit: expect.any(Number)
      });
    });

    it('should handle invalid symbol', async () => {
      const testData = {
        symbol: 'INVALID',
        timeframe: '1h'
      };

      const response = await request(app)
        .post('/analyze')
        .send(testData)
        .expect(500);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle missing parameters', async () => {
      const response = await request(app)
        .post('/analyze')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should handle invalid timeframe', async () => {
      const testData = {
        symbol: 'BTCUSDT',
        timeframe: 'invalid'
      };

      const response = await request(app)
        .post('/analyze')
        .send(testData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
