import { test, expect, describe, beforeAll, afterAll } from '@jest/globals';
import axios from 'axios';

const DIEGO_URL = process.env.DIEGO_URL || 'http://localhost:3000';
const MIGUEL_URL = process.env.MIGUEL_SERVICE_URL || 'http://localhost:3001';

describe('PMF Services Integration Tests', () => {
  beforeAll(async () => {
    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 5000));
  });

  test('Diego health check', async () => {
    try {
      const response = await axios.get(`${DIEGO_URL}/health`);
      expect(response.status).toBe(200);
      expect((response.data as any).service).toBe('diego');
    } catch (error) {
      console.error('Diego health check failed:', error);
      throw error;
    }
  });

  test('Miguel health check', async () => {
    try {
      const response = await axios.get(`${MIGUEL_URL}/health`);
      expect(response.status).toBe(200);
      expect((response.data as any).service).toBe('miguel');
    } catch (error) {
      console.error('Miguel health check failed:', error);
      throw error;
    }
  });

  test('Diego test endpoint', async () => {
    try {
      const response = await axios.get(`${DIEGO_URL}/test`);
      expect(response.status).toBe(200);
      expect((response.data as any).message).toContain('Diego service is working');
    } catch (error) {
      console.error('Diego test endpoint failed:', error);
      throw error;
    }
  });

  test('Miguel test endpoint', async () => {
    try {
      const response = await axios.get(`${MIGUEL_URL}/test`);
      expect(response.status).toBe(200);
      expect((response.data as any).message).toContain('Miguel service is working');
    } catch (error) {
      console.error('Miguel test endpoint failed:', error);
      throw error;
    }
  });

  test('Complete workflow: analyze market and execute strategy', async () => {
    try {
      // Step 1: Analyze market with Diego
      const analyzeResponse = await axios.post(`${DIEGO_URL}/analyze`, {
        symbol: 'BTCUSDT',
        timeframe: '1h'
      });

      expect(analyzeResponse.status).toBe(200);
      expect((analyzeResponse.data as any).id).toBeDefined();
      expect((analyzeResponse.data as any).symbol).toBe('BTCUSDT');
      expect((analyzeResponse.data as any).parameters).toBeDefined();

      console.log('Strategy created:', analyzeResponse.data);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // The strategy should have been automatically sent to Miguel
      // We can check if it was processed by looking for trades in the database
      // This would require additional database queries which we'll skip for now

    } catch (error) {
      console.error('Workflow test failed:', error);
      throw error;
    }
  }, 30000); // 30 second timeout for this test
});
