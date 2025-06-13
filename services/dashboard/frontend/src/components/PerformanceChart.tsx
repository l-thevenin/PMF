import React from 'react';
import { PerformanceData } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface PerformanceChartProps {
  data: PerformanceData[];
}

const PerformanceChart: React.FC<PerformanceChartProps> = ({ data }) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
  };

  const formatProfit = (value: number) => {
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-8">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance des 7 derniers jours</h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profit Chart */}
        <div>
          <h4 className="text-md font-medium text-gray-700 mb-3">Profit Journalier</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                fontSize={12}
              />
              <YAxis 
                tickFormatter={formatProfit}
                fontSize={12}
              />
              <Tooltip 
                labelFormatter={(label) => `Date: ${formatDate(label)}`}
                formatter={(value: number) => [formatProfit(value), 'Profit']}
              />
              <Line 
                type="monotone" 
                dataKey="profit" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Trades Chart */}
        <div>
          <h4 className="text-md font-medium text-gray-700 mb-3">Nombre de Trades</h4>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={formatDate}
                fontSize={12}
              />
              <YAxis fontSize={12} />
              <Tooltip 
                labelFormatter={(label) => `Date: ${formatDate(label)}`}
              />
              <Bar dataKey="trades" fill="#3b82f6" name="Total" />
              <Bar dataKey="successful" fill="#10b981" name="Réussis" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default PerformanceChart;
