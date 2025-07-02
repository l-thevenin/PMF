import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { binanceApi, PriceData } from '../services/binanceApi';

interface Trade {
  id: string;
  symbol: string;
  createdAt: string;
  holdingStartTime?: string;
  sellTime?: string;
  executionPrice?: number;
  sellPrice?: number;
  sellReason?: string;
  status: string;
}

interface TradeChartModalProps {
  trade: Trade;
  onClose: () => void;
  stopLoss?: number;
  takeProfit?: number;
}

const TradeChartModal: React.FC<TradeChartModalProps> = ({ trade, onClose, stopLoss, takeProfit }) => {
  const [priceData, setPriceData] = useState<PriceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Utiliser holdingStartTime comme heure d'achat exacte
        const buyTime = trade.holdingStartTime || trade.createdAt;
        
        // Utiliser sellTime pour les trades terminés
        let sellTime = trade.sellTime;
        
        // Debug: Inspecter les données du trade
        console.log('Trade data:', {
          id: trade.id,
          status: trade.status,
          sellReason: trade.sellReason,
          sellPrice: trade.sellPrice,
          sellTime: trade.sellTime,
          buyTime: buyTime
        });
        
        // Si le trade est terminé mais qu'on n'a pas de sellTime, c'est un problème backend
        if (!sellTime && (trade.status === 'SOLD' || trade.status === 'SELL_FAILED')) {
          console.error('ERREUR: Trade terminé sans sellTime. Cela devrait être corrigé côté backend après migration de la DB.');
          // Temporairement, pour la compatibilité avec les anciens trades
          const buyTimeMs = new Date(buyTime).getTime();
          const estimatedSellTimeMs = buyTimeMs + (60 * 1000); // 60 secondes
          sellTime = new Date(estimatedSellTimeMs).toISOString();
        }
        
        console.log('Trade times:', {
          buyTime: new Date(buyTime).toLocaleString('fr-FR'),
          sellTime: sellTime ? new Date(sellTime).toLocaleString('fr-FR') : 'En cours',
          status: trade.status
        });

        const data = await binanceApi.getTradeChartData(trade.symbol, buyTime, sellTime);
        setPriceData(data);
      } catch (err) {
        console.error('Error fetching price data:', err);
        setError('Impossible de charger les données de prix');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [trade]);

  const formatTooltip = (value: any, name: string, props: any) => {
    if (name === 'price') {
      return [`$${parseFloat(value).toFixed(4)}`, 'Prix'];
    }
    return [value, name];
  };

  const formatXAxisLabel = (value: string) => {
    return value; // déjà formaté par binanceApi avec plus de précision
  };

  // Calculer les points d'achat et de vente
  const buyPoint = trade.executionPrice;
  const sellPoint = trade.sellPrice;

  // Calculer les informations temporelles du trade
  const buyTime = trade.holdingStartTime || trade.createdAt;
  let sellTime = trade.sellTime;
  
  // Si le trade est terminé mais qu'on n'a pas de sellTime, l'estimer
  if (!sellTime && (trade.status === 'SOLD' || trade.status === 'SELL_FAILED')) {
    const buyTimeMs = new Date(buyTime).getTime();
    const estimatedSellTimeMs = buyTimeMs + (60 * 1000); // 60 secondes
    sellTime = new Date(estimatedSellTimeMs).toISOString();
  }
  
  const buyDate = new Date(buyTime);
  const sellDate = sellTime ? new Date(sellTime) : null;
  
  const tradeDurationMs = sellDate ? sellDate.getTime() - buyDate.getTime() : Date.now() - buyDate.getTime();
  const tradeDurationSeconds = Math.round(tradeDurationMs / 1000);

  const formatTradeTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit', 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // Trouver les prix min/max pour ajuster l'échelle
  const prices = priceData.map((d: PriceData) => d.price);
  
  // S'assurer qu'il y a des données avant de calculer min/max
  if (prices.length === 0) {
    return null;
  }
  
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1; // 10% de padding

  // Inclure stop loss et take profit dans le calcul de l'échelle
  const allPrices = [...prices];
  if (stopLoss) allPrices.push(stopLoss);
  if (takeProfit) allPrices.push(takeProfit);
  if (buyPoint) allPrices.push(buyPoint);
  if (sellPoint) allPrices.push(sellPoint);

  const finalMinPrice = Math.min(...allPrices);
  const finalMaxPrice = Math.max(...allPrices);
  const finalRange = finalMaxPrice - finalMinPrice;
  const finalPadding = finalRange * 0.15; // 15% de padding pour bien voir les lignes

  const yDomainMin = Math.max(0, finalMinPrice - finalPadding);
  const yDomainMax = finalMaxPrice + finalPadding;

  // Vérifier si nous avons des données valides
  if (priceData.length === 0 && !loading && !error) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        {/* Overlay */}
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
        
        {/* Modal */}
        <div className="relative bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                📈 Évolution du prix - {trade.symbol}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                🕐 Achat: {formatTradeTime(buyTime)}
                {sellTime && (
                  <> • 🕐 Vente: {formatTradeTime(sellTime)}{!trade.sellTime && ' (estimée - ancienne donnée)'}</>
                )}
                {!sellTime && trade.status !== 'SOLD' && trade.status !== 'SELL_FAILED' && (
                  <> • ⏳ En cours</>
                )}
                <br />
                ⏱️ Durée: {tradeDurationSeconds}s
                {trade.status === 'SOLD' || trade.status === 'SELL_FAILED' ? ' (trade terminé)' : ' (en cours)'}
                {trade.executionPrice && ` • 💰 Acheté à $${trade.executionPrice.toFixed(4)}`}
                {trade.sellPrice && ` • 💸 Vendu à $${trade.sellPrice.toFixed(4)}`}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            {loading && (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Chargement des données de prix...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-600">
                  <p className="text-xl mb-2">⚠️</p>
                  <p>{error}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Réessayer
                  </button>
                </div>
              </div>
            )}

            {!loading && !error && priceData.length > 0 && (
              <>
                {/* Légende */}
                <div className="flex flex-wrap items-center gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-4 h-0.5 bg-blue-500 mr-2"></div>
                    <span className="text-sm">Prix du marché pendant le trade</span>
                  </div>
                  {stopLoss && (
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-red-500 mr-2" style={{borderStyle: 'dashed'}}></div>
                      <span className="text-sm">Stop Loss (${stopLoss.toFixed(4)})</span>
                    </div>
                  )}
                  {takeProfit && (
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-green-600 mr-2" style={{borderStyle: 'dashed'}}></div>
                      <span className="text-sm">Take Profit (${takeProfit.toFixed(4)})</span>
                    </div>
                  )}
                  <div className="text-xs text-gray-500">
                    ⏱️ Période exacte: {formatTradeTime(buyTime)} → {sellTime ? formatTradeTime(sellTime) : 'En cours'}
                    {sellTime && !trade.sellTime && ' (fin estimée)'}
                    {trade.status === 'SOLD' || trade.status === 'SELL_FAILED' ? ' • Trade terminé' : ' • Trade en cours'}
                  </div>
                </div>

                {/* Graphique */}
                <div className="h-96">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="time" 
                        tick={{ fontSize: 12 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis 
                        domain={[yDomainMin, yDomainMax]}
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${value.toFixed(4)}`}
                      />
                      <Tooltip 
                        formatter={formatTooltip}
                        labelStyle={{ color: '#374151' }}
                        contentStyle={{ 
                          backgroundColor: '#fff', 
                          border: '1px solid #d1d5db',
                          borderRadius: '6px'
                        }}
                      />
                      
                      {/* Ligne de prix principale */}
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                      
                      {/* Lignes de référence horizontales (prix seulement) */}
                      {stopLoss && (
                        <ReferenceLine 
                          y={stopLoss} 
                          stroke="#ef4444" 
                          strokeDasharray="8 4"
                          strokeWidth={2}
                          label={{ value: `Stop Loss: $${stopLoss.toFixed(4)}`, position: "insideBottomRight" }}
                        />
                      )}
                      {takeProfit && (
                        <ReferenceLine 
                          y={takeProfit} 
                          stroke="#059669" 
                          strokeDasharray="8 4"
                          strokeWidth={2}
                          label={{ value: `Take Profit: $${takeProfit.toFixed(4)}`, position: "insideTopRight" }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Statistiques */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Prix min</p>
                    <p className="font-semibold text-blue-600">${minPrice.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-sm text-gray-600">Prix max</p>
                    <p className="font-semibold text-blue-600">${maxPrice.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Variation</p>
                    <p className="font-semibold text-gray-700">${priceRange.toFixed(4)}</p>
                  </div>
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-600">Points de données</p>
                    <p className="font-semibold text-gray-700">{priceData.length}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeChartModal;
