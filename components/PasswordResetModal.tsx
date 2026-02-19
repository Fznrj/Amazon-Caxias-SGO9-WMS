import React, { useState } from 'react';
import { useWms } from '../context/WmsContext';

const PasswordResetModal: React.FC = () => {
    const { updatePassword, logout } = useWms();
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (newPassword.length < 8) {
            setError('A senha deve ter pelo menos 8 caracteres.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }

        setLoading(true);
        const result = await updatePassword(newPassword);
        setLoading(false);

        if (!result.success) {
            setError(result.message);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background-dark/80 backdrop-blur-md">
            <div className="bg-white dark:bg-card-dark w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-8">
                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="material-icons-round text-primary text-3xl">lock_reset</span>
                    </div>
                    <h2 className="text-2xl font-bold dark:text-white">Trocar Senha Obrigatória</h2>
                    <p className="text-slate-500 text-sm mt-2">
                        Este é seu primeiro acesso. Por favor, crie uma senha segura para continuar.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-xs font-bold mb-4 flex items-center gap-2">
                        <span className="material-icons-round text-sm">error</span>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Nova Senha</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            required
                            className="w-full bg-slate-50 dark:bg-sidebar-dark border border-slate-200 dark:border-slate-800 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary transition-all dark:text-white"
                            placeholder="Mínimo 8 caracteres"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Confirmar Nova Senha</label>
                        <input
                            type="password"
                            autoComplete="new-password"
                            required
                            className="w-full bg-slate-50 dark:bg-sidebar-dark border border-slate-200 dark:border-slate-800 rounded-xl p-3 outline-none focus:ring-2 focus:ring-primary transition-all dark:text-white"
                            placeholder="Repita a nova senha"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 mt-4 uppercase tracking-widest text-xs"
                    >
                        {loading ? 'Atualizando...' : 'Definir Senha e Entrar'}
                    </button>

                    <button
                        type="button"
                        onClick={logout}
                        className="w-full text-slate-400 text-[10px] font-bold uppercase hover:text-slate-600 transition-colors mt-2"
                    >
                        Sair e trocar depois
                    </button>
                </form>
            </div>
        </div>
    );
};

export default PasswordResetModal;
