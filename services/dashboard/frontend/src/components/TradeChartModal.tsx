import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { binanceApi, PriceData } from '../services/binanceApi';

interface Trade {
  id: string;
  symbol: string;
  createdAt: string;
  holdingStartTime?: string;
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

        // Utiliser holdingStartTime ou createdAt comme début
        const startTime = trade.holdingStartTime || trade.createdAt;
        // Si le trade est terminé (SOLD), utiliser une estimation de fin, sinon utiliser maintenant
        const endTime = trade.status === 'SOLD' ? undefined : undefined; // laisser undefined pour "maintenant"

        const data = await binanceApi.getTradeChartData(trade.symbol, startTime, endTime);
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
    return value; // déjà formaté par binanceApi
  };

  // Calculer les points d'achat et de vente
  const buyPoint = trade.executionPrice;
  const sellPoint = trade.sellPrice;

  // Trouver les prix min/max pour ajuster l'échelle
  const prices = priceData.map(d => d.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice;
  const padding = priceRange * 0.1; // 10% de padding

  const yDomainMin = Math.max(0, minPrice - padding);
  const yDomainMax = maxPrice + padding;

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
                Trade du {new Date(trade.createdAt).toLocaleString('fr-FR')}
                {trade.executionPrice && ` • Acheté à $${trade.executionPrice.toFixed(4)}`}
                {trade.sellPrice && ` • Vendu à $${trade.sellPrice.toFixed(4)}`}
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
                    <span className="text-sm">Prix du marché</span>
                  </div>
                  {buyPoint && (
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-green-500 mr-2"></div>
                      <span className="text-sm">Prix d'achat (${buyPoint.toFixed(4)})</span>
                    </div>
                  )}
                  {sellPoint && (
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-purple-500 mr-2"></div>
                      <span className="text-sm">Prix de vente (${sellPoint.toFixed(4)})</span>
                    </div>
                  )}
                  {stopLoss && (
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-red-500 mr-2"></div>
                      <span className="text-sm">Stop Loss (${stopLoss.toFixed(4)})</span>
                    </div>
                  )}
                  {takeProfit && (
                    <div className="flex items-center">
                      <div className="w-4 h-0.5 bg-green-600 mr-2"></div>
                      <span className="text-sm">Take Profit (${takeProfit.toFixed(4)})</span>
                    </div>
                  )}
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
                      
                      {/* Lignes de référence */}
                      {buyPoint && (
                        <ReferenceLine 
                          y={buyPoint} 
                          stroke="#10b981" 
                          strokeDasharray="5 5"
                          strokeWidth={2}
                        />
                      )}
                      {sellPoint && (
                        <ReferenceLine 
                          y={sellPoint} 
                          stroke="#8b5cf6" 
                          strokeDasharray="5 5"
                          strokeWidth={2}
                        />
                      )}
                      {stopLoss && (
                        <ReferenceLine 
                          y={stopLoss} 
                          stroke="#ef4444" 
                          strokeDasharray="8 4"
                          strokeWidth={2}
                        />
                      )}
                      {takeProfit && (
                        <ReferenceLine 
                          y={takeProfit} 
                          stroke="#059669" 
                          strokeDasharray="8 4"
                          strokeWidth={2}
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
