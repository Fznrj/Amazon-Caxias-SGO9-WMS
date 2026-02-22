import React, { useState } from 'react';
import { formatToLocalTime } from '../utils/dateUtils';
import { useWms } from '../context/WmsContext';
import { getTodayDate } from '../utils/dateUtils';
import { isValidTbr } from '../utils/validation';

const TreatmentView: React.FC = () => {
  const {
    stockItems,
    possibleLossItems,
    totalLossItems,
    treatmentItems,
    addTreatment,
    updateTreatmentStatus,
    updateTreatment,
    currentUser,
    localizeItem,
    staleStockItems,
    staleItemsCount,
    playAudio
  } = useWms();
  const [showLogForm, setShowLogForm] = useState(false);
  const [newIncident, setNewIncident] = useState({ tbrId: '', type: 'Avaria' as any, description: '' });

  // Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingIncident, setEditingIncident] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ type: 'Avaria' as any, description: '' });

  const now = getTodayDate().getTime();

  // 1. Calculate items stuck for more than 24 hours with display info
  const parados = staleStockItems.map(item => {
    try {
      const entryDate = new Date(item.entryTime).getTime();
      const hours = (now - entryDate) / (1000 * 60 * 60);
      const percent = Math.min(100, Math.round((hours / 72) * 100));
      return { ...item, percent, timeRem: `${Math.max(0, Math.round(72 - hours))}h restantes` };
    } catch (e) {
      return { ...item, percent: 0, timeRem: 'Erro de data' };
    }
  });

  const handleLogIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIncident.tbrId || !newIncident.description) return;

    const currentId = newIncident.tbrId.trim().toUpperCase();
    const validation = isValidTbr(currentId);
    if (!validation.isValid) {
      alert(validation.message);
      playAudio('error');
      return;
    }

    const result = await addTreatment({
      tbrId: currentId,
      type: newIncident.type,
      description: newIncident.description,
      operator: currentUser?.name || 'Sistema'
    });

    if (result.success) {
      setNewIncident({ tbrId: '', type: 'Avaria', description: '' });
      setShowLogForm(false);
    } else {
      alert(result.message);
    }
  };

  const handleOpenEdit = (incident: any) => {
    setEditingIncident(incident);
    setEditFormData({ type: incident.type, description: incident.description });
    setIsEditModalOpen(true);
  };

  const handleUpdateIncident = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingIncident) return;
    await updateTreatment(editingIncident.id, editFormData);
    setIsEditModalOpen(false);
    setEditingIncident(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Resolvido': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'Em Análise': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header Cards ... (keep as is) ... */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 opacity-70">Incidentes Abertos</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-display font-bold text-slate-800 dark:text-white">
              {treatmentItems.filter(t => t.status !== 'Resolvido').length}
            </h3>
            <span className="text-[10px] font-bold text-slate-400">UNID</span>
          </div>
        </div>
        <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 opacity-70">Parados +1 Dia</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-display font-bold text-secondary">{parados.length}</h3>
            <span className="text-[10px] font-bold text-secondary/60">ALERTA</span>
          </div>
        </div>
        <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 opacity-70">Possíveis Perdas</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-display font-bold text-red-500">{possibleLossItems.length}</h3>
            <span className="text-[10px] font-bold text-red-500/60">CRÍTICO</span>
          </div>
        </div>
        <div className="bg-white dark:bg-card-dark p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:scale-[1.02]">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1 opacity-70">Perdas / Extravios</p>
          <div className="flex items-baseline gap-2">
            <h3 className="text-3xl font-display font-bold text-black dark:text-white">{totalLossItems}</h3>
            <span className="text-[10px] font-bold text-slate-400">TOTAL</span>
          </div>
        </div>
      </div>

      {/* Action Bar ... (keep as is) ... */}
      <div className="flex justify-between items-center bg-white dark:bg-card-dark p-4 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
        <h3 className="font-display font-bold text-slate-600 uppercase tracking-widest text-sm">Gestão de Tratativas</h3>
        <button
          onClick={() => setShowLogForm(!showLogForm)}
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
        >
          {showLogForm ? 'Cancelar' : 'Log Novo Incidente'}
        </button>
      </div>

      {/* Log Incident Form */}
      {showLogForm && (
        <form onSubmit={handleLogIncident} className="bg-white dark:bg-card-dark p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 px-1">TBR ID</label>
              <input
                type="text"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none uppercase font-mono"
                placeholder="TBR000000"
                value={newIncident.tbrId}
                onChange={e => setNewIncident({ ...newIncident, tbrId: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 px-1">Tipo de Problema</label>
              <select
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                value={newIncident.type}
                onChange={e => setNewIncident({ ...newIncident, type: e.target.value as any })}
              >
                <option value="Avaria">Avaria</option>
                <option value="Extravio">Extravio</option>
                <option value="Erro de Sistema">Erro de Sistema</option>
                <option value="Outros">Outros</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 px-1">Observação</label>
              <input
                type="text"
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                placeholder="Ex: Danificado no processo..."
                value={newIncident.description}
                onChange={e => setNewIncident({ ...newIncident, description: e.target.value })}
                required
              />
            </div>
          </div>
          <button type="submit" className="mt-6 w-full bg-primary py-3 rounded text-[11px] font-bold uppercase text-white shadow-lg shadow-primary/20 hover:scale-[1.01] transition-all">
            Registrar Incidente
          </button>
        </form>
      )}

      {/* Incident List */}
      <section>
        <div className="bg-white dark:bg-card-dark rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <div className="p-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Histórico de Incidentes</h4>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-4">Protocolo</th>
                <th className="px-6 py-4">TBR ID</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Operador</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {treatmentItems.filter(t => t.status !== 'Resolvido').length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">Nenhum incidente ativo</td>
                </tr>
              ) : (
                treatmentItems.filter(t => t.status !== 'Resolvido').map((t, i) => (
                  <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4 text-[10px] font-bold text-slate-400">{t.id}</td>
                    <td className="px-6 py-4 font-mono text-sm text-primary font-bold">{t.tbrId}</td>
                    <td className="px-6 py-4 text-xs font-medium text-slate-600">{t.type}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold uppercase">
                          {t.operator.charAt(0)}
                        </span>
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{t.operator}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded border text-[8px] font-bold uppercase tracking-wider ${getStatusColor(t.status)}`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleOpenEdit(t)}
                        className="text-slate-400 hover:text-primary transition-colors p-2"
                        title="Editar Detalhes"
                      >
                        <span className="material-icons-round text-sm">edit</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Edit Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-card-dark w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/20">
              <div>
                <h3 className="font-bold text-lg text-slate-800 dark:text-white uppercase tracking-tight">Editar Incidente</h3>
                <p className="text-[10px] font-bold text-primary uppercase">{editingIncident?.id} • {editingIncident?.tbrId}</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-2">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            <form onSubmit={handleUpdateIncident} className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500 px-1">Tipo de Problema</label>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                    value={editFormData.type}
                    onChange={e => setEditFormData({ ...editFormData, type: e.target.value as any })}
                  >
                    <option value="Avaria">Avaria</option>
                    <option value="Extravio">Extravio</option>
                    <option value="Erro de Sistema">Erro de Sistema</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500 px-1">Observação</label>
                  <textarea
                    rows={4}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    placeholder="Altere a observação..."
                    value={editFormData.description}
                    onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 bg-slate-100 dark:bg-slate-800 py-3 rounded text-[11px] font-bold uppercase text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-primary py-3 rounded text-[11px] font-bold uppercase text-white shadow-lg shadow-primary/20 hover:scale-[1.01] transition-all"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Possible Losses Section - FIXED TO SHOW ACTUAL DATA */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-8 bg-red-500 rounded-full"></div>
            <h3 className="font-display text-xl tracking-wide uppercase">Possíveis Perdas (Fila de Auditoria)</h3>
            <span className="bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-xs font-bold border border-red-500/20">{possibleLossItems.length} UNIDADES</span>
          </div>
        </div>
        <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 font-bold">
                <th className="px-6 py-4">TBR ID</th>
                <th className="px-6 py-4">Data Registro</th>
                <th className="px-6 py-4">Funcionário</th>
                <th className="px-6 py-4">Contagem Regressiva</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {possibleLossItems.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">Nenhuma perda detectada no sistema</td>
                </tr>
              ) : (
                possibleLossItems.map((p, i) => {
                  const lossTime = p.lossDetectedTime ? new Date(p.lossDetectedTime).getTime() : now;
                  const hours = Math.max(0, 72 - (now - lossTime) / (1000 * 60 * 60));
                  return (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-6 py-4 font-mono text-sm text-primary font-bold">{p.id}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{p.lossDetectedTime ? formatToLocalTime(p.lossDetectedTime) : '-'}</td>
                      <td className="px-6 py-4 text-xs text-slate-500">{p.operator}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-red-500">
                          <span className="material-icons-round text-sm animate-pulse">timer</span>
                          <span className="font-mono text-xs font-bold uppercase">{Math.round(hours)}H RESTANTES</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={async () => {
                            const input = prompt(`Bipe a TBR ${p.id} para confirmar:`);
                            if (input) await localizeItem(p.id, input.toUpperCase());
                          }}
                          className="bg-primary hover:bg-primary/90 text-white px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                        >
                          Confirmar Localização
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default TreatmentView;
