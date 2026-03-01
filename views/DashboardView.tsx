import React from 'react';
import { useKpi } from '../context/KpiContext';
import { useWmsData } from '../context/WmsDataContext';
import { useWms } from '../context/WmsContext';
import { View } from '../types';
import { getSaoPauloDate, getTodayDate } from '../utils/dateUtils';
import PullToRefresh from '../components/PullToRefresh';

interface DashboardViewProps {
  onNavigate: (view: View) => void;
}

const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  // KPIs from the SQL View (via KpiContext)
  const { statsSummary, fetchDashboardPeriodStats } = useKpi();
  const {
    totalInboundToday, totalOutboundToday, totalReversaToday,
    staleItemsCount, totalLossItems, totalPossibleLosses, weeklyStats
  } = statsSummary;

  // Raw data for comparison mode only (via WmsDataContext)
  const { stockItems } = useWmsData();

  // Refresh action only (via WmsContext)
  const { refreshData } = useWms();

  // Derived: available stock count
  const totalExpected = React.useMemo(() =>
    stockItems.filter(i => i.status?.toLowerCase() === 'em estoque').length,
    [stockItems]
  );

  const [startDate, setStartDate] = React.useState(getSaoPauloDate(getTodayDate()));
  const [endDate, setEndDate] = React.useState(getSaoPauloDate(getTodayDate()));
  const [isComparisonMode, setIsComparisonMode] = React.useState(false);

  const [periodStats, setPeriodStats] = React.useState({ entradas: 0, saidas: 0, reversas: 0 });

  React.useEffect(() => {
    const isToday = startDate === getSaoPauloDate(getTodayDate()) && endDate === getSaoPauloDate(getTodayDate());
    if (isToday) {
      setPeriodStats({ entradas: totalInboundToday, saidas: totalOutboundToday, reversas: totalReversaToday });
      return;
    }

    let isMounted = true;
    fetchDashboardPeriodStats(startDate, endDate).then(stats => {
      if (isMounted) setPeriodStats(stats);
    });

    return () => { isMounted = false; };
  }, [startDate, endDate, totalInboundToday, totalOutboundToday, totalReversaToday, fetchDashboardPeriodStats]);

  const yesterdayData = weeklyStats && weeklyStats.length >= 2 ? weeklyStats[weeklyStats.length - 2] : null;

  const calculateTrend = (current: number, previous: number) => {
    if (!previous || previous === 0) return current > 0 ? '+100%' : '0%';
    const diff = ((current - previous) / previous) * 100;
    return `${diff >= 0 ? '+' : ''}${Math.round(diff)}%`;
  };

  const colorMap: Record<string, string> = {
    'primary': '#087f8c',
    'green-500': '#10b981',
    'orange-500': '#f3a847',
    'yellow-600': '#ca8a04',
    'red-500': '#ef4444',
    'black': '#000000'
  };

  const kpis = [
    {
      label: 'Total em Estoque',
      value: totalExpected.toString(),
      icon: 'view_in_ar',
      color: 'primary',
      trend: calculateTrend(totalExpected, totalExpected - ((totalInboundToday) - (totalOutboundToday)))
    },
    {
      label: isComparisonMode ? 'Entradas Período' : 'Entradas Hoje',
      value: (isComparisonMode ? periodStats.entradas : totalInboundToday).toString(),
      icon: 'arrow_upward',
      color: 'green-500',
      trend: isComparisonMode ? 'Histórico' : calculateTrend(totalInboundToday, yesterdayData?.entradas || 0)
    },
    {
      label: isComparisonMode ? 'Saídas Período' : 'Saídas Hoje',
      value: isComparisonMode
        ? `${periodStats.saidas + periodStats.reversas}`
        : `${totalOutboundToday + totalReversaToday}`,
      reversas: isComparisonMode ? periodStats.reversas : totalReversaToday,
      icon: 'arrow_downward',
      color: 'orange-500',
      trend: isComparisonMode ? 'Histórico' : calculateTrend(totalOutboundToday + totalReversaToday, yesterdayData?.saidas || 0)
    },
    { label: 'Parados +1 Dia', value: staleItemsCount.toString(), icon: 'schedule', color: 'yellow-600', trend: 'Audit' },
    { label: 'Possíveis Perdas', value: totalPossibleLosses.toString(), icon: 'warning', color: 'red-500', trend: 'Audit' },
    { label: 'Perdas / Extravios', value: totalLossItems.toString(), icon: 'cancel', color: 'black', trend: 'Permanente' },
  ];

  return (
    <PullToRefresh onRefresh={refreshData}>
      <div className="space-y-8">
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
                onChange={(e) => { setStartDate(e.target.value); setIsComparisonMode(true); }}
                className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold uppercase text-slate-500">Fim</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => { setEndDate(e.target.value); setIsComparisonMode(true); }}
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

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4">
          {kpis.map((kpi, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-card-dark p-3 md:p-5 rounded border-l-4 shadow-sm flex flex-col justify-between h-24 md:h-32 transition-transform hover:scale-[1.02]"
              style={{ borderLeftColor: colorMap[kpi.color] || '#087f8c' }}
            >
              <div className="flex justify-between items-start w-full">
                <span className={`material-icons-round text-${kpi.color === 'primary' ? 'primary' : kpi.color} opacity-80 text-lg md:text-xl`}>{kpi.icon}</span>
                <div className="flex flex-col items-end">
                  <div className="text-lg md:text-2xl font-display font-bold text-slate-800 dark:text-white">
                    {kpi.value}
                  </div>
                  {(kpi as any).reversas > 0 && (
                    <span className="text-sm font-bold text-red-500 mt-0.5" title="REVERSA">
                      ({(kpi as any).reversas})
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-auto">
                <span className="text-[8px] md:text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block truncate">{kpi.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </PullToRefresh>
  );
};

export default DashboardView;
