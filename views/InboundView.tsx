import React, { useState, useRef } from 'react';
import { useWms } from '../context/WmsContext';
import * as XLSX from 'xlsx';
import { isSameDay, getTodayDate, formatToLocalTime, getSaoPauloIso } from '../utils/dateUtils';
import PullToRefresh from '../components/PullToRefresh';
import { isValidTbr } from '../utils/validation';

const InboundView: React.FC = () => {
  const [scanValue, setScanValue] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliationSnapshot, setReconciliationSnapshot] = useState<{ missing: string[], unexpected: string[] } | null>(null);

  const {
    inboundItems, addInboundItem, currentUser, stockItems,
    playAudio, expectedInboundList, setExpectedInboundList,
    clearInboundManifest, todayInboundList, inboundReconciliation,
    refreshData
  } = useWms();

  const { matches, missing: missingItems, unexpected: unexpectedItems, progressPercent, successfulScansToday: successfulScans } = inboundReconciliation;

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const tbrs = Array.from(new Set(
          data.flat()
            .map(val => String(val).trim().toUpperCase())
            .filter(val => isValidTbr(val).isValid)
        ));

        if (tbrs.length > 0) {
          await setExpectedInboundList(tbrs);
          setReconciliationSnapshot(null);
          playAudio('success');
        } else {
          alert('Nenhuma TBR válida encontrada no arquivo!');
        }
      } catch (err) {
        console.error('Error parsing file:', err);
        alert('Erro ao processar arquivo.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanValue.trim()) return;
    const currentId = scanValue.trim().toUpperCase();

    const validation = isValidTbr(currentId);
    if (!validation.isValid) {
      alert(validation.message);
      playAudio('error');
      setScanValue('');
      return;
    }

    const alreadyInStock = stockItems.some(item =>
      item.id.toUpperCase() === currentId && item.status === 'Em Estoque'
    );

    if (alreadyInStock) {
      await addInboundItem({
        id: currentId,
        status: 'Duplicado',
        operator: currentUser?.name || 'Sistema',
        time: formatToLocalTime(getSaoPauloIso()),
        error: true
      });
      setScanValue('');
      return;
    }

    await addInboundItem({
      id: currentId,
      status: 'Sucesso',
      operator: currentUser?.name || 'Sistema',
      time: formatToLocalTime(getSaoPauloIso()),
      error: false
    });
    setScanValue('');
  };

  const handleFinalize = async () => {
    if (!confirm('Deseja finalizar este recebimento?')) return;
    setReconciliationSnapshot({ missing: missingItems, unexpected: unexpectedItems });
    await clearInboundManifest();
    setShowReconciliation(true);
    playAudio('success');
  };

  const exportDiscrepancies = () => {
    const missing = reconciliationSnapshot?.missing || missingItems;
    const unexpected = reconciliationSnapshot?.unexpected || unexpectedItems;
    const data = [
      ['Tipo', 'Código TBR'],
      ...missing.map(id => ['FALTANTE', id]),
      ...unexpected.map(id => ['NÃO PREVISTO', id])
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Divergências");
    XLSX.writeFile(wb, `Divergencias_Entrada.xlsx`);
  };

  if (showReconciliation) {
    const missing = reconciliationSnapshot?.missing || missingItems;
    const unexpected = reconciliationSnapshot?.unexpected || unexpectedItems;

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <button onClick={() => setShowReconciliation(false)} className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-xs uppercase">
            <span className="material-symbols-outlined text-sm">arrow_back</span> Voltar ao Scan
          </button>
          <button onClick={exportDiscrepancies} className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">download</span> Exportar Excel
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-orange-500/10 border-b border-orange-500/20 flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Faltantes</h4>
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full text-[10px] font-bold text-orange-600 border border-orange-500/20">{missing.length}</span>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {missing.map(id => <div key={id} className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded text-xs font-mono mb-2 border border-slate-100 dark:border-slate-800">{id}</div>)}
            </div>
          </div>
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-primary/10 border-b border-primary/20 flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Não Previstos</h4>
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full text-[10px] font-bold text-primary border border-primary/20">{unexpected.length}</span>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {unexpected.map(id => <div key={id} className="bg-primary/5 p-2 rounded text-xs font-mono mb-2 text-primary font-bold border border-primary/10">{id}</div>)}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={refreshData}>
      <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        {expectedInboundList.length > 0 && (
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden relative">
            <div className="flex justify-between items-end mb-3 relative z-10">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Progresso</p>
                <h2 className="text-3xl font-display font-bold text-slate-800 dark:text-white">
                  {matches.length} <span className="text-slate-400 text-lg font-medium">/ {expectedInboundList.length}</span>
                </h2>
              </div>
              <button onClick={handleFinalize} className="bg-primary text-white px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20">
                Finalizar
              </button>
            </div>
            <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 relative z-10">
              <div className="h-full bg-gradient-to-r from-primary to-cyan-500 transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }}></div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Escaneamento Ativo</h3>
              </div>
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 transition-colors border border-slate-200 dark:border-slate-800">
                <span className="material-symbols-outlined text-base">cloud_upload</span>
                {expectedInboundList.length > 0 ? 'Atualizar Previsto' : 'Subir Arquivo'}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
            </div>
          </div>
          <form onSubmit={handleScan} className="relative">
            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-400">barcode_scanner</span>
            </div>
            <input ref={inputRef} autoFocus type="text" value={scanValue} onChange={(e) => setScanValue(e.target.value)} className="w-full h-20 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-xl pl-16 pr-6 text-3xl font-mono tracking-widest focus:border-primary focus:ring-0 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 uppercase" placeholder="BIPE O CÓDIGO TBR..." />
          </form>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Histórico de Scans</h3>
          </div>
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-900/40 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">TBR ID</th>
                  <th className="px-6 py-3 text-right">Horário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {inboundItems.filter(item => isSameDay(item.time || (item as any).created_at)).length === 0 ? (
                  <tr><td colSpan={3} className="px-6 py-8 text-center text-xs text-slate-400">Nenhum bipe realizado hoje.</td></tr>
                ) : (
                  inboundItems.filter(item => isSameDay(item.time || (item as any).created_at)).map((scan, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-3">
                        <div className={`flex items-center gap-2 ${scan.error ? 'text-red-500' : 'text-green-500'}`}>
                          <span className="material-icons-round text-sm">{scan.error ? 'cancel' : 'check_circle'}</span>
                          <span className="text-[10px] font-bold uppercase">{scan.status}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{scan.id}</td>
                      <td className="px-6 py-3 text-right text-[10px] font-mono text-slate-400">{formatToLocalTime(scan.time || (scan as any).created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </PullToRefresh>
  );
};

export default InboundView;
