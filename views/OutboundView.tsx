
import React, { useState } from 'react';
import { useWms } from '../context/WmsContext';

const OutboundView: React.FC = () => {
  const { outboundItems, addOutboundItem, deleteOutboundItem, playAudio, drivers, stockItems, totalOutboundToday, totalReversaToday, currentUser } = useWms();
  const [tbrInput, setTbrInput] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const processOutbound = async () => {
    if (!tbrInput.trim()) return;
    if (!selectedDriverId) {
      alert('Selecione um motorista antes de confirmar!');
      return;
    }

    const currentId = tbrInput.toUpperCase();
    const driver = drivers.find(d => d.id === selectedDriverId);

    if (!driver) {
      alert('Motorista não encontrado!');
      return;
    }

    // 1. Prefix check
    if (!currentId.startsWith('TBR')) {
      setMessage({ text: 'ERRO: Prefixo inválido. Deve começar com TBR.', type: 'error' });
      playAudio('error');
      setTbrInput('');
      return;
    }

    // 2. Stock check (Main validation)
    const stockItem = stockItems.find(item => item.id === currentId);

    if (!stockItem || stockItem.status !== 'Em Estoque') {
      const statusMsg = stockItem?.status === 'Saiu'
        ? `ERRO: TBR ${currentId} já foi expedida anteriormente. Se ela retornou, faça o recebimento na Entrada.`
        : stockItem?.status === 'Possível Perda'
          ? `ERRO: TBR ${currentId} está como Possível Perda. Re-receba na Entrada.`
          : `ERRO: TBR ${currentId} não encontrada no estoque.`;

      setMessage({ text: statusMsg, type: 'error' });
      playAudio('error');
      setTbrInput('');
      return;
    }

    const result = await addOutboundItem({
      id: currentId,
      driverName: driver.name,
      vehicle: `${driver.vehicleProfile} (${driver.plate})`,
      time: new Date().toLocaleString('pt-BR'),
      operator: currentUser?.name || 'Sistema',
      status: 'Saiu com Motorista'
    });

    if (result.success) {
      setMessage({ text: `Saída registrada: ${currentId}`, type: 'success' });
      setTimeout(() => setMessage(null), 2000);
      setTbrInput('');
    } else {
      setMessage({ text: `ERRO: ${result.message}`, type: 'error' });
      playAudio('error');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processOutbound();
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-cyan-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Aguardando Saída</p>
          <p className="text-2xl font-display font-bold text-cyan-500">
            {stockItems.filter(item => item.status === 'Em Estoque').length}
          </p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-red-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Saídas Hoje</p>
          <p className="text-2xl font-display font-bold text-red-500">{totalOutboundToday}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-green-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Reversa Hoje</p>
          <p className="text-2xl font-display font-bold text-green-500">{totalReversaToday}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-purple-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Motoristas Ativos</p>
          <p className="text-2xl font-display font-bold text-purple-500">{drivers.filter(d => d.status === 'Ativo').length}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-orange-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">TBRs Pendentes</p>
          <p className="text-2xl font-display font-bold text-orange-500">
            {stockItems.filter(item => item.status === 'Em Estoque').length}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row gap-6 items-end">
          <div className="flex-1 w-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Selecionar Motorista</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">local_shipping</span>
              <select
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-10 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none appearance-none cursor-pointer"
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
              >
                <option value="">Selecione um motorista...</option>
                {drivers.filter(d => d.status === 'Ativo').map(driver => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name} ({driver.plate}) - {driver.vehicleProfile}
                  </option>
                ))}
              </select>
              <span className="material-icons-round absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
          <div className="flex-[2] w-full">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Escanear TBR (Barcode/Manual)</label>
            <div className="relative">
              <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">qr_code_scanner</span>
              <input
                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-10 py-3 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400 uppercase font-mono"
                placeholder="TBR123456"
                value={tbrInput}
                onChange={(e) => setTbrInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
          </div>

          <button
            onClick={processOutbound}
            className="w-full md:w-auto px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded font-bold uppercase text-xs tracking-wider transition-all shadow-lg shadow-primary/20"
          >
            Confirmar
          </button>
        </div>
        {message && (
          <div className={`mt-4 font-bold text-sm uppercase tracking-wide animate-pulse ${message.type === 'error' ? 'text-red-500' : 'text-green-500'}`}>
            {message.text}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center">
          <h3 className="font-display font-bold text-slate-500 uppercase tracking-widest text-sm">TBRs em Processo de Saída</h3>
          <div className="flex items-center gap-2 text-[10px] uppercase font-bold text-slate-400">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></div>
            Em carregamento
            <span className="material-icons-round ml-2">filter_list</span>
          </div>
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50 text-[10px] font-bold uppercase tracking-widest text-slate-500">
              <th className="px-6 py-4">ID TBR</th>
              <th className="px-6 py-4">Motorista / Veículo</th>
              <th className="px-6 py-4">Expedido por</th>
              <th className="px-6 py-4">Horário Registro</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {outboundItems.map((item, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-primary text-sm">{item.id}</td>
                <td className="px-6 py-4">
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{item.driverName}</p>
                  <p className="text-[10px] uppercase font-bold text-slate-400">{item.vehicle}</p>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-500">
                      {item.operator?.substring(0, 2).toUpperCase() || 'SI'}
                    </div>
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{item.operator}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-[11px] font-mono text-slate-500">{item.time}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 border rounded text-[9px] font-extrabold uppercase tracking-widest ${item.status === 'Reversa - Saiu com Motorista'
                    ? 'bg-green-500/10 text-green-500 border-green-500/20'
                    : 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20'
                    }`}>
                    {item.status?.replace(' - Saiu com Motorista', '') || 'Sem Status'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={async () => {
                      if (window.confirm(`Remover saída da TBR ${item.id}? O item voltará para o estoque.`)) {
                        await deleteOutboundItem(item.id);
                      }
                    }}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <span className="material-icons-round text-base">delete_outline</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OutboundView;

