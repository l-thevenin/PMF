import axios from 'axios';
import type { Strategy } from '@pmf/shared';

const MIGUEL_SERVICE_URL = process.env.MIGUEL_SERVICE_URL || 'http://miguel:3001';

export async function notifyMiguel(strategy: Strategy): Promise<void> {
  try {
    console.log(`Notifying Miguel about strategy ${strategy.id} for ${strategy.symbol}`);
    
    const response = await axios.post(`${MIGUEL_SERVICE_URL}/execute-strategy`, 
      { strategyId: strategy.id },
      { 
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
      console.log('Miguel notification successful:', response.status);
  } catch (error) {
    console.error('Failed to notify Miguel:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
    }
    throw error;
  }
}
