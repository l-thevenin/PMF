import React, { useState, useEffect } from 'react';
import { Strategy } from '../services/api';

interface AllStrategiesPageProps {
  strategies?: Strategy[];
}

const AllStrategiesPage: React.FC<AllStrategiesPageProps> = ({ strategies = [] }) => {
  // Protection supplémentaire contre les valeurs undefined
  const safeStrategies = Array.isArray(strategies) ? strategies : [];
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const totalPages = Math.ceil(safeStrategies.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentStrategies = safeStrategies.slice(startIndex, endIndex);

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

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'Excellente';
    if (confidence >= 0.6) return 'Bonne';
    return 'Faible';
  };

  const getStrategyParams = (parameters: any) => {
    try {
      const params = typeof parameters === 'string' ? JSON.parse(parameters) : parameters;
      return {
        stopLoss: params.stopLoss,
        takeProfit: params.takeProfit,
        action: params.action,
        price: params.price
      };
    } catch {
      return { stopLoss: null, takeProfit: null, action: null, price: null };
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
        <h1 className="text-3xl font-bold text-gray-900">Toutes les Stratégies</h1>
        <p className="text-gray-600 mt-2">
          {safeStrategies.length} stratégies au total
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-md">
        <div className="divide-y divide-gray-200">
          {currentStrategies.map((strategy) => {
            const params = getStrategyParams(strategy.parameters);
            return (
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
                      <span className="text-xs text-gray-500">
                        ({getConfidenceLabel(strategy.confidence)})
                      </span>
                      {params.action && (
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          params.action === 'BUY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {params.action}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Créé le {formatDate(strategy.createdAt)}
                    </p>
                    {params.price && (
                      <div className="mt-2 text-sm text-gray-600">
                        <span>💰 Prix d'analyse: ${params.price.toFixed(4)}</span>
                      </div>
                    )}
                    {(params.stopLoss || params.takeProfit) && (
                      <div className="flex items-center space-x-4 mt-2 text-sm">
                        {params.stopLoss && (
                          <span className="text-red-600">
                            🛑 Stop Loss: ${params.stopLoss.toFixed(4)}
                          </span>
                        )}
                        {params.takeProfit && (
                          <span className="text-green-600">
                            🎯 Take Profit: ${params.takeProfit.toFixed(4)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Confiance</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {(strategy.confidence * 100).toFixed(1)}%
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {getConfidenceLabel(strategy.confidence)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-700">
                Affichage de {startIndex + 1} à {Math.min(endIndex, strategies.length)} sur {strategies.length} résultats
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

        {strategies.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            Aucune stratégie trouvée
          </div>
        )}
      </div>
    </div>
  );
};

export default AllStrategiesPage;
