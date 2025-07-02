import React from 'react';

interface WorkflowStatusProps {
  pedroStats?: {
    totalRuns: number;
    successfulRuns: number;
    failedRuns: number;
    lastRunTime: string | null;
    isActive: boolean;
  };
  activeTrades?: number;
  monitoredTrades?: number;
}

const WorkflowStatus: React.FC<WorkflowStatusProps> = ({ pedroStats, activeTrades = 0, monitoredTrades = 0 }) => {
  const successRate = pedroStats ? 
    (pedroStats.totalRuns > 0 ? ((pedroStats.successfulRuns / pedroStats.totalRuns) * 100).toFixed(1) : '0') 
    : '0';

  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white mb-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">🤖 Workflow Automatique PMF</h2>
          <p className="text-blue-100">Système de trading automatique en temps réel</p>
        </div>
        <div className="flex items-center space-x-2">
          <div className={`w-4 h-4 rounded-full ${pedroStats?.isActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
          <span className="text-sm font-medium">
            {pedroStats?.isActive ? 'En cours' : 'Arrêté'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Pedro Stats */}
        <div className="bg-white bg-opacity-20 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">📅</span>
            <h3 className="font-semibold">Pedro Scheduler</h3>
          </div>
          <div className="space-y-1 text-sm">
            <div>Cycles: {pedroStats?.totalRuns || 0}</div>
            <div>Succès: {successRate}%</div>
            <div className="text-xs opacity-90">
              {pedroStats?.lastRunTime ? 
                `Dernier: ${new Date(pedroStats.lastRunTime).toLocaleTimeString('fr-FR')}` 
                : 'Aucun cycle'}
            </div>
          </div>
        </div>

        {/* Diego Analysis */}
        <div className="bg-white bg-opacity-20 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">🧠</span>
            <h3 className="font-semibold">Diego Analyste</h3>
          </div>
          <div className="space-y-1 text-sm">
            <div>Analyses: {pedroStats?.successfulRuns || 0}</div>
            <div>Échecs: {pedroStats?.failedRuns || 0}</div>
            <div className="text-xs opacity-90">Analyse en continu</div>
          </div>
        </div>

        {/* Miguel Trading */}
        <div className="bg-white bg-opacity-20 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">💰</span>
            <h3 className="font-semibold">Miguel Trader</h3>
          </div>
          <div className="space-y-1 text-sm">
            <div>Trades actifs: {activeTrades}</div>
            <div>Surveillance: {monitoredTrades}</div>
            <div className="text-xs opacity-90">Trading automatique</div>
          </div>
        </div>

        {/* Auto-Sell System */}
        <div className="bg-white bg-opacity-20 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <span className="text-2xl mr-2">⚡</span>
            <h3 className="font-semibold">Vente Auto</h3>
          </div>
          <div className="space-y-1 text-sm">
            <div>Stop Loss ✓</div>
            <div>Take Profit ✓</div>
            <div className="text-xs opacity-90">Holding: 60s</div>
          </div>
        </div>
      </div>

      {/* Workflow Steps */}
      <div className="mt-6 pt-6 border-t border-white border-opacity-30">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white bg-opacity-30 rounded-full flex items-center justify-center mr-2">1</div>
              <span>Pedro demande analyse</span>
            </div>
            <span className="text-white opacity-60">→</span>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white bg-opacity-30 rounded-full flex items-center justify-center mr-2">2</div>
              <span>Diego analyse marché</span>
            </div>
            <span className="text-white opacity-60">→</span>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white bg-opacity-30 rounded-full flex items-center justify-center mr-2">3</div>
              <span>Miguel achète</span>
            </div>
            <span className="text-white opacity-60">→</span>
            <div className="flex items-center">
              <div className="w-8 h-8 bg-white bg-opacity-30 rounded-full flex items-center justify-center mr-2">4</div>
              <span>Vente auto</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowStatus;
