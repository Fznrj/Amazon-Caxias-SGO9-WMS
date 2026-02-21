
import React from 'react';
import { View, User } from '../types';
import { getTodayDate } from '../utils/dateUtils';

interface HeaderProps {
  viewTitle: View;
  currentUser: User | null;
  isOffline: boolean;
  onToggleOffline: () => void;
}

const Header: React.FC<HeaderProps> = ({ viewTitle, isOffline, onToggleOffline }) => {
  const titles: Record<View, string> = {
    [View.LOGIN]: 'Login',
    [View.DASHBOARD]: 'Dashboard',
    [View.INBOUND]: 'Módulo de Entrada (Inbound)',
    [View.OUTBOUND]: 'Saída (Outbound)',
    [View.INVENTORY]: 'Inventário',
    [View.TREATMENTS]: 'Módulo de Tratativas e Perdas',
    [View.PRODUCTIVITY]: 'Produtividade Operacional',
    [View.REPORTS]: 'Relatórios & Exportações',
    [View.USERS]: 'Gestão de Usuários',
    [View.DRIVERS]: 'Gestão de Motoristas',
    [View.SETTINGS]: 'Configurações',
    [View.REVERSA]: 'Módulo de Logística Reversa',
    [View.GAMIFICATION]: 'Painel de Gamificação e Performance'
  };

  return (
    <header className="h-16 flex items-center justify-between px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark/80 backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <h2 className="font-display text-xl md:text-2xl font-bold uppercase tracking-tight border-l-4 border-primary pl-4">
          {titles[viewTitle]}
        </h2>
      </div>
      <div className="flex items-center gap-6">
        <button
          onClick={onToggleOffline}
          className={`flex items-center gap-2 text-xs font-bold uppercase transition-colors px-3 py-1.5 rounded-full ${isOffline ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'
            }`}
        >
          <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></span>
          {isOffline ? 'Offline' : 'Online'}
        </button>
        {localStorage.getItem('debug_date_offset') && (
          <div className="flex items-center gap-2 border-x border-slate-700 px-4 py-1 bg-slate-800/20 rounded">
            <button
              onClick={() => {
                console.log('Resetting debug_date_offset');
                localStorage.removeItem('debug_date_offset');
                window.location.reload();
              }}
              className="bg-red-600 hover:bg-red-700 text-white text-[11px] font-black uppercase px-3 py-2 rounded shadow-lg shadow-red-900/40 flex items-center gap-1 animate-bounce"
              title="Voltar para o tempo real"
            >
              <span className="material-icons-round text-sm">history</span> TEMPO REAL
            </button>
          </div>
        )}

        <div className="hidden md:block text-slate-500 dark:text-slate-400 text-[10px] font-mono uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800">
          {getTodayDate().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </header>
  );
};

export default Header;
