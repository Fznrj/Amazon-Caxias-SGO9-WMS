import React, { useState, useEffect } from 'react';
import { View, User } from './types';
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
import { WmsProvider, useWms } from './context/WmsContext';
import { Capacitor } from '@capacitor/core';
import { StatusBar } from '@capacitor/status-bar';
// import { GoogleOAuthProvider } from '@react-oauth/google';

// Inner App Component that consumes Context
const AppContent: React.FC = () => {
  const { currentUser, logout, currentView, setCurrentView } = useWms();

  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);


  useEffect(() => {
    // Enable Immersive Mode on Native Platforms
    if (Capacitor.isNativePlatform()) {
      StatusBar.hide().catch(err => console.warn('Capacitor: StatusBar hide failed', err));
    }
  }, []);


  useEffect(() => {
    if (currentUser) {
      setIsRegistering(false);
      // Auto-jump to dashboard only if we were on LOGIN screen
      if (currentView === View.LOGIN) {
        setCurrentView(View.DASHBOARD);
      }
    }
  }, [currentUser]);

  // Reset menu when view changes
  useEffect(() => {
    setIsMenuOpen(false);
  }, [currentView]);

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


  // Auth Flow
  if (!currentUser) {
    if (isRegistering) {
      return <RegisterView onNavigateLogin={() => setIsRegistering(false)} />;
    }
    // If not logged in, always render LoginView regardless of currentView
    return <LoginView onLoginSuccess={() => setCurrentView(View.DASHBOARD)} onNavigateRegister={() => setIsRegistering(true)} />;
  }

  // Pending Status Check
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

  // Blocked Status Check
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

  return (
    <div className={`flex min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      {currentUser.force_password_reset && <PasswordResetModal />}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={logout}
        onToggleDarkMode={toggleDarkMode}
        currentUser={currentUser}
        isMobileOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
      />

      {/* Overlay for mobile menu */}
      {isMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMenuOpen(false)}
        />
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
          currentUser={currentUser}
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

const App: React.FC = () => {
  return (
    <WmsProvider>
      <AppContent />
    </WmsProvider>
  );
};

export default App;

