import React from 'react';
import { View, User } from '../types';
import { getTodayDate } from '../utils/dateUtils';

interface HeaderProps {
  viewTitle: View;
  currentUser: User | null;
  isOffline: boolean;
  onToggleOffline: () => void;
  onMenuToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ viewTitle, isOffline, onToggleOffline, onMenuToggle }) => {
  const titles: Record<View, string> = {
    // ... (titles keep same)
    [View.LOGIN]: 'Login',
    [View.DASHBOARD]: 'Dashboard',
    [View.INBOUND]: 'Logística de Entrada',
    [View.OUTBOUND]: 'Expedição de Saída',
    [View.INVENTORY]: 'Inventário de Estoque',
    [View.TREATMENTS]: 'Tratativas e Perdas',
    [View.PRODUCTIVITY]: 'Produtividade',
    [View.REPORTS]: 'Relatórios',
    [View.USERS]: 'Usuários',
    [View.DRIVERS]: 'Motoristas',
    [View.SETTINGS]: 'Configurações',
    [View.REVERSA]: 'Logística Reversa',
    [View.GAMIFICATION]: 'Performance',
    [View.RTS]: 'RTS (Devolução)'
  };

  return (
    <header className="h-16 flex items-center justify-between px-4 md:px-8 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark/80 backdrop-blur sticky top-0 z-40">
      <div className="flex items-center gap-2 md:gap-4">
        <button
          onClick={onMenuToggle}
          className="p-2 -ml-2 lg:hidden text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
        >
          <span className="material-icons-round text-2xl">menu</span>
        </button>
        <h2 className="font-display text-sm sm:text-lg md:text-2x font-bold uppercase tracking-tight border-l-2 md:border-l-4 border-primary pl-3 md:pl-4 truncate max-w-[180px] sm:max-w-none">
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

        <div className="hidden md:block text-slate-500 dark:text-slate-400 text-[10px] font-mono uppercase tracking-widest bg-slate-100 dark:bg-slate-900 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-800">
          {getTodayDate().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>
    </header>
  );
};

export default Header;
