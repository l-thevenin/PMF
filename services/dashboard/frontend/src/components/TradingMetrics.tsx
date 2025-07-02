import React from 'react';
import { Trade } from '../services/api';

interface TradingMetricsProps {
  trades: Trade[];
}

const TradingMetrics: React.FC<TradingMetricsProps> = ({ trades }) => {
  // Calculer les métriques en temps réel
  const completedTrades = trades.filter(t => t.status === 'SOLD');
  const activeTrades = trades.filter(t => t.status === 'EXECUTED');
  const failedTrades = trades.filter(t => t.status === 'FAILED' || t.status === 'SELL_FAILED');
  
  // Calcul simple du profit : prix de vente - prix d'achat
  const totalProfit = completedTrades.reduce((sum, trade) => {
    if (trade.executionPrice && trade.sellPrice) {
      return sum + ((trade.sellPrice - trade.executionPrice) * trade.quantity);
    }
    return sum;
  }, 0);
  
  const averageProfit = completedTrades.length > 0 ? totalProfit / completedTrades.length : 0;
  const successRate = trades.length > 0 ? (completedTrades.length / trades.length) * 100 : 0;
  
  // Répartition des raisons de vente
  const sellReasons = completedTrades.reduce((acc, trade) => {
    const reason = trade.sellReason || 'UNKNOWN';
    acc[reason] = (acc[reason] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Symboles les plus tradés
  const symbolStats = trades.reduce((acc, trade) => {
    acc[trade.symbol] = (acc[trade.symbol] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const topSymbols = Object.entries(symbolStats)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Métriques principales */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Métriques de Trading</h3>
        
        <div className="space-y-4">
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Profit Total</span>
            <span className={`text-lg font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${totalProfit.toFixed(2)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Profit Moyen</span>
            <span className={`text-lg font-bold ${averageProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${averageProfit.toFixed(2)}
            </span>
          </div>
          
          <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
            <span className="text-sm font-medium text-gray-600">Taux de Réussite</span>
            <span className="text-lg font-bold text-blue-600">
              {successRate.toFixed(1)}%
            </span>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="p-2 bg-blue-50 rounded">
              <div className="font-semibold text-blue-600">{activeTrades.length}</div>
              <div className="text-gray-600">Actifs</div>
            </div>
            <div className="p-2 bg-green-50 rounded">
              <div className="font-semibold text-green-600">{completedTrades.length}</div>
              <div className="text-gray-600">Complétés</div>
            </div>
            <div className="p-2 bg-red-50 rounded">
              <div className="font-semibold text-red-600">{failedTrades.length}</div>
              <div className="text-gray-600">Échoués</div>
            </div>
          </div>
        </div>
      </div>

      {/* Raisons de vente */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Raisons de Vente</h3>
        
        <div className="space-y-3">
          {Object.entries(sellReasons).map(([reason, count]) => {
            const percentage = completedTrades.length > 0 ? (count / completedTrades.length) * 100 : 0;
            const icon = reason === 'TAKE_PROFIT' ? '🎯' : reason === 'STOP_LOSS' ? '🛑' : reason === 'TIME_LIMIT' ? '⏰' : '❓';
            const color = reason === 'TAKE_PROFIT' ? 'bg-green-500' : reason === 'STOP_LOSS' ? 'bg-red-500' : 'bg-yellow-500';
            
            return (
              <div key={reason} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{icon}</span>
                  <span className="text-sm font-medium text-gray-700">
                    {reason.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${color}`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-12 text-right">
                    {count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        
        {completedTrades.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            Aucune vente complétée pour le moment
          </div>
        )}
      </div>

      {/* Top Symboles */}
      <div className="bg-white rounded-lg shadow-md p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Symboles les Plus Tradés</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {topSymbols.map(([symbol, count], index) => {
            const symbolTrades = trades.filter(t => t.symbol === symbol);
            const symbolProfit = symbolTrades
              .filter(t => t.status === 'SOLD')
              .reduce((sum, trade) => {
                if (trade.executionPrice && trade.sellPrice) {
                  return sum + ((trade.sellPrice - trade.executionPrice) * trade.quantity);
                }
                return sum;
              }, 0);
            
            return (
              <div key={symbol} className="text-center p-4 bg-gray-50 rounded-lg">
                <div className="text-2xl mb-2">
                  {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '📈'}
                </div>
                <div className="font-semibold text-gray-900">{symbol}</div>
                <div className="text-sm text-gray-600">{count} trades</div>
                <div className={`text-sm font-medium ${symbolProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ${symbolProfit.toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
        
        {topSymbols.length === 0 && (
          <div className="text-center text-gray-500 py-4">
            Aucun trade pour le moment
          </div>
        )}
      </div>
    </div>
  );
};

export default TradingMetrics;
