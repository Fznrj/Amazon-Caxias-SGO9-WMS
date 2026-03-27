import React from 'react';
import { View, User } from '../types';
import { useWms } from '../context/WmsContext';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  onLogout: () => void;
  onToggleDarkMode: () => void;
  currentUser: User | null;
  isMobileOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onViewChange,
  onLogout,
  onToggleDarkMode,
  currentUser,
  isMobileOpen,
  onClose
}) => {
  const { resetTransactions } = useWms();

  // ... (menuItems remains same)
  const menuItems = [
    { id: View.DASHBOARD, label: 'Dashboard', icon: 'dashboard' },
    { id: View.INBOUND, label: 'Entrada', icon: 'login' },
    { id: View.INVENTORY, label: 'Inventário', icon: 'inventory_2' },
    { id: View.OUTBOUND, label: 'Saída', icon: 'logout' },
    { id: View.RTS, label: 'RTS Tracking', icon: 'assignment_return' },
    { id: View.DRIVERS, label: 'Motoristas', icon: 'badge' },
    { id: View.REVERSA, label: 'Reversa e Pallet', icon: 'sync_alt' },
    { id: View.TREATMENTS, label: 'Tratativas', icon: 'error_outline' },
    { id: View.REPORTS, label: 'Relatórios', icon: 'assessment' },
    { id: View.PRODUCTIVITY, label: 'Produtividade', icon: 'trending_up' },
    { id: View.GAMIFICATION, label: 'Ranking & XP', icon: 'military_tech' },
    { id: View.USERS, label: 'Usuários', icon: 'people' },
  ];

  return (
    <aside className={`fixed left-0 top-0 h-[100dvh] w-64 bg-white dark:bg-sidebar-dark border-r border-slate-200 dark:border-slate-800 flex flex-col z-50 transition-transform duration-300 lg:translate-x-0 ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-1.5 rounded text-white">
            <span className="material-icons-round text-xl">warehouse</span>
          </div>
          <div>
            <h1 className="font-display text-lg leading-tight tracking-wider uppercase">Amazon Caxias</h1>
            <p className="text-[10px] text-primary font-bold tracking-[0.2em]">SG09</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 min-h-0 overflow-y-auto px-4 pb-24 space-y-1">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded font-medium transition-colors ${currentView === item.id
              ? 'bg-primary text-white'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
          >
            <span className="material-icons-round text-lg">{item.icon}</span>
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-black/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white uppercase">
              {currentUser?.name?.substring(0, 2).toUpperCase() || 'GU'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold truncate max-w-[120px]">{currentUser?.name || 'Sistema'}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-tighter">{currentUser?.role || 'Associado'}</p>
            </div>
          </div>

          {(currentUser?.role === 'superadmin' || currentUser?.role === 'admin') && (
            <button
              onClick={() => {
                if (window.confirm('Deseja zerar todas as contagens e movimentações?')) {
                  resetTransactions();
                }
              }}
              title="Zerar Dados do Sistema"
              className="p-2 text-slate-400 hover:text-red-500 transition-colors rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 group"
            >
              <span className="material-icons-round text-[20px] group-hover:rotate-180 transition-transform duration-500">restart_alt</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onToggleDarkMode}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-slate-200 dark:bg-slate-800 rounded text-[10px] font-bold uppercase transition-all hover:opacity-80"
          >
            <span className="material-icons-round text-[14px]">light_mode</span>
            Modo
          </button>
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-1.5 py-1.5 px-2 bg-red-500 text-white rounded text-[10px] font-bold uppercase transition-all hover:bg-red-600"
          >
            <span className="material-icons-round text-[14px]">logout</span>
            Sair
          </button>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
