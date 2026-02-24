import React from 'react';
import { downloadCSV } from '../utils/download';
import { supabase } from '../services/supabase';
import { useWms } from '../context/WmsContext';
import { getTodayDate, getSaoPauloDate, formatToLocalDate, formatToLocalTime } from '../utils/dateUtils';

const ReportView: React.FC = () => {
  const { currentUser, inventoryItems, inboundItems, outboundItems, possibleLossItems, stockItems, users } = useWms();
  const [startDate, setStartDate] = React.useState<string>(getSaoPauloDate());
  const [endDate, setEndDate] = React.useState<string>(getSaoPauloDate());

  const [isExporting, setIsExporting] = React.useState(false);

  // Helper para buscar dados do Supabase baseados no intervalo de datas
  const fetchReportData = async (table: string, dateField: string = 'created_at') => {
    if (!startDate || !endDate || !currentUser) return [];

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('company_id', currentUser.company_id)
      .gte(dateField, `${startDate}T00:00:00`)
      .lte(dateField, `${endDate}T23:59:59`)
      .order(dateField, { ascending: true });

    if (error) {
      console.error(`Erro ao buscar dados para relatório (${table}):`, error);
      return [];
    }
    return data || [];
  };

  const handleDownloadReport = async (reportTitle: string) => {
    if (isExporting) return;
    setIsExporting(true);
    let data: string[][] = [];
    const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
    let filename = `${reportTitle.replace(/ /g, '_')}_${dateLabel}.csv`;

    try {
      if (reportTitle.includes('Inventário')) {
        const items = await fetchReportData('inventory_log');
        data = [
          ['ID', 'Operador', 'Data', 'Hora'],
          ...items.map(item => [item.id, item.operator, formatToLocalDate(item.time), formatToLocalTime(item.time)])
        ];
      } else if (reportTitle.includes('Saídas')) {
        const items = await fetchReportData('outbound_log');
        data = [
          ['ID', 'Motorista', 'Veículo', 'Data', 'Hora', 'Operador', 'Status'],
          ...items.map(item => [item.id, item.driver_name, item.vehicle, formatToLocalDate(item.time), formatToLocalTime(item.time), item.operator, item.status])
        ];
      } else if (reportTitle.includes('Perdas')) {
        const items = await fetchReportData('stock_items', 'entry_time');
        const lossItems = items.filter((i: any) => i.status?.toLowerCase() === 'perda' || i.status?.toLowerCase() === 'possível perda');
        data = [
          ['ID', 'Data', 'Hora', 'Operador', 'Status'],
          ...lossItems.map((item: any) => [item.id, formatToLocalDate(item.entry_time), formatToLocalTime(item.entry_time), item.operator, item.status])
        ];
      } else if (reportTitle.includes('Total em Estoque')) {
        const items = await fetchReportData('stock_items', 'entry_time');
        const stockItemsOnly = items.filter((i: any) => i.status === 'Em Estoque');
        data = [
          ['ID', 'Data', 'Hora', 'Operador', 'Status'],
          ...stockItemsOnly.map((item: any) => [item.id, formatToLocalDate(item.entry_time), formatToLocalTime(item.entry_time), item.operator, item.status])
        ];
      }

      if (data.length > 1) {
        downloadCSV(filename, data);
      } else {
        alert('Nenhum dado encontrado para o período selecionado.');
      }
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadAll = async () => {
    if (isExporting) return;
    setIsExporting(true);
    const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;

    try {
      const [inbound, outbound, stock, inventory] = await Promise.all([
        fetchReportData('inbound_log'),
        fetchReportData('outbound_log'),
        fetchReportData('stock_items', 'entry_time'),
        fetchReportData('inventory_log')
      ]);

      const data = [
        ['Data/Hora', 'Tipo', 'ID (TBR)', 'Operador', 'Motorista', 'Veículo', 'Status', 'ID Pallet (Reversa)'],

        // Inbound
        ...inbound.map(i => [
          `${formatToLocalDate(i.time)} ${formatToLocalTime(i.time)}`, 'Entrada', i.id, i.operator, '-', '-', i.status, '-'
        ]),

        // Outbound & Reversa
        ...outbound.map(i => [
          `${formatToLocalDate(i.time)} ${formatToLocalTime(i.time)}`, i.status?.toLowerCase()?.includes('reversa') ? 'Reversa' : 'Saída', i.id, i.operator, i.driver_name, i.vehicle, i.status, i.pallet_id || '-'
        ]),

        // Stock (Losses and current)
        ...stock.map(i => {
          let type = 'Estoque';
          if (i.status?.toLowerCase() === 'perda') type = 'Perda Definitiva';
          else if (i.status?.toLowerCase() === 'possível perda') type = 'Possível Perda';

          return [`${formatToLocalDate(i.entry_time)} ${formatToLocalTime(i.entry_time)}`, type, i.id, i.operator, '-', '-', i.status, '-'];
        }),

        // Inventory
        ...inventory.map(i => [
          `${formatToLocalDate(i.time)} ${formatToLocalTime(i.time)}`, 'Inventário', i.id, i.operator, '-', '-', 'Conferido', '-'
        ])
      ];

      if (data.length > 1) {
        // Ordenar por Data/Hora (primeira coluna)
        const header = data[0];
        const sortedBody = data.slice(1).sort((a, b) => a[0].localeCompare(b[0]));
        downloadCSV(`Relatorio_Geral_Movimentos_${dateLabel}.csv`, [header, ...sortedBody]);
      } else {
        alert('Nenhum dado encontrado para o período selecionado.');
      }
    } catch (err) {
      console.error('Erro ao baixar todos os dados:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const reports = [
    { title: 'Inventário Completo', description: 'Relatório detalhado de todos os itens conferidos.', icon: 'inventory_2' },
    { title: 'Total em Estoque', description: 'Lista de todos os itens atualmente na base (físico).', icon: 'view_in_ar' },
    { title: 'Movimentação de Saídas', description: 'Histórico de todas as saídas e motoristas.', icon: 'local_shipping' },
    { title: 'Relatório de Perdas', description: 'Itens marcados como perda ou não encontrados.', icon: 'warning' },
  ];

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-xl shadow-2xl relative overflow-hidden border border-slate-700">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full filter blur-[100px] opacity-10"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 font-display uppercase tracking-wider">Relatórios & Exportações</h2>
            <p className="text-slate-300 text-sm max-w-xl leading-relaxed">
              Exporte dados detalhados para análise externa, auditoria e conformidade operacional.
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
                    className="bg-transparent text-white text-xs px-2 py-1 outline-none focus:text-primary transition-colors"
                  />
                </div>
                <div className="w-px h-6 bg-slate-700 mx-1"></div>
                <div className="flex flex-col">
                  <label className="text-[9px] uppercase font-bold text-slate-500 ml-1">Fim</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent text-white text-xs px-2 py-1 outline-none focus:text-primary transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={handleDownloadAll}
                disabled={isExporting}
                className={`${isExporting ? 'bg-slate-600' : 'bg-primary hover:bg-primary/90'} text-white px-6 py-2.5 rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg transition-all flex items-center gap-2`}
              >
                <span className="material-icons-round text-lg">{isExporting ? 'pending' : 'cloud_download'}</span>
                {isExporting ? 'Processando...' : 'Download All'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reports.map((report, index) => (
          <div key={index} className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg">
                <span className="material-icons-round text-slate-600 dark:text-slate-300">{report.icon}</span>
              </div>
              <button
                onClick={() => handleDownloadReport(report.title)}
                className="text-primary hover:text-primary/80 font-semibold text-sm flex items-center gap-1"
              >
                Download CSV <span className="material-icons-round text-sm">download</span>
              </button>
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-2">{report.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">{report.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportView;
