import React, { useState } from 'react';
import { Trade } from '../services/api';
import TradeChartModal from './TradeChartModal';

interface AllTradesPageProps {
  trades?: Trade[];
}

const AllTradesPage: React.FC<AllTradesPageProps> = ({ trades = [] }) => {
  // Protection supplémentaire contre les valeurs undefined
  const safeTrades = Array.isArray(trades) ? trades : [];
  
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const itemsPerPage = 15;
  
  const totalPages = Math.ceil(safeTrades.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentTrades = safeTrades.slice(startIndex, endIndex);

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

  const goToPage = (page: number) => {
    setCurrentPage(page);
  };

  const goToPrevious = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNext = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Tous les Trades</h1>
        <p className="text-gray-600 mt-2">
          {safeTrades.length} trades au total
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
              {currentTrades.map((trade) => (
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
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Affichage de {startIndex + 1} à {Math.min(endIndex, safeTrades.length)} sur {safeTrades.length} résultats
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={goToPrevious}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Précédent
                </button>
                
                {/* Page numbers */}
                <div className="flex space-x-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-2 text-sm font-medium rounded-md ${
                        currentPage === page
                          ? 'bg-blue-600 text-white'
                          : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={goToNext}
                  disabled={currentPage === totalPages}
                  className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Suivant
                </button>
              </div>
            </div>
          </div>
        )}

        {safeTrades.length === 0 && (
          <div className="text-center py-12 text-gray-500">
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

export default AllTradesPage;
