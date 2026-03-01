/**
 * GamificationView.tsx — DUMB COMPONENT
 * ─────────────────────────────────────────────────────────────
 * Zero lógica de cálculo. Consumo exclusivo de useGamification().
 * Apenas exibe dados prontos do GamificationContext.
 * ─────────────────────────────────────────────────────────────
 */

import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useGamification, RankingEntry, AchievementProgress } from '../context/GamificationContext';
import {
    gamificationService,
    LEVELS,
    DAILY_GOAL,
    type GamificationLevel,
} from '../services/gamificationService';
import { getSaoPauloDate, getTodayDate } from '../utils/dateUtils';

const GamificationView: React.FC = () => {
    const { currentUser } = useAuth();
    const {
        ranking,
        myProfile,
        myLevel,
        nextLevel,
        xpProgress,
        achievementsProgress,
        gamificationLoading,
        refreshGamification
    } = useGamification();

    // ── Derived from context (zero calculation) ──────────────
    const myEntry = ranking.find(r => r.operator === currentUser?.name);
    const scansPeriod = myEntry?.totalScans || 0;
    const metaPeriod = Math.round((scansPeriod / DAILY_GOAL) * 100);
    const errorsPeriod = myEntry?.errors || 0;

    const getLevelInfo = (levelName: string): GamificationLevel => {
        return LEVELS.find(l => l.name === levelName) || LEVELS[0];
    };

    if (gamificationLoading && ranking.length === 0) {
        return (
            <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
                <div className="w-16 h-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4"></div>
                <p className="text-xs font-bold uppercase tracking-widest animate-pulse">Calculando Ranking...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* === USER HERO HEADER === */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 rounded-2xl shadow-2xl relative overflow-hidden border border-slate-700">
                <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500 rounded-full filter blur-[120px] opacity-10"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary rounded-full filter blur-[100px] opacity-10"></div>

                <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                    {/* Avatar */}
                    <div className={`w-24 h-24 rounded-full ${myLevel.bgColor} ${myLevel.borderColor} border-4 flex items-center justify-center text-3xl font-bold ${myLevel.color} shadow-xl`}>
                        {currentUser?.name?.substring(0, 2).toUpperCase() || 'OP'}
                    </div>

                    {/* Info */}
                    <div className="flex-1 text-center md:text-left">
                        <h2 className="text-2xl font-display font-bold text-white uppercase tracking-wider">{currentUser?.name || 'Operador'}</h2>
                        <p className="text-slate-400 text-sm uppercase tracking-widest">{currentUser?.role || 'Operador'}</p>

                        {/* Level Badge */}
                        <div className="flex items-center gap-2 mt-2 justify-center md:justify-start">
                            <span className={`material-icons-round text-2xl ${myLevel.color}`}>{myLevel.icon}</span>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${myLevel.bgColor} ${myLevel.color} ${myLevel.borderColor} border`}>
                                {myLevel.name}
                            </span>
                            {myProfile?.fraudFlag && (
                                <span className="px-2 py-1 bg-red-500/20 text-red-400 border border-red-500 rounded-full text-[10px] font-bold uppercase">
                                    ⚠️ Observação
                                </span>
                            )}
                        </div>

                        {/* XP Progress Bar */}
                        <div className="mt-4 max-w-md mx-auto md:mx-0">
                            <div className="flex justify-between text-[10px] mb-1">
                                <span className="text-slate-400 font-bold uppercase tracking-wider">XP Mensal</span>
                                <span className={`font-bold ${myLevel.color}`}>
                                    {myProfile?.xpMonthly?.toLocaleString() || 0} / {nextLevel?.minXP?.toLocaleString() || '∞'} XP
                                </span>
                            </div>
                            <div className="h-3 w-full bg-slate-700 rounded-full overflow-hidden relative">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ease-out ${myLevel.name === 'Desafiante'
                                        ? 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                                        : myLevel.name === 'Grão-Mestre'
                                            ? 'bg-gradient-to-r from-red-400 to-red-600'
                                            : myLevel.name === 'Mestre'
                                                ? 'bg-gradient-to-r from-purple-400 to-purple-600'
                                                : myLevel.name === 'Diamante'
                                                    ? 'bg-gradient-to-r from-blue-400 to-blue-600'
                                                    : 'bg-gradient-to-r from-primary to-teal-400'
                                        }`}
                                    style={{ width: `${xpProgress}%` }}
                                />
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-pulse" />
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">
                                {nextLevel ? `${xpProgress}% para ${nextLevel.name}` : 'Nível máximo atingido!'}
                            </p>
                        </div>
                    </div>

                    {/* SPR Score */}
                    <div className="text-center">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">SPR Score</p>
                        <p className={`text-5xl font-display font-bold ${myLevel.color}`}>
                            {myProfile?.sprMonthly?.toLocaleString() || 0}
                        </p>
                        <p className="text-[10px] text-slate-500 mt-1">Score de Performance Real</p>
                    </div>
                </div>
            </div>

            {/* === INDIVIDUAL CARDS === */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <StatCard
                    label="Total Scans (Hoje)"
                    value={scansPeriod}
                    icon="qr_code_scanner"
                    color="text-primary"
                />
                <StatCard
                    label="Meta % (Hoje)"
                    value={`${metaPeriod}%`}
                    icon="flag"
                    color={metaPeriod >= 100 ? 'text-green-400' : metaPeriod >= 70 ? 'text-blue-400' : 'text-red-400'}
                />
                <StatCard
                    label="Posição Ranking"
                    value={myEntry ? `#${myEntry.position}` : '-'}
                    icon="leaderboard"
                    color="text-emerald-400"
                />
                <StatCard
                    label="Erros (Hoje)"
                    value={errorsPeriod}
                    icon="error"
                    color="text-red-400"
                />
                <StatCard label="XP Mensal" value={myProfile?.xpMonthly?.toLocaleString() || '0'} icon="bolt" color="text-yellow-400" />
            </div>

            {/* === RANKING TABLE === */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-display font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm">
                        🏆 Ranking Hoje
                    </h3>
                    <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-mono">
                            {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
                        </span>
                        <button
                            onClick={refreshGamification}
                            className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 px-3 py-1.5 rounded transition-colors flex items-center gap-1"
                        >
                            <span className="material-icons-round text-xs">refresh</span>
                            Atualizar
                        </button>
                    </div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold text-center w-16">Rank</th>
                                <th className="px-6 py-4 font-semibold">Colaborador</th>
                                <th className="px-6 py-4 font-semibold text-center">Nível</th>
                                <th className="px-6 py-4 font-semibold text-center">Total Scans</th>
                                <th className="px-6 py-4 font-semibold text-right">SPR</th>
                                <th className="px-6 py-4 font-semibold text-right">XP</th>
                                <th className="px-6 py-4 font-semibold text-right">Eficiência</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {ranking.length === 0 ? (
                                <tr><td colSpan={7} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">Nenhuma atividade registrada</td></tr>
                            ) : (
                                ranking.map((entry) => {
                                    const lv = getLevelInfo(entry.profile.currentLevel);
                                    const meta = Math.round((entry.totalScans / DAILY_GOAL) * 100);
                                    return (
                                        <tr key={entry.operator} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${entry.operator === currentUser?.name ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                            <td className="px-6 py-4 text-center">
                                                {entry.position === 1 ? <span className="text-2xl">🥇</span>
                                                    : entry.position === 2 ? <span className="text-2xl">🥈</span>
                                                        : entry.position === 3 ? <span className="text-2xl">🥉</span>
                                                            : <span className="text-sm font-bold text-slate-400">#{entry.position}</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full ${lv.bgColor} ${lv.borderColor} border flex items-center justify-center text-xs font-bold ${lv.color}`}>
                                                        {entry.operator.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{entry.operator}</p>
                                                        {entry.profile.fraudFlag && <span className="text-[9px] text-red-400 font-bold">⚠️ Observação</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${lv.bgColor} ${lv.color} ${lv.borderColor} border`}>
                                                    <span className="material-icons-round text-sm">{lv.icon}</span> {lv.name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono text-sm font-bold text-slate-600 dark:text-slate-300">
                                                {(entry as any).totalScans?.toLocaleString() || '0'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{entry.profile.sprMonthly.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-sm text-slate-500">{entry.profile.xpMonthly.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right">
                                                <span className={`font-bold text-sm ${meta >= 100 ? 'text-green-400' : meta >= 70 ? 'text-blue-400' : 'text-red-400'}`}>
                                                    {meta}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* === ACHIEVEMENTS === */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-display font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm mb-6">
                    🎖️ Conquistas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {(myProfile?.badges || []).map(badge => {
                        const progress = achievementsProgress[badge.id];
                        return (
                            <div
                                key={badge.id}
                                className={`p-4 rounded-xl border text-center transition-all ${badge.unlocked
                                    ? 'bg-gradient-to-b from-yellow-50 to-white dark:from-yellow-900/10 dark:to-slate-800 border-yellow-400 shadow-lg shadow-yellow-500/10'
                                    : 'bg-slate-50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800 opacity-60'
                                    }`}
                            >
                                <span className={`material-icons-round text-3xl block mb-2 ${badge.unlocked ? 'text-yellow-500' : 'text-slate-400'}`}>
                                    {badge.icon}
                                </span>
                                <p className="font-bold text-xs text-slate-700 dark:text-slate-200">{badge.title}</p>
                                <p className="text-[10px] text-slate-400 mt-1">{badge.description}</p>

                                {/* Progress Bar + Counter */}
                                {progress && (
                                    <div className="mt-3">
                                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ease-out ${badge.unlocked
                                                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-500'
                                                    : progress.percent >= 70
                                                        ? 'bg-gradient-to-r from-green-400 to-emerald-500'
                                                        : progress.percent >= 40
                                                            ? 'bg-gradient-to-r from-blue-400 to-blue-500'
                                                            : 'bg-gradient-to-r from-slate-400 to-slate-500'
                                                    }`}
                                                style={{ width: `${Math.max(progress.percent, 2)}%` }}
                                            />
                                        </div>
                                        <p className={`text-[10px] font-bold mt-1 ${badge.unlocked ? 'text-yellow-600' : 'text-slate-400'
                                            }`}>
                                            {badge.id === 'top3_weekly'
                                                ? (progress.current > 0 && progress.current <= 3
                                                    ? `#${progress.current} — Conquistado!`
                                                    : progress.current > 0 ? `#${progress.current} — fora do pódio` : 'Sem posição')
                                                : `${progress.current.toLocaleString()} / ${progress.goal.toLocaleString()}`
                                            }
                                        </p>
                                    </div>
                                )}

                                {badge.unlocked && badge.unlockedAt && !progress && (
                                    <p className="text-[9px] text-yellow-600 font-bold mt-2 uppercase tracking-tighter">Conquistado!</p>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* === LEVEL PROGRESSION === */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                <h3 className="font-display font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm mb-6">
                    📊 Progressão de Níveis
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {LEVELS.map(level => {
                        const isCurrentLevel = myProfile?.currentLevel === level.name;
                        const isReached = (myProfile?.xpMonthly || 0) >= level.minXP;
                        const isFerro = level.name === 'Ferro';
                        return (
                            <div
                                key={level.name}
                                className={`p-3 rounded-lg border text-center transition-all ${isCurrentLevel
                                    ? `${level.bgColor} ${level.borderColor} border-2 shadow-lg ring-2 ring-offset-2 ring-offset-slate-800 ring-${level.borderColor.replace('border-', '')}`
                                    : isReached
                                        ? `${level.bgColor} ${level.borderColor} border opacity-70`
                                        : isFerro
                                            ? 'bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700 opacity-20'
                                            : `${level.bgColor} ${level.borderColor} border opacity-40 grayscale-[0.3]`
                                    }`}
                            >
                                <span className={`material-icons-round text-2xl block ${isReached || isCurrentLevel || !isFerro ? level.color : 'text-slate-500'}`}>
                                    {level.icon}
                                </span>
                                <p className={`font-bold text-xs mt-1 ${isReached || isCurrentLevel || !isFerro ? level.color : 'text-slate-500'}`}>{level.name}</p>
                                <p className="text-[9px] text-slate-400 mt-0.5">{level.minXP.toLocaleString()} XP</p>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* === ANTI-FRAUD ALERTS (Admin only) === */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin' || currentUser?.role === 'supervisor' || currentUser?.role === 'coordinator') && (
                <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
                    <h3 className="font-display font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm mb-4">
                        🛡️ Anti-Fraude — Alertas
                    </h3>
                    {(() => {
                        const flagged = ranking.filter(r => r.profile.fraudFlag);
                        if (flagged.length === 0) {
                            return (
                                <div className="text-center py-8 text-slate-400">
                                    <span className="material-icons-round text-4xl mb-2 block text-green-400">verified_user</span>
                                    <p className="text-sm font-medium">Nenhum comportamento suspeito detectado</p>
                                </div>
                            );
                        }
                        return (
                            <div className="space-y-3">
                                {flagged.map(r => (
                                    <div key={r.operator} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="material-icons-round text-red-500">warning</span>
                                                <div>
                                                    <p className="font-bold text-sm text-red-600 dark:text-red-400">{r.operator}</p>
                                                    <p className="text-[10px] text-red-400">XP reduzido em 20% • Em observação</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => { await gamificationService.clearFraudFlag(r.profile.userId, r.operator, currentUser!); await refreshGamification(); }}
                                                className="text-[10px] px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/30 rounded font-bold uppercase hover:bg-green-500/20 transition-colors"
                                            >
                                                Limpar Flag
                                            </button>
                                        </div>
                                        {r.profile.fraudAlerts.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {r.profile.fraudAlerts.slice(-3).map((alert, i) => (
                                                    <p key={i} className="text-[10px] text-red-300 font-mono">• {alert}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};

// ========================
// STAT CARD COMPONENT
// ========================
const StatCard: React.FC<{ label: string; value: string | number; icon: string; color: string }> = ({ label, value, icon, color }) => (
    <div className="bg-white dark:bg-card-dark p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
            <span className={`material-icons-round text-lg ${color}`}>{icon}</span>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</p>
        </div>
        <p className={`text-2xl font-display font-bold ${color}`}>{value}</p>
    </div>
);


export default GamificationView;
