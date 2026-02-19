import React from 'react';
import { downloadCSV } from '../utils/download';
import { useWms } from '../context/WmsContext';

const ReportView: React.FC = () => {
  const { inventoryItems, inboundItems, outboundItems, possibleLossItems, users } = useWms();
  const [startDate, setStartDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = React.useState<string>(new Date().toISOString().split('T')[0]);

  // Helper to filter items by date range.
  const filterByDateRange = (items: any[]) => {
    if (!startDate || !endDate) return items;

    return items.filter(item => {
      const timeStr = item.time || item.entryTime || '';
      if (!timeStr) return false;

      // Extract date from "DD/MM/YYYY, HH:MM:SS" or "YYYY-MM-DD"
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

  const handleDownloadReport = (reportTitle: string) => {
    let data: string[][] = [];
    const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
    let filename = `${reportTitle.replace(/ /g, '_')}_${dateLabel}.csv`;

    if (reportTitle.includes('Inventário')) {
      data = [
        ['ID', 'Operator', 'Time'],
        ...filterByDateRange(inventoryItems).map(item => [item.id, item.operator, item.time])
      ];
    } else if (reportTitle.includes('Saídas')) {
      data = [
        ['ID', 'Driver', 'Vehicle', 'Time', 'Operator', 'Status'],
        ...filterByDateRange(outboundItems).map(item => [item.id, item.driverName, item.vehicle, item.time, item.operator, item.status])
      ];
    } else if (reportTitle.includes('Perdas')) {
      data = [
        ['ID', 'Entry Time', 'Operator', 'Status'],
        ...filterByDateRange(possibleLossItems).map(item => [item.id, item.entryTime, item.operator, item.status])
      ];
    } else if (reportTitle.includes('Motoristas')) {
      data = [
        ['Driver Name', 'Vehicle', 'Status']
      ];
    } else {
      // Geral
      data = [
        ['Type', 'ID', 'Detail', 'Operator', 'Time'],
        ...filterByDateRange(inventoryItems).map(i => ['Inventory', i.id, i.operator, i.operator, i.time]),
        ...filterByDateRange(inboundItems).map(i => ['Inbound', i.id, i.operator, i.operator, i.time]),
        ...filterByDateRange(outboundItems).map(i => ['Outbound', i.id, i.driverName, i.operator, i.time]),
      ];
    }

    downloadCSV(filename, data);
  };

  const handleDownloadAll = () => {
    const dateLabel = startDate === endDate ? startDate : `${startDate}_to_${endDate}`;
    const data = [
      ['Type', 'ID', 'Detail', 'Operator', 'Time'],
      ...filterByDateRange(inventoryItems).map(i => ['Inventory', i.id, i.operator, i.operator, i.time]),
      ...filterByDateRange(inboundItems).map(i => ['Inbound', i.id, i.operator, i.operator, i.time]),
      ...filterByDateRange(outboundItems).map(i => ['Outbound', i.id, i.driverName, i.operator, i.time]),
      ...filterByDateRange(possibleLossItems).map(i => ['Loss', i.id, i.operator, i.operator, 'Missing'])
    ];
    downloadCSV(`Full_Export_${dateLabel}.csv`, data);
  };

  const reports = [
    { title: 'Inventário Completo', description: 'Relatório detalhado de todos os itens em estoque.', icon: 'inventory_2' },
    { title: 'Movimentação de Saídas', description: 'Histórico de todas as saídas e motoristas.', icon: 'local_shipping' },
    { title: 'Relatório de Perdas', description: 'Itens marcados como perda ou não encontrados.', icon: 'warning' },
    { title: 'Base de Motoristas', description: 'Cadastro completo de motoristas e veículos.', icon: 'badge' },
    { title: 'Geral', description: 'Visão unificada de todas as operações.', icon: 'dashboard' },
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
                className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-lg font-bold uppercase text-xs tracking-wider shadow-lg shadow-primary/25 transition-all flex items-center gap-2"
              >
                <span className="material-icons-round text-lg">cloud_download</span> Download All
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
