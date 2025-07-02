import React, { useState } from 'react';
import { Trade } from '../services/api';
import TradeChartModal from './TradeChartModal';

interface TradesTableProps {
  trades?: Trade[];
  onViewAll?: () => void;
}

const TradesTable: React.FC<TradesTableProps> = ({ trades = [], onViewAll }) => {
  // Protection supplémentaire contre les valeurs undefined
  const safeTrades = Array.isArray(trades) ? trades : [];
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price?: number) => {
    if (price === null || price === undefined) return '-';
    return `$${price.toFixed(4)}`;
  };

  const formatProfit = (profit?: number) => {
    if (profit === null || profit === undefined) return '-';
    const color = profit >= 0 ? 'text-green-600' : 'text-red-600';
    return <span className={color}>${profit.toFixed(2)}</span>;
  };

  const formatSellReason = (reason?: string) => {
    if (!reason) return '-';
    const reasonMap: { [key: string]: { label: string; icon: string; color: string } } = {
      'STOP_LOSS': { label: 'Stop Loss', icon: '🛑', color: 'text-red-600' },
      'TAKE_PROFIT': { label: 'Take Profit', icon: '🎯', color: 'text-green-600' },
      'TIME_LIMIT': { label: 'Time Limit', icon: '⏰', color: 'text-yellow-600' },
    };
    const config = reasonMap[reason] || { label: reason, icon: '', color: 'text-gray-600' };
    return (
      <span className={`${config.color} text-sm`}>
        {config.icon} {config.label}
      </span>
    );
  };

  // Fonction pour extraire les paramètres de stratégie (stop loss, take profit)
  const getStrategyParams = (trade: Trade) => {
    try {
      // Les paramètres peuvent être dans trade.strategy.parameters ou dans une autre propriété
      const params = trade.strategy?.parameters || (trade as any).parameters;
      if (typeof params === 'string') {
        return JSON.parse(params);
      }
      return params || {};
    } catch {
      return {};
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md mt-8">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Trades Récents</h3>
        <button 
          onClick={onViewAll}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          Voir tout →
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Symbole
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantité
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix d'Achat
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Prix de Vente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Raison de Vente
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Profit
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Graphique
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {safeTrades.map((trade) => (
              <tr key={trade.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(trade.createdAt)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{trade.symbol}</div>
                  <div className="text-sm text-gray-500">{trade.strategy.timeframe}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {trade.quantity.toFixed(6)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatPrice(trade.executionPrice)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatPrice(trade.sellPrice)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatSellReason(trade.sellReason)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {formatProfit(trade.profit)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => setSelectedTrade(trade)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                    title="Voir l'évolution du prix pendant ce trade"
                  >
                    📈 Voir graphique
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {safeTrades.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucun trade trouvé
          </div>
        )}
      </div>
      
      {/* Modal pour afficher le graphique du trade */}
      {selectedTrade && (
        <TradeChartModal
          trade={selectedTrade}
          onClose={() => setSelectedTrade(null)}
          stopLoss={getStrategyParams(selectedTrade).stopLoss}
          takeProfit={getStrategyParams(selectedTrade).takeProfit}
        />
      )}
    </div>
  );
};

export default TradesTable;
