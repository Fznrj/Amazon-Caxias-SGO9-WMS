import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWms } from '../context/WmsContext';
import { View } from '../types';

interface DashboardViewProps {
  onNavigate: (view: View) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    totalInboundToday,
    totalOutboundToday,
    totalInventoryScanned,
    totalLossItems,
    stockItems,
    staleItemsCount,
    weeklyStats
  } = useWms();

  const kpis = [
    { label: 'Total em Estoque', value: stockItems.filter(i => i.status === 'Em Estoque').length.toString(), icon: 'view_in_ar', color: 'primary', trend: '0%' },
    { label: 'Entradas Hoje', value: totalInboundToday.toString(), icon: 'arrow_upward', color: 'green-500', trend: '0%' },
    { label: 'Saídas Hoje', value: totalOutboundToday.toString(), icon: 'arrow_downward', color: 'orange-500', trend: '0%' },
    { label: 'Parados +1 Dia', value: staleItemsCount.toString(), icon: 'schedule', color: 'yellow-600', trend: '0' },
    { label: 'Possíveis Perdas', value: stockItems.filter(i => i.status === 'Possível Perda').length.toString(), icon: 'warning', color: 'red-500', trend: '0' },
    { label: 'Perdas / Extravios', value: totalLossItems.toString(), icon: 'cancel', color: 'black', trend: 'Permanente' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white dark:bg-card-dark p-5 rounded border-l-4 shadow-sm flex flex-col justify-between h-32 transition-transform hover:scale-[1.02]" style={{ borderColor: `var(--tw-border-opacity, 1) ${kpi.color === 'primary' ? '#087f8c' : kpi.color}` }}>
            <div className="flex justify-between items-start">
              <span className={`material-icons-round text-${kpi.color} opacity-80`}>{kpi.icon}</span>
              <div className="text-right">
                <span className="text-3xl font-display font-bold">{kpi.value}</span>
                <p className="text-[10px] text-green-500 font-bold">{kpi.trend}</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{kpi.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-card-dark p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-display text-lg tracking-widest uppercase mb-6">Volume de Movimentação Semanal</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyStats}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => Math.round(val).toString()} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                itemStyle={{ color: '#087f8c' }}
                formatter={(value: any) => [value, 'Volume']}
              />
              <Bar dataKey="entradas" name="Entradas" fill="#087f8c" radius={[4, 4, 0, 0]} />
              <Bar dataKey="saudas" name="Saídas" fill="#f3a847" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
