import React from 'react';
import { Strategy } from '../services/api';

interface StrategiesListProps {
  strategies: Strategy[];
}

const StrategiesList: React.FC<StrategiesListProps> = ({ strategies }) => {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('fr-FR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Stratégies Récentes</h3>
      </div>
      <div className="divide-y divide-gray-200">
        {strategies.map((strategy) => (
          <div key={strategy.id} className="p-6 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <h4 className="text-sm font-medium text-gray-900">
                    {strategy.symbol} - {strategy.timeframe}
                  </h4>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getConfidenceColor(strategy.confidence)}`}>
                    {(strategy.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Créé le {formatDate(strategy.createdAt)}
                </p>
                <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
                  <span>{strategy.tradesCount} trades</span>
                  <span>{strategy.successfulTrades} réussis</span>
                  <span className={strategy.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                    ${strategy.totalProfit.toFixed(2)} profit
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-gray-500">Taux de réussite</div>
                <div className="text-lg font-semibold text-gray-900">
                  {strategy.tradesCount > 0 
                    ? ((strategy.successfulTrades / strategy.tradesCount) * 100).toFixed(1)
                    : '0'
                  }%
                </div>
              </div>
            </div>
          </div>
        ))}
        {strategies.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Aucune stratégie trouvée
          </div>
        )}
      </div>
    </div>
  );
};

export default StrategiesList;
