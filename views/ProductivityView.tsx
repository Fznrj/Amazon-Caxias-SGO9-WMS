import React from 'react';
import { useWms } from '../context/WmsContext';
import { downloadCSV } from '../utils/download';

// Daily scan goal per operator
const DAILY_GOAL = 350;

const ProductivityView: React.FC = () => {
  const {
    inboundItems,
    outboundItems,
    inventoryItems,
  } = useWms();

  const [startDate, setStartDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState<string>(new Date().toISOString().split('T')[0]);

  // Helper to filter items by date range
  const filterByDateRange = (items: any[]) => {
    if (!startDate || !endDate) return items;
    return items.filter(item => {
      const timeStr = item.time || item.entryTime || '';
      if (!timeStr) return false;
      let itemDateStr = '';
      if (timeStr.includes(',')) {
        const [datePart] = timeStr.split(',');
        const [day, month, year] = datePart.trim().split('/');
        itemDateStr = `${year}-${month}-${day}`;
      } else if (timeStr.includes('-')) {
        itemDateStr = timeStr.split(' ')[0];
      }
      return itemDateStr >= startDate && itemDateStr <= endDate;
    });
  };

  // --- Filtered data ---
  const filteredInbound = filterByDateRange(inboundItems).filter((i: any) => !i.error);
  const filteredOutbound = filterByDateRange(outboundItems);
  const filteredInventory = filterByDateRange(inventoryItems);

  // --- Ranking Calculation ---
  const scansByOperator = new Map<string, number>();

  filteredInbound.forEach((i: any) => {
    scansByOperator.set(i.operator, (scansByOperator.get(i.operator) || 0) + 1);
  });
  filteredOutbound.forEach((i: any) => {
    scansByOperator.set(i.operator, (scansByOperator.get(i.operator) || 0) + 1);
  });
  filteredInventory.forEach((i: any) => {
    scansByOperator.set(i.operator, (scansByOperator.get(i.operator) || 0) + 1);
  });

  const ranking = Array.from(scansByOperator.entries())
    .map(([name, scans]) => {
      const goalPct = Math.round((scans / DAILY_GOAL) * 100);
      const color = goalPct >= 100 ? 'green' : goalPct >= 70 ? 'blue' : 'red';
      const efficiency = goalPct >= 100 ? 'Excelente' : goalPct >= 70 ? 'Regular' : 'Abaixo';
      return { name, scans, goalPct, color, efficiency };
    })
    .sort((a, b) => b.scans - a.scans)
    .map((r, i) => ({ ...r, pos: i + 1 }));

  // --- Global KPIs ---
  const totalScans = filteredInbound.length + filteredOutbound.length + filteredInventory.length;

  const globalEfficiency = ranking.length > 0
    ? Math.round(ranking.reduce((sum, r) => sum + r.goalPct, 0) / ranking.length)
    : 0;

  const efficiencyColor = globalEfficiency >= 100 ? 'text-green-500' : globalEfficiency >= 70 ? 'text-blue-500' : 'text-red-500';
  const efficiencyLabel = globalEfficiency >= 100 ? 'Meta Atingida' : globalEfficiency >= 70 ? 'Em Progresso' : 'Abaixo da Meta';

  const handleExportRanking = () => {
    const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
    const data = [
      ['Pos', 'Colaborador', 'Total Scans', 'Meta %', 'Eficiência'],
      ...ranking.map(r => [r.pos.toString(), r.name, r.scans.toString(), `${r.goalPct}%`, r.efficiency])
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
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-primary/25 transition-all flex items-center gap-2"
              >
                <span className="material-icons-round text-lg">cloud_download</span> Exportar Ranking
              </button>
            </div>
          </div>
        </div>
      </div>


      {/* KPI + Podium — single unified row */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {/* Total Scans */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border-l-4 border-primary shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Scans (Hoje)</p>
          <h3 className="text-3xl font-display font-bold text-slate-800 dark:text-white">{totalScans}</h3>
          <p className="text-[10px] text-slate-400 mt-1">Entrada + Saída + Inventário</p>
        </div>

        {/* Eficiência Geral */}
        <div className="bg-white dark:bg-card-dark p-5 rounded-xl border-l-4 border-teal-500 shadow-sm">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Eficiência Geral</p>
          <h3 className={`text-3xl font-display font-bold ${efficiencyColor}`}>{globalEfficiency}%</h3>
          <p className={`text-[10px] mt-1 font-bold ${efficiencyColor}`}>{efficiencyLabel}</p>
        </div>

        {/* 🥇 1º Lugar */}
        <div className={`bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/20 dark:to-card-dark rounded-xl shadow-lg border-2 border-yellow-400 p-5 flex flex-col items-center gap-1 ${ranking.length < 1 ? 'opacity-30' : ''}`}>
          <span className="text-3xl">🥇</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-500">1º Lugar</p>
          <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/40 border-2 border-yellow-400 flex items-center justify-center text-sm font-bold text-yellow-600">
            {ranking[0] ? ranking[0].name.substring(0, 2).toUpperCase() : '--'}
          </div>
          <p className="font-bold text-slate-800 dark:text-white text-sm text-center leading-tight">{ranking[0]?.name ?? '—'}</p>
          <p className="text-2xl font-display font-bold text-yellow-500">{ranking[0]?.scans ?? 0}</p>
          <p className="text-[10px] text-slate-400">scans hoje</p>
        </div>

        {/* 🥈 2º Lugar */}
        <div className={`bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col items-center gap-1 ${ranking.length < 2 ? 'opacity-30' : ''}`}>
          <span className="text-3xl">🥈</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">2º Lugar</p>
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
            {ranking[1] ? ranking[1].name.substring(0, 2).toUpperCase() : '--'}
          </div>
          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm text-center leading-tight">{ranking[1]?.name ?? '—'}</p>
          <p className="text-2xl font-display font-bold text-slate-500">{ranking[1]?.scans ?? 0}</p>
          <p className="text-[10px] text-slate-400">scans hoje</p>
        </div>

        {/* 🥉 3º Lugar */}
        <div className={`bg-white dark:bg-card-dark rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-5 flex flex-col items-center gap-1 ${ranking.length < 3 ? 'opacity-30' : ''}`}>
          <span className="text-3xl">🥉</span>
          <p className="text-[10px] font-bold uppercase tracking-widest text-amber-700">3º Lugar</p>
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-slate-300">
            {ranking[2] ? ranking[2].name.substring(0, 2).toUpperCase() : '--'}
          </div>
          <p className="font-bold text-slate-700 dark:text-slate-200 text-sm text-center leading-tight">{ranking[2]?.name ?? '—'}</p>
          <p className="text-2xl font-display font-bold text-amber-700">{ranking[2]?.scans ?? 0}</p>
          <p className="text-[10px] text-slate-400">scans hoje</p>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-display font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm">Ranking de Operadores</h3>
          <span className="text-[10px] text-slate-400 font-mono">Meta diária: {DAILY_GOAL} scans/operador</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold text-center w-20">Rank</th>
                <th className="px-6 py-4 font-semibold">Colaborador</th>
                <th className="px-6 py-4 font-semibold">Meta Diária</th>
                <th className="px-6 py-4 font-semibold text-right">Total Scans</th>
                <th className="px-6 py-4 font-semibold text-right">Eficiência</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {ranking.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">
                    Nenhuma atividade registrada hoje
                  </td>
                </tr>
              ) : (
                ranking.map((r, i) => (
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
                          <span className="font-medium text-slate-600 dark:text-slate-400">{r.goalPct}% atingida</span>
                          <span className={`font-bold uppercase ${r.color === 'green' ? 'text-green-500' : r.color === 'blue' ? 'text-blue-500' : 'text-red-500'}`}>
                            {r.goalPct >= 100 ? 'Meta OK' : r.goalPct >= 70 ? 'Em Progresso' : 'Abaixo'}
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
                    <td className="px-6 py-4 text-right font-mono text-sm text-slate-700 dark:text-slate-200">{r.scans}</td>
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
