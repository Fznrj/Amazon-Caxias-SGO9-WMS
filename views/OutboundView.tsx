import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWmsData } from '../context/WmsDataContext';
import { useKpi } from '../context/KpiContext';
import { useWms } from '../context/WmsContext';
import { isSameDay, getTodayDate, formatToLocalTime, getSaoPauloIso } from '../utils/dateUtils';
import { isValidTbr } from '../utils/validation';

const OutboundView: React.FC = () => {
  const { currentUser } = useAuth();
  const { stockItems, treatmentItems } = useWmsData();
  const { statsSummary: { totalOutboundToday, totalReversaToday } } = useKpi();
  const {
    addOutboundItem, playAudio, drivers,
    activeDriversCount, availableStockCount, fetchDriverTodayCount
  } = useWms();

  const [tbrInput, setTbrInput] = useState('');
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  // ESTADO DE ALTO VOLUME: Contador local para feedback instantâneo (Zero Lag)
  const [sessionDriverCount, setSessionDriverCount] = useState(0);
  const [isLoadingDriverCount, setIsLoadingDriverCount] = useState(false);

  // Busca a contagem real do motorista ao selecioná-lo
  React.useEffect(() => {
    const loadDriverCount = async () => {
      if (selectedDriverId) {
        setIsLoadingDriverCount(true);
        const count = await fetchDriverTodayCount(selectedDriverId);
        setSessionDriverCount(count);
        setIsLoadingDriverCount(false);
      } else {
        setSessionDriverCount(0);
      }
    };
    loadDriverCount();
  }, [selectedDriverId, fetchDriverTodayCount]);

  const processOutbound = async () => {
    if (!tbrInput.trim()) return;
    if (!selectedDriverId) {
      alert('Selecione um motorista antes de confirmar!');
      return;
    }

    const currentId = tbrInput.trim().toUpperCase();
    const driver = drivers.find(d => d.id === selectedDriverId);

    if (!driver) {
      alert('Motorista não encontrado!');
      return;
    }

    // 1. Validação de Regra de Negócio
    const { isValid, message: vMsg } = isValidTbr(currentId);
    if (!isValid) {
      setMessage({ text: vMsg || 'ERRO: TBR Inválida.', type: 'error' });
      playAudio('error');
      setTbrInput('');
      return;
    }

    // 2. Verificação de Tratativas (Incidents)
    const activeIncident = treatmentItems.find(t => t.tbrId === currentId && t.status !== 'Resolvido');
    if (activeIncident) {
      setMessage({
        text: `BLOQUEADO: TBR ${currentId} possui uma tratativa ativa (${activeIncident.id}). Resolva antes de expedir.`,
        type: 'error'
      });
      playAudio('error');
      setTbrInput('');
      return;
    }

    // 3. Verificação de Estoque (Validação Principal)
    const stockItem = stockItems.find(item => item.id === currentId);

    if (!stockItem || stockItem.status?.toLowerCase() !== 'em estoque') {
      const status = stockItem?.status?.toLowerCase();
      const statusMsg = status === 'saiu'
        ? `ERRO: TBR ${currentId} já foi expedida anteriormente.`
        : status === 'possível perda'
          ? `ERRO: TBR ${currentId} está como Possível Perda. Re-receba na Entrada.`
          : `ERRO: TBR ${currentId} não encontrada no estoque.`;

      setMessage({ text: statusMsg, type: 'error' });
      playAudio('error');
      setTbrInput('');
      return;
    }

    // FEEDBACK INSTANTÂNEO (Alto Volume): Incrementa o contador local antes mesmo da resposta do banco
    setSessionDriverCount(prev => prev + 1);
    setMessage({ text: `Bipado com sucesso: ${currentId}`, type: 'success' });
    playAudio('success'); // Feedback sonoro imediato
    setTbrInput('');

    // Gravação em Background
    const result = await addOutboundItem({
      id: currentId,
      driverName: driver.name,
      vehicle: `${driver.vehicleProfile} (${driver.plate})`,
      time: formatToLocalTime(getSaoPauloIso()),
      operator: currentUser?.name || 'Sistema',
      status: 'Saiu com Motorista'
    });

    if (!result.success) {
      // Reverte o contador local se a gravação falhar
      setSessionDriverCount(prev => Math.max(0, prev - 1));
      setMessage({ text: `ERRO DE GRAVAÇÃO: ${result.message}`, type: 'error' });
      playAudio('error');
    } else {
      setTimeout(() => setMessage(null), 1500);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      processOutbound();
    }
  };

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* KPIs de Resumo Superior */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-cyan-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Aguardando Saída</p>
          <p className="text-2xl font-display font-bold text-cyan-500">{availableStockCount}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-red-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Saídas Totais Hoje</p>
          <p className="text-2xl font-display font-bold text-red-500">{totalOutboundToday}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-green-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Reversa Hoje</p>
          <p className="text-2xl font-display font-bold text-green-500">{totalReversaToday}</p>
        </div>
        <div className="bg-white dark:bg-card-dark p-4 rounded border-l-4 border-purple-500 shadow-sm transition-all hover:shadow-md">
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Motoristas Ativos</p>
          <p className="text-2xl font-display font-bold text-purple-500">{activeDriversCount}</p>
        </div>
      </div>

      {/* ÁREA DE OPERAÇÃO: Design focado em performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Painel de Controle */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-card-dark rounded-lg border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
            <div className="space-y-6">
              <div className="w-full">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Selecionar Motorista Ativo</label>
                <div className="relative">
                  <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">local_shipping</span>
                  <select
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-12 py-4 text-sm font-bold focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none appearance-none cursor-pointer transition-all"
                    value={selectedDriverId}
                    onChange={(e) => setSelectedDriverId(e.target.value)}
                  >
                    <option value="">Selecione um motorista para iniciar...</option>
                    {drivers.filter(d => d.status === 'Ativo').map(driver => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name} | {driver.plate} | {driver.vehicleProfile}
                      </option>
                    ))}
                  </select>
                  <span className="material-icons-round absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                </div>
              </div>

              <div className="w-full">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2 block">Escanear TBR (Alta Velocidade)</label>
                <div className="relative">
                  <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">qr_code_scanner</span>
                  <input
                    autoFocus
                    className="w-full bg-slate-50 dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-800 rounded-xl px-12 py-5 text-2xl focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all placeholder:text-slate-300 uppercase font-mono font-black"
                    placeholder="ESCANEAR TBR..."
                    value={tbrInput}
                    onChange={(e) => setTbrInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={!selectedDriverId}
                  />
                  {selectedDriverId && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex gap-2">
                      <span className="bg-primary/10 text-primary text-[10px] px-2 py-1 rounded font-black animate-pulse">PRONTO PARA BIPAR</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {message && (
              <div className={`mt-6 p-4 rounded-lg font-bold text-center text-sm uppercase tracking-widest border transition-all ${message.type === 'error'
                ? 'bg-red-50 dark:bg-red-900/10 text-red-600 border-red-100 dark:border-red-900/20'
                : 'bg-green-50 dark:bg-green-900/10 text-green-600 border-green-100 dark:border-green-900/20 shadow-lg shadow-green-500/10'
                }`}>
                <div className="flex items-center justify-center gap-2">
                  <span className="material-icons-round">{message.type === 'error' ? 'report' : 'check_circle'}</span>
                  {message.text}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resumo do Motorista (Card de Alto Volume) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-card-dark rounded-xl border-2 border-primary/20 p-6 shadow-xl sticky top-8">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-6 flex items-center gap-2">
              <span className="material-icons-round text-sm">assignment_ind</span>
              Resumo da Sessão
            </h3>

            {selectedDriver ? (
              <div className="space-y-6">
                <div>
                  <p className="text-2xl font-black text-slate-800 dark:text-white leading-tight">{selectedDriver.name}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase mt-1">Placa: {selectedDriver.plate}</p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-6 text-center border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Pacotes Bipados Hoje</p>
                  <div className="relative inline-block">
                    <p className={`text-7xl font-black font-display transition-all ${isLoadingDriverCount ? 'opacity-40 blur-[1px]' : 'text-slate-800 dark:text-white'}`}>
                      {sessionDriverCount}
                    </p>
                    {isLoadingDriverCount && (
                      <div className="absolute -top-2 -right-2">
                        <span className="material-icons-round animate-spin text-primary text-sm">sync</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    <span>Status do Carregamento</span>
                    <span className="text-green-500 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                      Ativo em Tempo Real
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-12 text-center space-y-4">
                <span className="material-icons-round text-5xl text-slate-200">person_search</span>
                <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed px-4">
                  Selecione um motorista para visualizar o resumo detalhado das atividades.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rodapé Informativo */}
      <div className="bg-slate-50 dark:bg-slate-900/30 p-4 rounded-lg flex items-center gap-3 text-slate-500">
        <span className="material-icons-round text-lg text-primary">info</span>
        <p className="text-[10px] font-bold uppercase tracking-wide">
          MODO ALTO VOLUME ATIVADO: A listagem detalhada foi removida para garantir a performance do dispositivo. Consulte os relatórios para detalhes históricos.
        </p>
      </div>
    </div>
  );
};

export default OutboundView;

