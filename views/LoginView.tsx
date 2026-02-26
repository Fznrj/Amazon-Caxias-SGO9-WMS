import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoginViewProps } from '../types';

const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onNavigateRegister }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoggingIn) return;

    setIsLoggingIn(true);
    setMessage(null);

    try {
      const result = await login(email, password);

      let displayMessage = result.message;
      if (!result.success && result.message.includes('rate limit')) {
        displayMessage = 'Muitas tentativas. Aguarde um momento ou verifique suas credenciais.';
      } else if (!result.success && result.message.includes('não encontrado')) {
        displayMessage = 'Usuário não encontrado. Verifique se o Nome ou ID está correto.';
      } else if (!result.success && result.message.includes('identificador inválido')) {
        displayMessage = 'Identificador de usuário inválido. Por favor, verifique o formato.';
      }

      if (result.success) {
        if (result.message.includes('restaurado')) {
          setMessage({ text: 'Seu perfil foi restaurado com sucesso! Entrando...', type: 'success' });
          setTimeout(() => onLoginSuccess(), 1500);
        } else {
          onLoginSuccess();
        }
      } else if (result.message.includes('Perfil não encontrado')) {
        // FALLBACK: If auto-restoration in AuthService failed
        displayMessage = 'Não foi possível restaurar seu perfil automaticamente. Por favor, siga o "Método 2 (SQL Editor)" no documento de instruções, ou contate o suporte.';
        setMessage({ text: displayMessage, type: 'error' });
      } else {
        setMessage({ text: displayMessage, type: 'error' });
      }
    } catch (err) {
      console.error('LoginView: Connection error', err);
      setMessage({ text: 'Erro de conexão. Verifique sua internet.', type: 'error' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background-light dark:bg-background-dark">
      <div className="md:w-1/2 bg-brand-blue dark:bg-[#1b2531] flex flex-col items-center justify-center p-8 text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 pointer-events-none">
          <div className="absolute top-0 left-0 w-64 h-64 bg-secondary rounded-full -translate-x-1/2 -translate-y-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary rounded-full translate-x-1/3 translate-y-1/3 blur-3xl"></div>
        </div>
        <div className="relative z-10 text-center space-y-4 md:space-y-6">
          <div className="flex justify-center">
            <div className="text-secondary">
              <span className="material-icons-round text-6xl md:text-8xl">warehouse</span>
            </div>
          </div>
          <div className="space-y-0.5 md:space-y-1">
            <h1 className="font-display text-4xl md:text-6xl font-bold tracking-wider uppercase">Amazon Caxias</h1>
            <p className="font-display text-xl md:text-2xl text-secondary font-semibold tracking-[0.2em]">SG09</p>
          </div>
          <p className="max-w-xs mx-auto text-gray-300 text-sm font-light leading-relaxed">
            Sistema de Gestão de Armazém para controle eficiente de TBRs
          </p>
        </div>
      </div>

      <div className="md:w-1/2 flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="bg-white dark:bg-card-dark border border-gray-200 dark:border-gray-800 p-8 shadow-2xl rounded-lg">
            <h2 className="font-display text-2xl font-bold text-gray-900 dark:text-gray-100 mb-8 tracking-wide uppercase">
              Acessar Sistema
            </h2>

            {message && (
              <div className={`p-4 mb-6 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {message.text}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">Email, Nome ou ID</label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                  placeholder="Email, Nome ou ID de Usuário"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">Senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white px-4 py-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all placeholder:text-gray-400"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-primary hover:bg-[#066a75] disabled:opacity-50 disabled:cursor-not-allowed text-white font-display font-bold py-3 px-4 transition-colors tracking-widest text-lg uppercase shadow-lg shadow-primary/20 flex items-center justify-center space-x-2"
              >
                {isLoggingIn ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                    <span>Aguarde...</span>
                  </>
                ) : (
                  'Entrar'
                )}
              </button>

              <button
                type="button"
                onClick={onNavigateRegister}
                className="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 py-3 px-4 flex items-center justify-center space-x-2 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors uppercase text-xs font-bold tracking-wider rounded"
              >
                Criar Nova Conta
              </button>
            </form>
          </div>

        </div>
      </div>
      <div className="fixed bottom-4 right-4 text-[10px] text-gray-400 dark:text-gray-600 font-medium pointer-events-none">
        Produzido por: Fernando Souza
      </div>
    </div>
  );
};

export default LoginView;
