import React from 'react';

interface Trade {
  id: string;
  symbol: string;
  type: string;
  status: string;
  price: number;
  executionPrice?: number;
  quantity: number;
  profit?: number;
  createdAt: string;
  holdingStartTime?: string;
  sellReason?: string;
}

interface LiveTradesMonitorProps {
  trades: Trade[];
  activeSellMonitorings?: string[];
}

const LiveTradesMonitor: React.FC<LiveTradesMonitorProps> = ({ trades, activeSellMonitorings = [] }) => {
  const activeTrades = trades.filter(t => t.status === 'EXECUTED' && !['SOLD', 'SELL_FAILED'].includes(t.status));
  const completedTrades = trades.filter(t => ['SOLD', 'SELL_FAILED'].includes(t.status));
  const failedTrades = trades.filter(t => t.status === 'FAILED');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING': return 'text-yellow-600 bg-yellow-100';
      case 'EXECUTED': return 'text-blue-600 bg-blue-100';
      case 'SOLD': return 'text-green-600 bg-green-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'SELL_FAILED': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'PENDING': return '⏳';
      case 'EXECUTED': return '🛒';
      case 'SOLD': return '💰';
      case 'FAILED': return '❌';
      case 'SELL_FAILED': return '⚠️';
      default: return '❓';
    }
  };

  const getSellReasonIcon = (reason?: string) => {
    switch (reason) {
      case 'STOP_LOSS': return '🛑';
      case 'TAKE_PROFIT': return '🎯';
      case 'TIME_LIMIT': return '⏰';
      default: return '';
    }
  };

  const formatDuration = (startTime: string) => {
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ${diffSec % 60}s`;
    const diffHour = Math.floor(diffMin / 60);
    return `${diffHour}h ${diffMin % 60}m`;
  };

  return (
    <div className="space-y-6">
      {/* Active Trades with Live Monitoring */}
      {activeTrades.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🕐 Trades en Surveillance Active</h3>
            <div className="ml-2 flex items-center">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-1"></div>
              <span className="text-sm text-gray-500">{activeTrades.length} surveillé(s)</span>
            </div>
          </div>
          
          <div className="grid gap-4">
            {activeTrades.map((trade) => (
              <div key={trade.id} className="border border-blue-200 rounded-lg p-4 bg-blue-50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-3">
                    <span className="text-2xl">🛒</span>
                    <div>
                      <span className="font-semibold text-gray-900">{trade.symbol}</span>
                      <span className="ml-2 text-sm text-gray-600">
                        Acheté à ${trade.executionPrice?.toFixed(4) || trade.price.toFixed(4)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-medium text-blue-600">
                      Surveillance: {trade.holdingStartTime ? formatDuration(trade.holdingStartTime) : 'En cours'}
                    </div>
                    <div className="text-xs text-gray-500">
                      Quantité: {trade.quantity}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-6 text-sm">
                  <div className="flex items-center">
                    <span className="text-red-500 mr-1">🛑</span>
                    <span>Stop Loss</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-green-500 mr-1">🎯</span>
                    <span>Take Profit</span>
                  </div>
                  <div className="flex items-center">
                    <span className="text-yellow-500 mr-1">⏰</span>
                    <span>Time Limit (60s)</span>
                  </div>
                  {activeSellMonitorings.includes(trade.id) && (
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse mr-1"></div>
                      <span className="text-green-600 font-medium">Monitoring actif</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently Completed Trades */}
      {completedTrades.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">✅ Trades Complétés Récemment</h3>
          
          <div className="space-y-3">
            {completedTrades.slice(0, 5).map((trade) => (
              <div key={trade.id} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{getStatusIcon(trade.status)}</span>
                  <div>
                    <span className="font-semibold text-gray-900">{trade.symbol}</span>
                    <div className="text-sm text-gray-600">
                      {trade.executionPrice?.toFixed(4)} → Vendu
                      {trade.sellReason && (
                        <span className="ml-2">
                          {getSellReasonIcon(trade.sellReason)} {trade.sellReason.replace('_', ' ')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-sm font-semibold ${
                    (trade.profit || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {trade.profit ? `$${trade.profit.toFixed(2)}` : '$0.00'}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(trade.createdAt).toLocaleTimeString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Failed Trades */}
      {failedTrades.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">❌ Trades Échoués</h3>
          
          <div className="space-y-2">
            {failedTrades.slice(0, 3).map((trade) => (
              <div key={trade.id} className="flex items-center justify-between p-2 border border-red-200 rounded bg-red-50">
                <div className="flex items-center space-x-2">
                  <span className="text-red-500">❌</span>
                  <span className="text-sm font-medium text-gray-900">{trade.symbol}</span>
                </div>
                <div className="text-xs text-gray-500">
                  {new Date(trade.createdAt).toLocaleTimeString('fr-FR')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LiveTradesMonitor;
