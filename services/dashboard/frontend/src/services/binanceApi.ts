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
   * Récupère les données de prix pour la durée exacte d'un trade
   * Utilise les heures exactes d'achat et de vente comme bornes
   * @param symbol - Le symbole du trade
   * @param buyTime - Heure d'achat exacte (ISO string)
   * @param sellTime - Heure de vente exacte (ISO string, optionnel)
   */
  async getTradeChartData(
    symbol: string,
    buyTime: string,
    sellTime?: string
  ): Promise<PriceData[]> {
    const startTime = new Date(buyTime).getTime();
    const endTime = sellTime ? new Date(sellTime).getTime() : Date.now();
    
    console.log(`Fetching chart data for ${symbol}:`);
    console.log(`- Buy time: ${new Date(startTime).toLocaleString('fr-FR')}`);
    console.log(`- Sell time: ${sellTime ? new Date(endTime).toLocaleString('fr-FR') : 'En cours'}`);
    console.log(`- Trade duration: ${Math.round((endTime - startTime) / 1000)}s`);
    
    // Récupérer les données exactement sur la période du trade
    // Utiliser l'intervalle de 1 minute (minimum supporté par Binance)
    const interval = '1m';
    
    const allData = await this.getKlines(symbol, startTime, endTime, interval);
    
    // Filtrer pour ne garder que les données dans la période exacte du trade
    const filteredData = allData.filter(data => {
      return data.timestamp >= startTime && data.timestamp <= endTime;
    });
    
    console.log(`Filtered data: ${filteredData.length} points from ${allData.length} total`);
    
    return filteredData;
  }
};
