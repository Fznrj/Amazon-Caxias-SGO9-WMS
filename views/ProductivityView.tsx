import React from 'react';
import { useKpi } from '../context/KpiContext';
import { downloadCSV } from '../utils/download';
import { getSaoPauloDate, parseToDate, getTodayDate } from '../utils/dateUtils';

// Daily scan goal per operator
const DAILY_GOAL = 350;

const ProductivityView: React.FC = () => {
  const { fetchProductivityReport } = useKpi();

  const [startDate, setStartDate] = React.useState<string>(getSaoPauloDate(getTodayDate()));
  const [endDate, setEndDate] = React.useState<string>(getSaoPauloDate(getTodayDate()));
  const [rangeProductivity, setRangeProductivity] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);

  // Load report when date range changes
  React.useEffect(() => {
    let active = true;
    const loadReport = async () => {
      setLoading(true);
      const data = await fetchProductivityReport(startDate, endDate);
      if (active) setRangeProductivity(data);
      if (active) setLoading(false);
    };
    loadReport();
    return () => { active = false; };
  }, [startDate, endDate, fetchProductivityReport]);

  // --- Aggregate data by operator (in case there are multiple entries per operator in range) ---
  const aggregatedRanking = React.useMemo(() => {
    const map = new Map<string, any>();

    rangeProductivity.forEach(item => {
      const existing = map.get(item.operator) || {
        name: item.operator,
        total_scans: 0,
        inbound: 0,
        outbound: 0,
        inventory: 0,
        rts: 0
      };

      existing.total_scans += item.total_scans;
      existing.inbound += item.inbound_scans;
      existing.outbound += item.outbound_scans;
      existing.inventory += item.inventory_scans;
      existing.rts += item.rts_scans;

      map.set(item.operator, existing);
    });

    return Array.from(map.values())
      .map(r => {
        const goalPct = Math.round((r.total_scans / DAILY_GOAL) * 100);
        const color = goalPct >= 100 ? 'green' : goalPct >= 70 ? 'blue' : 'red';
        const efficiency = goalPct >= 100 ? 'Excelente' : goalPct >= 70 ? 'Regular' : 'Abaixo';
        return { ...r, scans: r.total_scans, goalPct, color, efficiency };
      })
      .sort((a, b) => b.scans - a.scans)
      .map((r, i) => ({ ...r, pos: i + 1 }));
  }, [rangeProductivity]);

  // --- Global KPIs ---
  const totalScans = aggregatedRanking.reduce((sum, r) => sum + r.scans, 0);

  const globalEfficiency = aggregatedRanking.length > 0
    ? Math.round(aggregatedRanking.reduce((sum, r) => sum + r.goalPct, 0) / aggregatedRanking.length)
    : 0;

  const efficiencyColor = globalEfficiency >= 100 ? 'text-green-500' : globalEfficiency >= 70 ? 'text-blue-500' : 'text-red-500';
  const efficiencyLabel = globalEfficiency >= 100 ? 'Meta Atingida' : globalEfficiency >= 70 ? 'Em Progresso' : 'Abaixo da Meta';

  const handleExportRanking = () => {
    const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
    const data = [
      ['Pos', 'Colaborador', 'Entradas', 'Saídas', 'Inventário', 'RTS', 'Total Scans', 'Meta %', 'Eficiência'],
      ...aggregatedRanking.map(r => [
        r.pos.toString(),
        r.name,
        r.inbound.toString(),
        r.outbound.toString(),
        r.inventory.toString(),
        r.rts.toString(),
        r.scans.toString(),
        `${r.goalPct}%`,
        r.efficiency
      ])
    ];
    downloadCSV(`Ranking_Funcionarios_${dateLabel}.csv`, data);
  };

  return (
    <div className="space-y-8">
      {/* Export Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-xl shadow-2xl relative overflow-hidden border border-slate-700">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full filter blur-[100px] opacity-10"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 font-display uppercase tracking-wider">Produtividade</h2>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              Acompanhe a performance dos operadores e exporte o ranking por período.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Exportar Dados</h3>
            <p className="text-xs text-slate-500 mb-2">Selecione o tipo de relatório e o período desejado para download em formato CSV.</p>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700">
                <div className="flex flex-col">
                  <label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Início</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-white text-xs px-2 py-1 outline-none focus:text-primary transition-colors [color-scheme:dark]"
                  />
                </div>
                <div className="w-px h-6 bg-slate-700 mx-1"></div>
                <div className="flex flex-col">
                  <label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Fim</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-white text-xs px-2 py-1 outline-none focus:text-primary transition-colors [color-scheme:dark]"
                  />
                </div>
              </div>
              <button
                onClick={handleExportRanking}
                disabled={loading}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-primary/25 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                <span className="material-icons-round text-lg">{loading ? 'sync' : 'cloud_download'}</span>
                {loading ? 'Carregando...' : 'Exportar Ranking'}
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* KPI + Podium — single unified row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Scans */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border-l-4 border-primary shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Scans (Período)</p>
          <h3 className="text-3xl font-display font-bold text-slate-800 dark:text-white">{totalScans}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Entrada + Saída + Inventário + RTS</p>
        </div>

        {/* Eficiência Geral */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border-l-4 border-teal-500 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Eficiência Geral</p>
          <h3 className={`text-3xl font-display font-bold ${efficiencyColor}`}>{globalEfficiency}%</h3>
          <p className={`text-[10px] mt-1 font-bold ${efficiencyColor}`}>{efficiencyLabel}</p>
        </div>

        {/* 🥇 1º Lugar */}
        <div className={`bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/20 dark:to-card-dark rounded-xl shadow-lg border-2 border-yellow-400 p-5 flex flex-col items-center gap-1 ${aggregatedRanking.length < 1 ? 'opacity-30' : ''}`}>
          <span className="text-3xl">🥇</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">1º Lugar</p>
          <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 border-2 border-yellow-400 flex items-center justify-center text-sm font-bold text-yellow-600">
            {aggregatedRanking[0] ? aggregatedRanking[0].name.substring(0, 2).toUpperCase() : '--'}
          </div>
          <p className="font-bold text-slate-800 dark:text-white text-sm text-center leading-tight">{aggregatedRanking[0]?.name ?? '—'}</p>
          <p className="text-2xl font-display font-bold text-yellow-500">{aggregatedRanking[0]?.scans ?? 0}</p>
          <p className="text-[10px] text-slate-400">scans no período</p>
        </div>

        {/* 🥈 2º Lugar */}
        <div className={`bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col items-center gap-1 ${aggregatedRanking.length < 2 ? 'opacity-30' : ''}`}>
          <span className="text-3xl">🥈</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">2º Lugar</p>
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
            {aggregatedRanking[1] ? aggregatedRanking[1].name.substring(0, 2).toUpperCase() : '--'}
          </div>
          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm text-center leading-tight">{aggregatedRanking[1]?.name ?? '—'}</p>
          <p className="text-2xl font-display font-bold text-slate-500">{aggregatedRanking[1]?.scans ?? 0}</p>
          <p className="text-[10px] text-slate-400">scans no período</p>
        </div>

        {/* 🥉 3º Lugar */}
        <div className={`bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col items-center gap-1 ${aggregatedRanking.length < 3 ? 'opacity-30' : ''}`}>
          <span className="text-3xl">🥉</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">3º Lugar</p>
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
            {aggregatedRanking[2] ? aggregatedRanking[2].name.substring(0, 2).toUpperCase() : '--'}
          </div>
          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm text-center leading-tight">{aggregatedRanking[2]?.name ?? '—'}</p>
          <p className="text-2xl font-display font-bold text-amber-700">{aggregatedRanking[2]?.scans ?? 0}</p>
          <p className="text-[10px] text-slate-400">scans no período</p>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-display font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm">Ranking de Operadores</h3>
            {loading && <span className="text-xs text-primary animate-pulse font-bold">Atualizando...</span>}
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Meta diária: {DAILY_GOAL} scans/operador</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold text-center w-20">Rank</th>
                <th className="px-6 py-4 font-semibold">Colaborador</th>
                <th className="px-6 py-4 font-semibold">Performance</th>
                <th className="px-6 py-4 font-semibold text-center w-32">E / S / I / R</th>
                <th className="px-6 py-4 font-semibold text-right">Total</th>
                <th className="px-6 py-4 font-semibold text-right">Eficiência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {aggregatedRanking.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">
                    {loading ? 'Carregando dados...' : 'Nenhuma atividade registrada no período'}
                  </td>
                </tr>
              ) : (
                aggregatedRanking.map((r, i) => (
                  <tr key={r.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-center">
                      {i === 0
                        ? <span className="material-icons-round text-yellow-500 text-2xl">workspace_premium</span>
                        : <span className="text-sm font-bold text-slate-400">#{r.pos}</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                          {r.name.substring(0, 2).toUpperCase()}
                        </div>
                        <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{r.name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="w-full max-w-[180px]">
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="font-medium text-slate-600 dark:text-slate-400">{r.goalPct}% da meta</span>
                          <span className={`font-bold uppercase ${r.color === 'green' ? 'text-green-500' : r.color === 'blue' ? 'text-blue-500' : 'text-red-500'}`}>
                            {r.efficiency}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${r.color === 'green' ? 'bg-green-500' : r.color === 'blue' ? 'bg-blue-500' : 'bg-red-500'}`}
                            style={{ width: `${Math.min(r.goalPct, 100)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-bold" title="Inbound">{r.inbound}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-green-50 text-green-600 rounded font-bold" title="Outbound">{r.outbound}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded font-bold" title="Inventory">{r.inventory}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-bold" title="RTS">{r.rts}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700 dark:text-slate-200 font-bold">{r.scans}</td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2 py-1 text-[10px] font-bold rounded ${r.color === 'green'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                        : r.color === 'blue'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        }`}>
                        {r.efficiency}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ProductivityView;
