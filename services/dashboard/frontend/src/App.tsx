import React, { useState, useEffect } from 'react';
import { dashboardApi, Overview, Strategy, Trade, PerformanceData } from './services/api';
import OverviewCards from './components/OverviewCards';
import PerformanceChart from './components/PerformanceChart';
import TradesTable from './components/TradesTable';
import StrategiesList from './components/StrategiesList';
import './index.css';

function App() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [performance, setPerformance] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [overviewData, strategiesData, tradesData, performanceData] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getStrategies(5),
        dashboardApi.getTrades(15),
        dashboardApi.getPerformance(7)
      ]);

      setOverview(overviewData);
      setStrategies(strategiesData);
      setTrades(tradesData);
      setPerformance(performanceData);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    
    // Refresh data every 30 seconds
    const interval = setInterval(loadData, 30000);
    setRefreshInterval(interval);

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    loadData();
  };

  if (loading && !overview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (error && !overview) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Erreur de connexion</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <h1 className="text-3xl font-bold text-gray-900">PMF Trading Dashboard</h1>
              <div className="ml-4 flex items-center space-x-2">
                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-sm text-gray-500">Live</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {error && (
                <div className="text-red-600 text-sm">
                  ⚠️ Erreur de synchronisation
                </div>
              )}
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded transition-colors"
              >
                {loading ? 'Actualisation...' : 'Actualiser'}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {overview && (
          <>
            {/* Overview Cards */}
            <OverviewCards overview={overview} />

            {/* Performance Chart */}
            {performance.length > 0 && (
              <PerformanceChart data={performance} />
            )}

            {/* Grid Layout for Strategies and Trades */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* Strategies */}
              <StrategiesList strategies={strategies} />

              {/* Recent Trades Summary */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Résumé des Trades</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Trades en cours</span>
                    <span className="text-lg font-semibold text-yellow-600">
                      {trades.filter(t => t.status === 'PENDING').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Trades exécutés</span>
                    <span className="text-lg font-semibold text-green-600">
                      {trades.filter(t => t.status === 'EXECUTED').length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Trades échoués</span>
                    <span className="text-lg font-semibold text-red-600">
                      {trades.filter(t => t.status === 'FAILED').length}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Profit total récent</span>
                      <span className={`text-lg font-semibold ${
                        trades.reduce((sum, t) => sum + (t.profit || 0), 0) >= 0 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        ${trades.reduce((sum, t) => sum + (t.profit || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Trades Table */}
            <TradesTable trades={trades} />
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              PMF Trading Bot Dashboard - Dernière mise à jour: {new Date().toLocaleTimeString('fr-FR')}
            </div>
            <div>
              Diego & Miguel en action 🤖
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
