import React from 'react';
import { Overview } from '../services/api';

interface OverviewCardsProps {
  overview: Overview;
}

const OverviewCards: React.FC<OverviewCardsProps> = ({ overview }) => {
  const cards = [
    {
      title: 'Total Strategies',
      value: overview.totalStrategies,
      color: 'bg-blue-500',
      icon: '📊'
    },
    {
      title: 'Total Trades',
      value: overview.totalTrades,
      color: 'bg-green-500',
      icon: '💹'
    },
    {
      title: 'Success Rate',
      value: `${overview.successRate}%`,
      color: 'bg-yellow-500',
      icon: '🎯'
    },
    {
      title: 'Total Profit',
      value: `$${overview.totalProfit.toFixed(2)}`,
      color: overview.totalProfit >= 0 ? 'bg-emerald-500' : 'bg-red-500',
      icon: '💰'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {cards.map((card, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">{card.title}</p>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
            </div>
            <div className={`${card.color} rounded-full p-3 text-white text-xl`}>
              {card.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OverviewCards;
