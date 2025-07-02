import React, { useState, useEffect } from 'react';
import { dashboardApi, Overview, Strategy, Trade, WorkflowStatus as WorkflowStatusData } from './services/api';
import OverviewCards from './components/OverviewCards';
import TradesTable from './components/TradesTable';
import StrategiesList from './components/StrategiesList';
import LiveTradesMonitor from './components/LiveTradesMonitor';
import AllStrategiesPage from './components/AllStrategiesPage';
import AllTradesPage from './components/AllTradesPage';
import './index.css';

function App() {
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'all-strategies' | 'all-trades'>('dashboard');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [allStrategies, setAllStrategies] = useState<Strategy[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [allTrades, setAllTrades] = useState<Trade[]>([]);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);

  const loadData = async () => {
    try {
      setError(null);
      const [overviewData, strategiesData, tradesData, workflowData] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getStrategies(5),
        dashboardApi.getTrades(15),
        dashboardApi.getWorkflowStatus().catch(() => null)
      ]);

      console.log('Loaded data:', { overviewData, strategiesData, tradesData, workflowData });
      
      setOverview(overviewData);
      setStrategies(strategiesData?.data || []);
      setTrades(tradesData?.data || []);
      setWorkflowStatus(workflowData);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadAllStrategies = async () => {
    try {
      const allStrategiesData = await dashboardApi.getStrategies(100);
      console.log('Loaded all strategies:', allStrategiesData);
      setAllStrategies(allStrategiesData?.data || []);
    } catch (err) {
      console.error('Error loading all strategies:', err);
    }
  };

  const loadAllTrades = async () => {
    try {
      const allTradesData = await dashboardApi.getTrades(100);
      console.log('Loaded all trades:', allTradesData);
      setAllTrades(allTradesData?.data || []);
    } catch (err) {
      console.error('Error loading all trades:', err);
    }
  };

  useEffect(() => {
    if (currentPage === 'dashboard') {
      loadData();
      
      // Refresh data every 30 seconds only on dashboard
      const interval = setInterval(loadData, 30000);
      setRefreshInterval(interval);

      return () => {
        clearInterval(interval);
        setRefreshInterval(null);
      };
    } else {
      // Clear interval when not on dashboard
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      
      if (currentPage === 'all-strategies') {
        loadAllStrategies();
      } else if (currentPage === 'all-trades') {
        loadAllTrades();
      }
    }
  }, [currentPage]); // Seule dépendance: currentPage

  const handleRefresh = () => {
    setLoading(true);
    if (currentPage === 'dashboard') {
      loadData();
    } else if (currentPage === 'all-strategies') {
      loadAllStrategies();
    } else if (currentPage === 'all-trades') {
      loadAllTrades();
    }
  };

  const navigateTo = (page: 'dashboard' | 'all-strategies' | 'all-trades') => {
    setCurrentPage(page);
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

  // Render different pages based on current page
  if (currentPage === 'all-strategies') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Retour au Dashboard
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Toutes les Stratégies</h1>
              </div>
            </div>
          </div>
        </header>
        <AllStrategiesPage strategies={allStrategies || []} />
      </div>
    );
  }

  if (currentPage === 'all-trades') {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Retour au Dashboard
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Tous les Trades</h1>
              </div>
            </div>
          </div>
        </header>
        <AllTradesPage trades={allTrades || []} />
      </div>
    );
  }

  // Default dashboard page
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

            {/* Live Trades Monitor */}
            <LiveTradesMonitor 
              trades={trades || []}
              activeSellMonitorings={workflowStatus?.activeSellMonitorings || []}
            />

            {/* Strategies */}
            <StrategiesList 
              strategies={strategies || []} 
              onViewAll={() => navigateTo('all-strategies')}
            />

            {/* Trades Table */}
            <TradesTable 
              trades={trades || []} 
              onViewAll={() => navigateTo('all-trades')}
            />
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
