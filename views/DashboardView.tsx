import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useWms } from '../context/WmsContext';
import { View } from '../types';
import { getSaoPauloDate, parseToDate, getDateKey, getTodayDate } from '../utils/dateUtils';

interface DashboardViewProps {
  onNavigate: (view: View) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const {
    inboundItems,
    outboundItems,
    totalLossItems,
    stockItems,
    staleItemsCount,
    weeklyStats
  } = useWms();

  const [startDate, setStartDate] = React.useState(getSaoPauloDate(getTodayDate()));
  const [endDate, setEndDate] = React.useState(getSaoPauloDate(getTodayDate()));
  const [isComparisonMode, setIsComparisonMode] = React.useState(false);

  // Calculate stats for the selected period
  const periodStats = React.useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    let reversas = 0;

    inboundItems.forEach(item => {
      if (item.error) return;
      const date = getSaoPauloDate(parseToDate((item as any).created_at || item.time));
      if (date >= startDate && date <= endDate) entradas++;
    });

    outboundItems.forEach(item => {
      const date = getSaoPauloDate(parseToDate((item as any).created_at || item.time));
      if (date >= startDate && date <= endDate) {
        const st = item.status?.toLowerCase() || '';
        if (st === 'saiu com motorista') saidas++;
        else if (st.includes('reversa')) reversas++;
      }
    });

    return { entradas, saidas, reversas };
  }, [inboundItems, outboundItems, startDate, endDate]);

  // Calculate trends comparing Today vs Yesterday (standard dashboard behavior)
  const yesterdayData = weeklyStats && weeklyStats.length >= 2 ? weeklyStats[weeklyStats.length - 2] : null;
  const todayData = weeklyStats && weeklyStats.length >= 1 ? weeklyStats[weeklyStats.length - 1] : null;

  const calculateTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? '+' : ''}${Math.round(diff)}%`;
  };

  const displayInbound = isComparisonMode ? periodStats.entradas : periodStats.entradas; // Actually use periodStats even if single day
  const displayOutbound = periodStats.saidas;
  const displayReversa = periodStats.reversas;
  const totalDepartures = displayOutbound + displayReversa;

  const kpis = [
    {
      label: 'Total em Estoque',
      value: stockItems.filter(i => i.status === 'Em Estoque').length.toString(),
      icon: 'view_in_ar',
      color: 'primary',
      trend: calculateTrend(
        stockItems.filter(i => i.status === 'Em Estoque').length,
        // Estimation: current stock - (today's net change) = yesterday's stock
        stockItems.filter(i => i.status === 'Em Estoque').length - ((todayData?.entradas || 0) - (todayData?.saidas || 0))
      )
    },
    {
      label: isComparisonMode ? 'Entradas Período' : 'Entradas Hoje',
      value: periodStats.entradas.toString(),
      icon: 'arrow_upward',
      color: 'green-500',
      trend: isComparisonMode ? 'Histórico' : calculateTrend(periodStats.entradas, yesterdayData?.entradas || 0)
    },
    {
      label: isComparisonMode ? 'Saídas Período' : 'Saídas Hoje',
      value: `${totalDepartures}${displayReversa > 0 ? ` (${displayReversa})` : ''}`,
      icon: 'arrow_downward',
      color: 'orange-500',
      trend: isComparisonMode ? 'Histórico' : calculateTrend(totalDepartures, (yesterdayData?.saidas || 0))
    },
    { label: 'Parados +1 Dia', value: staleItemsCount.toString(), icon: 'schedule', color: 'yellow-600', trend: 'Audit' },
    { label: 'Possíveis Perdas', value: stockItems.filter(i => i.status === 'Possível Perda').length.toString(), icon: 'warning', color: 'red-500', trend: 'Audit' },
    { label: 'Perdas / Extravios', value: totalLossItems.toString(), icon: 'cancel', color: 'black', trend: 'Permanente' },
  ];

  return (
    <div className="space-y-8">
      {/* Date Filter Header */}
      <div className="bg-white dark:bg-card-dark p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-icons-round text-primary">calendar_month</span>
          <h2 className="font-display font-bold tracking-widest uppercase text-sm">Comparativo de Período</h2>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Início</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setIsComparisonMode(true);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold uppercase text-slate-500">Fim</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setIsComparisonMode(true);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={() => {
              const today = getSaoPauloDate(getTodayDate());
              setStartDate(today);
              setEndDate(today);
              setIsComparisonMode(false);
            }}
            className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
          >
            Resetar Hoje
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpis.map((kpi, idx) => (
          <div key={idx} className="bg-white dark:bg-card-dark p-5 rounded border-l-4 shadow-sm flex flex-col justify-between h-32 transition-transform hover:scale-[1.02]" style={{ borderColor: `var(--tw-border-opacity, 1) ${kpi.color === 'primary' ? '#087f8c' : kpi.color}` }}>
            <div className="flex justify-between items-start">
              <span className={`material-icons-round text-${kpi.color} opacity-80`}>{kpi.icon}</span>
              <div className="text-right">
                <span className={`text-3xl font-display font-bold ${kpi.label === 'Saídas Hoje' ? 'flex items-baseline gap-2 justify-end' : ''}`}>
                  {kpi.value.includes('(') ? (
                    <>
                      <span className="text-[14px] text-red-500 font-bold mb-1 cursor-help" title="Reversa">{kpi.value.match(/\((.*?)\)/)?.[0] || ''}</span>
                      <span>{kpi.value.split(' ')[0]}</span>
                    </>
                  ) : kpi.value}
                </span>
                <p className={`text-[10px] font-bold ${kpi.trend.startsWith('+') ? 'text-green-500' : kpi.trend.startsWith('-') ? 'text-red-500' : 'text-slate-400'}`}>
                  {kpi.trend}
                </p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{kpi.label}</span>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-card-dark p-6 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-display text-lg tracking-widest uppercase mb-6">Volume de Movimentação Semanal</h3>
        <div className="h-[250px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {weeklyStats && weeklyStats.length > 0 ? (
              <BarChart data={weeklyStats}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.1} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => Math.round(val).toString()} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px', color: '#fff' }}
                  itemStyle={{ color: '#087f8c' }}
                  formatter={(value: any, name: string) => [value, name]}
                />
                <Bar dataKey="entradas" name="Entradas" fill="#087f8c" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" name="Saídas" fill="#f3a847" radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
                Carregando dados estatísticos...
              </div>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default DashboardView;
