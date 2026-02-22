import React, { useState, useRef } from 'react';
import { useWms } from '../context/WmsContext';
import * as XLSX from 'xlsx';
import { isSameDay, getTodayDate, formatToLocalTime, getSaoPauloIso } from '../utils/dateUtils';

import { isValidTbr } from '../utils/validation';

const InboundView: React.FC = () => {
  const [scanValue, setScanValue] = useState('');
  const [showReconciliation, setShowReconciliation] = useState(false);
  const [reconciliationSnapshot, setReconciliationSnapshot] = useState<{ missing: string[], unexpected: string[] } | null>(null);
  const { inboundItems, addInboundItem, currentUser, stockItems, playAudio, expectedInboundList, setExpectedInboundList, clearInboundManifest } = useWms();
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
          setReconciliationSnapshot(null); // Clear previous snapshot
          playAudio('success');
        } else {
          alert('Nenhuma TBR válida encontrada no arquivo! (Deve começar com TBR e ter 12-15 caracteres)');
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

  // Progress Calculation - Filter by Today (simulated)
  const successfulScans = Array.from(new Set(
    inboundItems
      .filter(item => !item.error && isSameDay(item.time || (item as any).created_at))
      .map(item => item.id)
  ));

  const missingItems = expectedInboundList.filter(id => !successfulScans.includes(id));
  const unexpectedItems = successfulScans.filter(id => !expectedInboundList.includes(id));

  const matches = expectedInboundList.filter(id => successfulScans.includes(id));
  const progressPercent = expectedInboundList.length > 0
    ? Math.round((matches.length / expectedInboundList.length) * 100)
    : 0;

  const handleFinalize = async () => {
    if (!confirm('Deseja finalizar este recebimento? Isso limpará a lista esperada atual, mas manterá o histórico de bipes.')) return;

    // Capture snapshot for reconciliation view
    setReconciliationSnapshot({
      missing: missingItems,
      unexpected: unexpectedItems
    });

    await clearInboundManifest();
    setShowReconciliation(true);
    playAudio('success');
  };

  const exportDiscrepancies = () => {
    const missing = reconciliationSnapshot?.missing || missingItems;
    const unexpected = reconciliationSnapshot?.unexpected || unexpectedItems;

    const data = [
      ['Tipo', 'Código TBR'],
      ...missing.map(id => ['FALTANTE (Esperado, não recebido)', id]),
      ...unexpected.map(id => ['NÃO PREVISTO (Surpresa, recebido)', id])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Divergências");
    XLSX.writeFile(wb, `Divergencias_Entrada_${new Date().toLocaleDateString()}.xlsx`);
  };

  if (showReconciliation) {
    const missing = reconciliationSnapshot?.missing || missingItems;
    const unexpected = reconciliationSnapshot?.unexpected || unexpectedItems;

    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowReconciliation(false)}
            className="flex items-center gap-2 text-slate-500 hover:text-primary transition-colors font-bold text-xs uppercase"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span> Voltar ao Scan
          </button>
          <div className="flex gap-3">
            <button
              onClick={exportDiscrepancies}
              className="bg-white dark:bg-card-dark border border-slate-200 dark:border-slate-800 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">download</span> Exportar Excel
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Missing Section */}
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-orange-500/10 border-b border-orange-500/20 flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Faltantes (Não Recebidos)</h4>
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full text-[10px] font-bold text-orange-600 border border-orange-500/20">
                {missing.length} IDs
              </span>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {missing.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400 italic">Nenhuma falta detectada.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {missing.map(id => (
                    <div key={id} className="bg-slate-50 dark:bg-slate-900/50 p-2 rounded text-xs font-mono text-slate-500 border border-slate-100 dark:border-slate-800 truncate">
                      {id}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Unexpected Section */}
          <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="p-4 bg-primary/10 border-b border-primary/20 flex justify-between items-center">
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary">Não Previstos (Surpresas)</h4>
              <span className="bg-white dark:bg-slate-900 px-2 py-0.5 rounded-full text-[10px] font-bold text-primary border border-primary/20">
                {unexpected.length} IDs
              </span>
            </div>
            <div className="p-4 max-h-[400px] overflow-y-auto">
              {unexpected.length === 0 ? (
                <p className="text-center py-8 text-xs text-slate-400 italic">Nenhum item extra detectado.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {unexpected.map(id => (
                    <div key={id} className="bg-primary/5 p-2 rounded text-xs font-mono text-primary font-bold border border-primary/10 truncate">
                      {id}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* ProgressBar Section */}
      {expectedInboundList.length > 0 && (
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm overflow-hidden relative">
          <div className="flex justify-between items-end mb-3 relative z-10">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Progresso de Recebimento</p>
              <h2 className="text-3xl font-display font-bold text-slate-800 dark:text-white">
                {matches.length} <span className="text-slate-400 text-lg font-medium">/ {expectedInboundList.length}</span>
              </h2>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button
                onClick={handleFinalize}
                className="bg-primary text-white px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
              >
                Finalizar Recebimento
              </button>
              <div className={`px-2 py-0.5 rounded-full text-[8px] font-bold ${progressPercent === 100 ? 'bg-green-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                {progressPercent}% CONCLUÍDO
              </div>
            </div>
          </div>
          <div className="h-4 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800 relative z-10">
            <div
              className="h-full bg-gradient-to-r from-primary to-cyan-500 transition-all duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Escaneamento Ativo</h3>
              <p className="text-xs text-slate-400">Aguardando leitura do código de barras...</p>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800 hidden md:block mx-2"></div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 transition-colors border border-slate-200 dark:border-slate-800"
            >
              <span className="material-symbols-outlined text-base">cloud_upload</span>
              {expectedInboundList.length > 0 ? 'Atualizar Previsto' : 'Subir Arquivo'}
            </button>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".xlsx,.xls,.csv" className="hidden" />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-primary"></div>
              </label>
              <span className="text-[10px] font-bold uppercase text-slate-500">Modo Contínuo</span>
            </div>
          </div>
        </div>

        <form onSubmit={handleScan} className="relative">
          <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-slate-400">barcode_scanner</span>
          </div>
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={scanValue}
            onChange={(e) => setScanValue(e.target.value)}
            className="w-full h-20 bg-slate-50 dark:bg-slate-900/50 border-2 border-slate-200 dark:border-slate-800 rounded-xl pl-16 pr-6 text-3xl font-mono tracking-widest focus:border-primary focus:ring-0 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 uppercase"
            placeholder="BIPE O CÓDIGO TBR..."
          />
        </form>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Histórico de Scans</h3>
          {successfulScans.length > 0 && <span className="text-[10px] font-mono text-slate-400">{successfulScans.length} unidades processadas</span>}
        </div>
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-slate-800">
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">TBR ID</th>
                <th className="px-6 py-3">Fila</th>
                <th className="px-6 py-3 text-right">Horário</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {inboundItems.filter(item => isSameDay(item.time || (item as any).created_at)).length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-8 text-center text-xs text-slate-400">Nenhum bipe realizado hoje.</td></tr>
              ) : (
                inboundItems
                  .filter(item => isSameDay(item.time || (item as any).created_at))
                  .map((scan, i) => {
                    const isExpected = expectedInboundList.includes(scan.id);
                    return (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-6 py-3">
                          <div className={`flex items-center gap-2 ${scan.error ? 'text-red-500' : 'text-green-500'}`}>
                            <span className="material-icons-round text-sm">{scan.error ? 'cancel' : 'check_circle'}</span>
                            <span className="text-[10px] font-bold uppercase">{scan.status}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{scan.id}</td>
                        <td className="px-6 py-3">
                          {expectedInboundList.length > 0 && !scan.error && (
                            <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border ${isExpected ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-orange-500/10 text-orange-500 border-orange-500/20'}`}>
                              {isExpected ? 'Previsto' : 'Surpresa'}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right text-[10px] font-mono text-slate-400">{formatToLocalTime(scan.time || (scan as any).created_at)}</td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InboundView;
