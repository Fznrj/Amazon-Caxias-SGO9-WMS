import { isValidTbr } from '../utils/validation';

const InventoryView: React.FC = () => {
  const { inventoryItems, addInventoryItem, isInventoryActive, startInventory, stopInventory, stockItems, possibleLossItems, currentUser, localizeItem, playAudio } = useWms();
  const [tbrId, setTbrId] = useState('');
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  // Localization States
  const [localizingItem, setLocalizingItem] = useState<string | null>(null);
  const [scanModalInput, setScanModalInput] = useState('');

  // Total Expected is the items currently marked as 'Em Estoque'
  const totalExpected = stockItems.filter(item => item.status?.toLowerCase() === 'em estoque').length;
  const currentCount = inventoryItems.length;
  // Prevent division by zero if stock is empty
  const progressPercentage = totalExpected > 0 ? Math.min((currentCount / totalExpected) * 100, 100) : 0;

  // Cálculo para o gráfico de rosca
  const strokeDasharray = 251.32;
  const strokeDashoffset = strokeDasharray * (1 - progressPercentage / 100);

  const handleScan = async () => {
    if (!tbrId.trim()) return;
    const currentId = tbrId.trim().toUpperCase();

    const validation = isValidTbr(currentId);
    if (!validation.isValid) {
      setMessage({ text: validation.message || 'ERRO: TBR Inválida.', type: 'error' });
      playAudio('error');
      setTbrId('');
      return;
    }

    await addInventoryItem({
      id: currentId,
      time: getSaoPauloIso(),
      operator: currentUser?.name || 'Sistema'
    });

    setMessage({ text: `TBR ${tbrId} processado!`, type: 'success' });
    setTimeout(() => setMessage(null), 2000);
    setTbrId('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  const isLocalizable = (lossDetectedTime?: string) => {
    if (!lossDetectedTime) return true;
    const lossTime = new Date(lossDetectedTime).getTime();
    const now = new Date().getTime();
    const hoursElapsed = (now - lossTime) / (1000 * 60 * 60);
    return hoursElapsed <= 72;
  };

  const confirmLocalization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localizingItem || !scanModalInput.trim()) return;

    const result = await localizeItem(localizingItem, scanModalInput.trim().toUpperCase());
    if (result.success) {
      setMessage({ text: result.message, type: 'success' });
      setLocalizingItem(null);
      setScanModalInput('');
      setTimeout(() => setMessage(null), 3000);
    } else {
      setMessage({ text: result.message, type: 'error' });
      setScanModalInput('');
      // If it failed but it was a limit error, close modal so they see the Perda Definitiva status
      if (result.message.includes('72h')) {
        setLocalizingItem(null);
      }
      setTimeout(() => setMessage(null), 5000);
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full relative">
      {/* LOCALIZATION MODAL */}
      {localizingItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-white mb-1 uppercase tracking-wider">Localizar TBR</h3>
                <p className="text-slate-400 text-sm">Bipe o código da TBR <span className="text-primary font-mono font-bold">{localizingItem}</span> para confirmar.</p>
              </div>
              <button
                onClick={() => { setLocalizingItem(null); setScanModalInput(''); }}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <span className="material-icons-round">close</span>
              </button>
            </div>

            <form onSubmit={confirmLocalization} className="space-y-6">
              <div className="relative">
                <span className="material-icons-round absolute left-4 top-1/2 -translate-y-1/2 text-primary">qr_code_scanner</span>
                <input
                  autoFocus
                  className="w-full bg-slate-800 border-2 border-slate-700 focus:border-primary px-12 py-5 rounded-xl text-2xl font-mono text-white outline-none transition-all placeholder:text-slate-600 uppercase"
                  placeholder="Escanear TBR..."
                  value={scanModalInput}
                  onChange={(e) => setScanModalInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl uppercase tracking-widest transition-all shadow-lg shadow-primary/20"
              >
                Confirmar Localização
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="col-span-12 lg:col-span-3 space-y-6">
        {/* GRÁFICO DE CONCILIAÇÃO */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl flex flex-col h-full lg:h-auto">
          <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 text-center">Conciliação do Inventário</h3>
          <div className="flex flex-col items-center justify-center flex-1 py-4">
            <div className="relative w-48 h-48 flex items-center justify-center">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full transform -rotate-90"
              >
                {/* Círculo de Fundo */}
                <circle
                  className="text-slate-800"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                />
                {/* Círculo de Progresso */}
                <circle
                  className="text-primary transition-all duration-1000 ease-out"
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="40"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  strokeLinecap="round"
                />
              </svg>
              {/* Texto Centralizado */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-5xl font-display font-bold text-white tracking-tighter leading-none">{Math.round(progressPercentage)}%</span>
                <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest mt-1">Concluído</p>
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between px-4">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total</p>
              <p className="text-sm font-bold text-white">{totalExpected}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Faltam</p>
              <p className="text-sm font-bold text-primary">{Math.max(0, totalExpected - currentCount)}</p>
            </div>
          </div>
        </section>

        <section className="bg-slate-900/20 border border-slate-800 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center">
          <span className="material-icons-round text-slate-700 text-3xl mb-2">info</span>
          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest leading-relaxed">
            Acompanhamento de metas em tempo real baseado em bips operacionais.
          </p>
        </section>
      </div>

      <div className="col-span-12 lg:col-span-6 space-y-6">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden h-80 justify-center group flex-1">
          {!isInventoryActive ? (
            <div className="z-10 flex flex-col items-center">
              <span className="material-icons-round text-slate-600 text-6xl mb-4">inventory</span>
              <h2 className="text-2xl font-bold text-white mb-2 uppercase font-display tracking-widest">Inventário Pausado</h2>
              <button
                onClick={async () => await startInventory()}
                className="mt-6 bg-primary hover:bg-primary/90 text-white font-bold py-3 px-8 rounded-full uppercase tracking-widest transition-all shadow-lg hover:shadow-primary/25"
              >
                Iniciar Inventário
              </button>
            </div>
          ) : (
            <>
              <div className="absolute top-4 right-4 z-20">
                <button onClick={async () => await stopInventory()} className="text-xs uppercase font-bold text-red-500 border border-red-500/50 px-3 py-1 rounded hover:bg-red-500/10">Parar</button>
              </div>
              <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-icons-round text-primary text-[120px]">qr_code_scanner</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2 uppercase font-display tracking-widest z-10">Aguardando Bipagem...</h2>
              <p className="text-slate-400 mb-8 max-w-sm z-10 font-medium">Insira ou bipe o ID da unidade TBR para processar no inventário.</p>
              <div className="w-full max-w-lg relative z-10">
                <input
                  className="w-full bg-slate-800/80 border-2 border-primary/30 focus:border-primary text-2xl font-mono text-center py-5 rounded-2xl text-white outline-none transition-all placeholder:text-slate-700 uppercase tracking-widest shadow-inner focus:ring-4 focus:ring-primary/10"
                  placeholder="Ex: TBR-12345678"
                  type="text"
                  value={tbrId}
                  onChange={(e) => setTbrId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  autoFocus
                />
                <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-2">
                  <kbd className="px-2 py-1 bg-slate-700 text-[10px] rounded-lg text-slate-300 font-bold border border-slate-600 shadow-sm">ENTER</kbd>
                </div>
              </div>
              {message && (
                <div className={`mt-4 font-bold uppercase tracking-wider animate-pulse ${message.type === 'error' ? 'text-red-400' : 'text-green-400'}`}>
                  {message.text}
                </div>
              )}
            </>
          )}
        </section>

        <section className="bg-slate-900/40 border border-slate-800 rounded-xl flex flex-col h-[400px] shadow-inner">
          <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-900/60 rounded-t-xl">
            <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2 uppercase tracking-widest">
              <span className="material-icons-round text-primary text-lg">stream</span> Feed de Atividade ao Vivo
            </h3>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {inventoryItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:border-primary/40 transition-all cursor-default group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-sm font-bold group-hover:bg-primary group-hover:text-white transition-all shadow-sm">
                    {item.operator.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-mono font-bold text-white group-hover:text-primary transition-colors">{item.id}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Bipado por: <span className="text-slate-300">{item.operator}</span></p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-slate-500 font-mono italic">{item.time}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="col-span-12 lg:col-span-3">
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-full flex flex-col shadow-xl">
          <h3 className="text-xs font-bold text-red-400 uppercase tracking-widest flex items-center gap-2 mb-6">
            <span className="material-icons-round text-lg">warning</span> Possível Perda
          </h3>
          <div className="space-y-4 overflow-y-auto flex-1 h-0 min-h-0">
            {possibleLossItems.length === 0 ? (
              <p className="text-slate-500 text-xs italic text-center mt-10">Nenhuma perda detectada.</p>
            ) : (
              possibleLossItems.map((item, i) => {
                const canLocalize = isLocalizable(item.lossDetectedTime);
                return (
                  <div key={i} className="bg-slate-800/30 border border-red-500/10 p-4 rounded-xl hover:border-red-500/30 transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <p className="text-sm font-mono font-bold text-white group-hover:text-red-400 transition-colors">{item.id}</p>
                      <button className="text-slate-600 hover:text-white transition-colors">
                        <span className="material-icons-round text-lg">more_horiz</span>
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Último Local: <span className="text-slate-400">STOCK</span></p>
                    <div className="mt-4 flex items-center justify-between bg-black/40 px-3 py-2.5 rounded-lg border border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="material-icons-round text-xs text-secondary animate-pulse">schedule</span>
                        <span className="text-xs font-bold text-secondary font-mono tracking-tighter">{formatToLocalTime(item.entryTime)}</span>
                      </div>
                      <button
                        onClick={() => canLocalize && setLocalizingItem(item.id)}
                        disabled={!canLocalize}
                        className={`text-[9px] font-extrabold uppercase tracking-widest transition-colors ${canLocalize ? 'text-primary hover:text-white' : 'text-slate-600 cursor-not-allowed'}`}
                      >
                        {canLocalize ? 'Localizar' : 'Perda Definitiva'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <button className="w-full mt-6 bg-slate-800/50 hover:bg-slate-800 border border-slate-700 hover:border-primary/50 py-4 rounded-xl text-[10px] font-bold text-slate-400 hover:text-white transition-all uppercase tracking-widest shadow-lg">
            Ver Todos Possível Perda
          </button>
        </section>
      </div>
    </div>
  );
};

export default InventoryView;
