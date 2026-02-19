import React, { useState } from 'react';
import { useWms } from '../context/WmsContext';

interface RegisterViewProps {
    onNavigateLogin: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onNavigateLogin }) => {
    const { register } = useWms();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [customId, setCustomId] = useState('');
    const [companyId, setCompanyId] = useState('DeLuna Amazon Caxias SGO9');
    const [message, setMessage] = useState<{ text: string, type: 'success' | 'error' } | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (password.length < 8) {
            setMessage({ text: 'A senha deve ter no mínimo 8 caracteres.', type: 'error' });
            return;
        }

        if (password !== confirmPassword) {
            setMessage({ text: 'As senhas não coincidem.', type: 'error' });
            return;
        }

        try {
            const result = await register(name, email, password, companyId, customId);
            setMessage({ text: result.message, type: result.success ? 'success' : 'error' });

            if (result.success) {
                setTimeout(() => {
                    onNavigateLogin();
                }, 2000);
            }
        } catch (error) {
            console.error("Registration error:", error);
            setMessage({ text: 'Erro ao tentar registrar. Tente novamente.', type: 'error' });
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background-light dark:bg-background-dark p-4">
            <div className="bg-white dark:bg-card-dark p-8 rounded-xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-800">
                <h2 className="font-display text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2 uppercase tracking-wide">
                    Novo Cadastro
                </h2>
                <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-8">
                    Crie sua conta para acessar o WMS SGO9
                </p>

                {message && (
                    <div className={`p-4 mb-6 rounded-lg text-sm font-bold ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">Nome Completo</label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Seu Nome"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">ID de Usuário (Opcional)</label>
                        <input
                            type="text"
                            value={customId}
                            onChange={(e) => setCustomId(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Crie seu ID personalizado"
                        />
                        <p className="text-[10px] text-gray-400">Se deixar em branco, um ID será gerado automaticamente.</p>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">Email Corporativo</label>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="seu.email@empresa.com"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">ID da Empresa / Filial</label>
                        <input
                            type="text"
                            required
                            value={companyId}
                            onChange={(e) => setCompanyId(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="Ex: SGO9"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">Senha (Min. 8 caracteres)</label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="••••••••"
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 tracking-widest uppercase">Confirmar Senha</label>
                        <input
                            type="password"
                            required
                            minLength={8}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-[#0d1117] border border-gray-300 dark:border-gray-700 rounded p-3 text-sm focus:ring-2 focus:ring-primary outline-none"
                            placeholder="••••••••"
                        />
                    </div>

                    <button
                        type="submit"
                        className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 rounded transition-colors uppercase tracking-wider mt-6"
                    >
                        Criar Conta
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button
                        onClick={onNavigateLogin}
                        className="text-sm text-primary hover:underline font-bold"
                    >
                        Voltar para Login
                    </button>
                </div>
            </div >
        </div >
    );
};

export default RegisterView;
