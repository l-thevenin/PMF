// Service pour récupérer les données de prix depuis l'API Binance
export interface BinanceKline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export interface PriceData {
  timestamp: number;
  price: number;
  time: string;
}

export const binanceApi = {
  /**
   * Récupère les données de prix historiques depuis Binance
   * @param symbol - Le symbole (ex: BTCUSDT)
   * @param startTime - Timestamp de début
   * @param endTime - Timestamp de fin
   * @param interval - Intervalle (1m, 5m, 15m, etc.)
   */
  async getKlines(
    symbol: string, 
    startTime: number, 
    endTime: number, 
    interval: string = '1m'
  ): Promise<PriceData[]> {
    try {
      // API Binance publique pour les klines
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Binance API error: ${response.status}`);
      }
      
      const klines: any[][] = await response.json();
      
      // Convertir les données Binance en format utilisable
      return klines.map((kline) => ({
        timestamp: kline[0],
        price: parseFloat(kline[4]), // Prix de fermeture
        time: new Date(kline[0]).toLocaleTimeString('fr-FR'),
      }));
    } catch (error) {
      console.error('Error fetching Binance data:', error);
      throw error;
    }
  },

  /**
   * Récupère les données de prix pour la durée d'un trade
   * @param symbol - Le symbole du trade
   * @param tradeStartTime - Début du trade
   * @param tradeEndTime - Fin du trade (optionnel, utilise l'heure actuelle si absent)
   */
  async getTradeChartData(
    symbol: string,
    tradeStartTime: string,
    tradeEndTime?: string
  ): Promise<PriceData[]> {
    const startTime = new Date(tradeStartTime).getTime();
    const endTime = tradeEndTime ? new Date(tradeEndTime).getTime() : Date.now();
    
    // Ajouter une marge de 5 minutes avant le trade pour contexte
    const marginMs = 5 * 60 * 1000; // 5 minutes
    const adjustedStartTime = startTime - marginMs;
    
    // Choisir l'intervalle basé sur la durée du trade
    const durationMs = endTime - startTime;
    let interval = '1m';
    
    if (durationMs > 4 * 60 * 60 * 1000) { // Plus de 4 heures
      interval = '5m';
    } else if (durationMs > 24 * 60 * 60 * 1000) { // Plus de 24 heures
      interval = '15m';
    }
    
    return this.getKlines(symbol, adjustedStartTime, endTime, interval);
  }
};
