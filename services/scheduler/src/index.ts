import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';

// Charger les variables d'environnement
dotenv.config();

interface SchedulerConfig {
  diegoUrl: string;
  cronPattern: string;
  enableScheduler: boolean;
  retryAttempts: number;
  retryDelayMs: number;
}

interface AnalysisResponse {
  success?: boolean;
  message?: string;
  id?: number;
  symbol?: string;
  timeframe?: string;
  parameters?: any;
  confidence?: number;
  createdAt?: string;
  error?: string;
}

class ScalpingScheduler {
  private config: SchedulerConfig;
  private isRunning: boolean = false;
  private stats = {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    lastRunTime: null as Date | null,
    lastSuccessTime: null as Date | null,
    lastErrorTime: null as Date | null,
    lastError: null as string | null
  };

  constructor() {
    this.config = {
      diegoUrl: process.env.DIEGO_URL || 'http://diego:3001',
      cronPattern: process.env.CRON_PATTERN || '0 * * * * *', // Toutes les 60 secondes
      enableScheduler: process.env.ENABLE_SCHEDULER !== 'false',
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      retryDelayMs: parseInt(process.env.RETRY_DELAY_MS || '5000')
    };

    this.log('Scheduler initialized with config:', this.config);
  }

  private log(message: string, ...args: any[]) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [SCHEDULER] ${message}`, ...args);
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async callDiegoAnalysis(): Promise<AnalysisResponse> {
    try {
      this.log('Calling Diego analysis endpoint...');      const response = await axios.post(`${this.config.diegoUrl}/analyze`, {
        symbol: 'BTCUSDT', // Symbole sans slash pour Binance API
        timeframe: '1m'
      }, {
        timeout: 30000, // 30 secondes de timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });

      this.log('Diego response:', response.status, response.data);
      return response.data as AnalysisResponse;
    } catch (error: any) {
      this.log('Error calling Diego:', error.message);
      
      if (error.response) {
        this.log('Diego error response:', error.response.status, error.response.data);        return {
          success: false,
          message: `Diego API error: ${error.response.status}`,
          error: error.response.data?.error || error.message
        };
      } else if (error.request) {
        return {
          success: false,
          message: 'Diego service unreachable',
          error: 'Network error or service down'
        };
      } else {
        return {
          success: false,
          message: 'Request setup error',
          error: error.message
        };
      }
    }
  }

  private async executeScalpingCycle(): Promise<void> {
    if (this.isRunning) {
      this.log('Previous cycle still running, skipping...');
      return;
    }

    this.isRunning = true;
    this.stats.totalRuns++;
    this.stats.lastRunTime = new Date();

    this.log(`Starting scalping cycle #${this.stats.totalRuns}`);

    let attempt = 0;
    let success = false;

    while (attempt < this.config.retryAttempts && !success) {
      attempt++;
      
      if (attempt > 1) {
        this.log(`Retry attempt ${attempt}/${this.config.retryAttempts}`);
        await this.sleep(this.config.retryDelayMs);
      }

      try {        const result = await this.callDiegoAnalysis();
        
        if (result.id) { // Diego retourne la stratégie avec un ID si succès
          this.stats.successfulRuns++;
          this.stats.lastSuccessTime = new Date();
          this.log('Scalping cycle completed successfully');
          
          if (result.parameters) {
            this.log('Strategy parameters:', JSON.stringify(result.parameters, null, 2));
          }
          
          this.log(`Strategy created with ID: ${result.id}, confidence: ${result.confidence}`);
          
          success = true;
        } else {
          this.log('Diego returned error:', result.message || 'Unknown error', result.error);
          
          if (attempt === this.config.retryAttempts) {
            this.stats.failedRuns++;
            this.stats.lastErrorTime = new Date();
            this.stats.lastError = result.error || result.message || 'Unknown error';
          }
        }
      } catch (error: any) {
        this.log('Unexpected error in scalping cycle:', error.message);
        
        if (attempt === this.config.retryAttempts) {
          this.stats.failedRuns++;
          this.stats.lastErrorTime = new Date();
          this.stats.lastError = error.message;
        }
      }
    }

    this.isRunning = false;
    this.logStats();
  }

  private logStats(): void {
    this.log('=== Scheduler Statistics ===');
    this.log(`Total runs: ${this.stats.totalRuns}`);
    this.log(`Successful runs: ${this.stats.successfulRuns}`);
    this.log(`Failed runs: ${this.stats.failedRuns}`);
    this.log(`Success rate: ${this.stats.totalRuns > 0 ? ((this.stats.successfulRuns / this.stats.totalRuns) * 100).toFixed(2) : 0}%`);
    this.log(`Last run: ${this.stats.lastRunTime?.toISOString() || 'Never'}`);
    this.log(`Last success: ${this.stats.lastSuccessTime?.toISOString() || 'Never'}`);
    
    if (this.stats.lastError) {
      this.log(`Last error: ${this.stats.lastError} (${this.stats.lastErrorTime?.toISOString()})`);
    }
    
    this.log('=========================');
  }

  public start(): void {
    if (!this.config.enableScheduler) {
      this.log('Scheduler is disabled via ENABLE_SCHEDULER=false');
      return;
    }

    this.log(`Starting scalping scheduler with pattern: ${this.config.cronPattern}`);
    this.log('This will trigger Diego analysis every 60 seconds');

    // Valider le pattern cron
    if (!cron.validate(this.config.cronPattern)) {
      this.log('ERROR: Invalid cron pattern:', this.config.cronPattern);
      return;
    }

    // Démarrer le scheduler
    cron.schedule(this.config.cronPattern, async () => {
      await this.executeScalpingCycle();
    }, {
      scheduled: true,
      timezone: "Europe/Paris" // Ajustez selon votre fuseau horaire
    });

    this.log('Scalping scheduler started successfully');
    
    // Afficher les statistiques toutes les 10 minutes
    cron.schedule('0 */10 * * * *', () => {
      this.logStats();
    });

    // Optionnel: exécuter immédiatement au démarrage
    if (process.env.RUN_ON_START === 'true') {
      this.log('Running initial scalping cycle...');
      setTimeout(() => this.executeScalpingCycle(), 2000);
    }
  }

  public getStats() {
    return { ...this.stats };
  }

  public stop(): void {
    this.log('Stopping scheduler...');
    // Note: node-cron ne fournit pas de méthode directe pour arrêter toutes les tâches
    // En production, vous pourriez vouloir implémenter une gestion plus sophistiquée
  }
}

// Gestion des signaux pour un arrêt propre
const scheduler = new ScalpingScheduler();

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, stopping scheduler...');
  scheduler.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, stopping scheduler...');
  scheduler.stop();
  process.exit(0);
});

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  scheduler.stop();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  scheduler.stop();
  process.exit(1);
});

// Démarrer le scheduler
scheduler.start();

export default ScalpingScheduler;
