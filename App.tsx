import React, { useState, useEffect } from 'react';
import { View } from './types';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardView from './views/DashboardView';
import LoginView from './views/LoginView';
import InboundView from './views/InboundView';
import OutboundView from './views/OutboundView';
import InventoryView from './views/InventoryView';
import ReversaView from './views/ReversaView';
import ProductivityView from './views/ProductivityView';
import UserManagementView from './views/UserManagementView';
import TreatmentView from './views/TreatmentView';
import ReportsView from './views/ReportView';
import RegisterView from './views/RegisterView';
import DriversView from './views/DriversView';
import RtsView from './views/RtsView';
import GamificationView from './views/GamificationView';
import PasswordResetModal from './components/PasswordResetModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { WmsDataProvider } from './context/WmsDataContext';
import { KpiProvider } from './context/KpiContext';
import { GamificationProvider } from './context/GamificationContext';
import { WmsProvider, useWms } from './context/WmsContext';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';

// ─────────────────────────────────────────────────────────────
// AppContent — Main UI, consumes useWms() for everything
// ─────────────────────────────────────────────────────────────

const AppContent: React.FC = () => {
  const { currentUser, logout, currentView, setCurrentView } = useWms();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(err => console.warn('Capacitor: StatusBar hide failed', err));
    }
  }, []);

  useEffect(() => { setIsMenuOpen(false); }, [currentView]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.documentElement.classList.toggle('dark');
  };

  const renderView = () => {
    switch (currentView) {
      case View.DASHBOARD: return <DashboardView onNavigate={setCurrentView} />;
      case View.INBOUND: return <InboundView />;
      case View.OUTBOUND: return <OutboundView />;
      case View.INVENTORY: return <InventoryView />;
      case View.PRODUCTIVITY: return <ProductivityView />;
      case View.REVERSA: return <ReversaView />;
      case View.USERS: return <UserManagementView />;
      case View.TREATMENTS: return <TreatmentView />;
      case View.REPORTS: return <ReportsView />;
      case View.DRIVERS: return <DriversView />;
      case View.RTS: return <RtsView />;
      case View.GAMIFICATION: return <GamificationView />;
      default: return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className={`flex min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      {currentUser?.force_password_reset && <PasswordResetModal />}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={logout}
        onToggleDarkMode={toggleDarkMode}
        currentUser={currentUser!}
        isMobileOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />

      {isMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setIsMenuOpen(false)} />
      )}

      <div className="flex-1 flex flex-col ml-0 lg:ml-64 transition-all w-full max-w-full overflow-x-hidden">
        {isOffline && (
          <div className="bg-primary text-white py-2 px-6 flex items-center justify-center gap-2 font-bold uppercase text-xs">
            <span className="material-icons-round text-sm">cloud_off</span>
            Você está Offline - Dados sendo salvos localmente
          </div>
        )}

        <Header
          viewTitle={currentView}
          currentUser={currentUser!}
          isOffline={isOffline}
          onToggleOffline={() => setIsOffline(!isOffline)}
          onMenuToggle={() => setIsMenuOpen(!isMenuOpen)}
        />

        <main className="flex-1 p-3 md:p-8 bg-background-light dark:bg-background-dark overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// AuthGate — Handles loading, login/register, status checks.
// When authenticated & active, mounts the full provider stack.
// ─────────────────────────────────────────────────────────────

const AuthGate: React.FC = () => {
  const { currentUser, loading, login, logout } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);

  // Loading splash
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background-dark text-white p-4">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-8"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-icons-round text-3xl text-primary animate-pulse">warehouse</span>
          </div>
        </div>
        <h1 className="text-2xl font-black tracking-tighter uppercase mb-2">Amazon Caxias</h1>
        <p className="text-slate-500 font-bold tracking-widest text-[10px] uppercase animate-pulse">Sincronizando Dados...</p>
      </div>
    );
  }

  // Not authenticated → Login or Register
  if (!currentUser) {
    if (isRegistering) {
      return <RegisterView onNavigateLogin={() => setIsRegistering(false)} />;
    }
    return (
      <LoginView
        onLoginSuccess={() => {/* AuthContext already sets currentUser, re-render triggers */ }}
        onNavigateRegister={() => setIsRegistering(true)}
      />
    );
  }

  // Pending approval
  if (currentUser.status === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
        <div className="bg-white dark:bg-card-dark p-8 rounded-xl shadow-2xl max-w-md text-center border border-yellow-200 dark:border-yellow-900">
          <span className="material-icons-round text-5xl text-yellow-500 mb-4">hourglass_empty</span>
          <h2 className="text-2xl font-bold mb-2">Cadastro em Análise</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Seu cadastro está aguardando aprovação de um administrador.</p>
          <button onClick={logout} className="text-primary font-bold hover:underline">Voltar para Login</button>
        </div>
      </div>
    );
  }

  // Blocked
  if (currentUser.status === 'blocked') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
        <div className="bg-white dark:bg-card-dark p-8 rounded-xl shadow-2xl max-w-md text-center border border-red-200 dark:border-red-900">
          <span className="material-icons-round text-5xl text-red-500 mb-4">block</span>
          <h2 className="text-2xl font-bold mb-2">Acesso Bloqueado</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">Sua conta foi suspensa. Entre em contato com o administrador.</p>
          <button onClick={logout} className="text-primary font-bold hover:underline">Voltar para Login</button>
        </div>
      </div>
    );
  }

  // ✅ Authenticated & Active → Mount full provider stack
  return (
    <WmsDataProvider currentUser={currentUser}>
      <KpiProvider currentUser={currentUser}>
        <GamificationProvider currentUser={currentUser}>
          <WmsProvider>
            <AppContent />
          </WmsProvider>
        </GamificationProvider>
      </KpiProvider>
    </WmsDataProvider>
  );
};

// ─────────────────────────────────────────────────────────────
// Root App — AuthProvider is the outermost, dependency-free layer
// ─────────────────────────────────────────────────────────────

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
};

export default App;
