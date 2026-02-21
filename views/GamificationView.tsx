import React from 'react';
import { useWms } from '../context/WmsContext';
import {
    gamificationService,
    LEVELS,
    DAILY_GOAL,
    type GamificationProfile,
    type GamificationLevel,
} from '../services/gamificationService';

const GamificationView: React.FC = () => {
    const { currentUser, inboundItems, outboundItems, inventoryItems } = useWms();

    // --- Aggregate data per operator ---
    interface OperatorStats {
        scans: number;
        errors: number;
        dailyScans: Record<string, number>;
        dailyErrors: Record<string, number>;
        uniqueDays: Set<string>;
        inventoryDays: Set<string>;
        treatmentCount: number;
        localizedCount: number;
        incidentsCount: number;
        driversExpedited: Set<string>;
        reversaPallets: Set<string>;
        dailyActivities: Record<string, Set<string>>;
    }
    const { treatmentItems, stockItems } = useWms(); // Add missing deps
    const operatorData: Map<string, OperatorStats> = React.useMemo(() => {
        const map = new Map<string, OperatorStats>();

        const getEmptyStats = (): OperatorStats => ({
            scans: 0, errors: 0, dailyScans: {}, dailyErrors: {},
            uniqueDays: new Set(), inventoryDays: new Set(),
            treatmentCount: 0, localizedCount: 0, incidentsCount: 0,
            driversExpedited: new Set(), reversaPallets: new Set(),
            dailyActivities: {}
        });

        const todayStr = new Date().toISOString().split('T')[0];

        const getDateKey = (timeStr: string): string => {
            if (!timeStr) return todayStr;
            if (timeStr.includes(',')) {
                const [datePart] = timeStr.split(',');
                const [day, month, year] = datePart.trim().split('/');
                return `${year}-${month}-${day}`;
            }
            return timeStr.split(' ')[0] || todayStr;
        };

        inboundItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            const dateKey = getDateKey(item.time);
            data.uniqueDays.add(dateKey);
            if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
            data.dailyActivities[dateKey].add('ENTRADA');

            if (item.error) {
                data.errors++;
                data.dailyErrors[dateKey] = (data.dailyErrors[dateKey] || 0) + 1;
            } else {
                data.scans++;
                data.dailyScans[dateKey] = (data.dailyScans[dateKey] || 0) + 1;
            }
        });

        outboundItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            const dateKey = getDateKey(item.time);
            data.uniqueDays.add(dateKey);
            data.scans++;
            data.dailyScans[dateKey] = (data.dailyScans[dateKey] || 0) + 1;
            data.driversExpedited.add(item.driverName);
            if (item.status === 'Reversa - Saiu com Motorista') {
                data.reversaPallets.add(item.id); // Assuming item.id is part of a pallet
            }

            if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
            data.dailyActivities[dateKey].add('SAIDA');
        });

        inventoryItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            const dateKey = getDateKey(item.time);
            data.uniqueDays.add(dateKey);
            data.inventoryDays.add(dateKey);
            data.scans++;
            data.dailyScans[dateKey] = (data.dailyScans[dateKey] || 0) + 1;

            if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
            data.dailyActivities[dateKey].add('INVENTARIO');
        });

        treatmentItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            data.treatmentCount++;
            data.incidentsCount++;
        });

        stockItems.forEach(item => {
            if (item.localizedBy) {
                const op = item.localizedBy;
                if (!map.has(op)) map.set(op, getEmptyStats());
                const data = map.get(op)!;
                data.localizedCount++;
            }
        });

        return map;
    }, [inboundItems, outboundItems, inventoryItems, treatmentItems, stockItems]);

    const [ranking, setRanking] = React.useState<GamificationProfile[]>([]);
    const [loadingRanking, setLoadingRanking] = React.useState(true);

    React.useEffect(() => {
        const fetchRanking = async () => {
            setLoadingRanking(true);
            const profiles: GamificationProfile[] = [];
            const processedOperators = new Set<string>();

            for (const [operatorName, data] of Array.from(operatorData.entries())) {
                processedOperators.add(operatorName);
                const metaPercent = Math.round((data.scans / DAILY_GOAL) * 100);
                const dayKeys = Object.keys(data.dailyScans);
                const diasAcimaMeta = dayKeys.filter(d => (data.dailyScans[d] || 0) >= DAILY_GOAL).length;
                const errorDayKeys = Object.keys(data.dailyErrors);
                const totalDays = Math.max(dayKeys.length, 1);
                const zeroErrorDays = totalDays - errorDayKeys.filter(d => (data.dailyErrors[d] || 0) > 0).length;

                // Consecutive days above meta
                let consecutive = 0;
                const sortedDays = [...dayKeys].sort();
                for (let i = sortedDays.length - 1; i >= 0; i--) {
                    if ((data.dailyScans[sortedDays[i]] || 0) >= DAILY_GOAL) {
                        consecutive++;
                    } else break;
                }

                const avgMeta = dayKeys.length > 0
                    ? Math.round(dayKeys.reduce((sum, d) => sum + ((data.dailyScans[d] || 0) / DAILY_GOAL) * 100, 0) / dayKeys.length)
                    : 0;

                const mixedDays = Object.values(data.dailyActivities).filter(acts =>
                    acts.has('ENTRADA') && acts.has('SAIDA') && acts.has('INVENTARIO')
                ).length;

                const profile = await gamificationService.recalculate(
                    operatorName, // userId
                    operatorName, // userName
                    currentUser!.company_id, // companyId
                    data.scans,
                    metaPercent,
                    diasAcimaMeta,
                    data.errors,
                    data.scans, // totalScans (redundant, but kept for signature)
                    false, // isTop3
                    false, // isChallenger
                    consecutive,
                    zeroErrorDays,
                    avgMeta,
                    {
                        inventoryParticipations: data.inventoryDays.size,
                        activeDays: data.uniqueDays.size,
                        treatmentsDone: data.treatmentCount,
                        localizedItems: data.localizedCount,
                        driverExpeditions: data.driversExpedited.size,
                        mixedActivityDays: mixedDays,
                        incidentsLogged: data.incidentsCount,
                        reversaPallets: data.reversaPallets.size
                    }
                );
                profiles.push(profile);
            }

            // Ensure current user is in profiles even if no scans
            if (currentUser && !processedOperators.has(currentUser.name)) {
                const profile = await gamificationService.recalculate(
                    currentUser.id,
                    currentUser.name,
                    currentUser.company_id,
                    0, 0, 0, 0, 0, false, false, 0, 0, 0
                );
                profiles.push(profile);
            }

            // Sort by SPR
            profiles.sort((a, b) => b.sprMonthly - a.sprMonthly);

            // Fix Desafiante: only #1
            if (profiles.length > 0) {
                const top1 = profiles[0];
                if (top1.sprMonthly > 0) {
                    const level = gamificationService.getLevel(top1.xpMonthly);
                    if (level.name === 'Desafiante') top1.currentLevel = 'Desafiante';
                }
                // Demote others from Desafiante and update Top3 badge
                profiles.forEach((p, idx) => {
                    const isTop3 = idx < 3 && p.sprMonthly > 0;

                    // Update badges that depend on ranking
                    if (isTop3) {
                        const badge = p.badges.find(b => b.id === 'top3_weekly');
                        if (badge && !badge.unlocked) {
                            badge.unlocked = true;
                            badge.unlockedAt = new Date().toISOString();
                        }
                    }

                    if (idx > 0 && p.currentLevel === 'Desafiante') {
                        p.currentLevel = 'Grão-Mestre';
                    }
                });
            }

            setRanking(profiles);
            setLoadingRanking(false);
        };

        fetchRanking();
    }, [operatorData, currentUser]);

    // --- Current user profile ---
    const myProfile = ranking.find(p => p.userName === currentUser?.name);
    const myLevel = myProfile ? LEVELS.find(l => l.name === myProfile.currentLevel) || LEVELS[0] : LEVELS[0];
    const nextLevel = myProfile ? gamificationService.getNextLevel(myProfile.xpMonthly) : LEVELS[1];
    const xpProgress = myProfile && nextLevel
        ? Math.min(100, Math.round(((myProfile.xpMonthly - myLevel.minXP) / (nextLevel.minXP - myLevel.minXP)) * 100))
        : myProfile ? 100 : 0;

    const myData = currentUser ? operatorData.get(currentUser.name) : undefined;
    const myMetaPercent = myData ? Math.round((myData.scans / DAILY_GOAL) * 100) : 0;
    const myDaysAbove = myData ? Object.keys(myData.dailyScans).filter(d => (myData.dailyScans[d] || 0) >= DAILY_GOAL).length : 0;

    const getLevelInfo = (levelName: string): GamificationLevel => {
        return LEVELS.find(l => l.name === levelName) || LEVELS[0];
    };

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
                <StatCard label="Total Scans" value={myData?.scans || 0} icon="qr_code_scanner" color="text-primary" />
                <StatCard label="Meta %" value={`${myMetaPercent}%`} icon="flag" color={myMetaPercent >= 100 ? 'text-green-400' : myMetaPercent >= 70 ? 'text-blue-400' : 'text-red-400'} />
                <StatCard label="Dias Acima Meta" value={myDaysAbove} icon="calendar_today" color="text-emerald-400" />
                <StatCard label="Erros" value={myData?.errors || 0} icon="error" color="text-red-400" />
                <StatCard label="XP Mensal" value={myProfile?.xpMonthly?.toLocaleString() || '0'} icon="bolt" color="text-yellow-400" />
            </div>

            {/* === RANKING TABLE === */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm overflow-hidden border border-slate-200 dark:border-slate-700">
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                    <h3 className="font-display font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest text-sm">
                        🏆 Ranking Geral — Mensal
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                        {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold text-center w-16">Rank</th>
                                <th className="px-6 py-4 font-semibold">Colaborador</th>
                                <th className="px-6 py-4 font-semibold text-center">Nível</th>
                                <th className="px-6 py-4 font-semibold text-right">SPR</th>
                                <th className="px-6 py-4 font-semibold text-right">XP</th>
                                <th className="px-6 py-4 font-semibold text-right">Eficiência</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {ranking.length === 0 ? (
                                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-mono text-xs">Nenhuma atividade registrada</td></tr>
                            ) : (
                                ranking.map((profile, idx) => {
                                    const lv = getLevelInfo(profile.currentLevel);
                                    const data = operatorData.get(profile.userName);
                                    const meta = data ? Math.round((data.scans / DAILY_GOAL) * 100) : 0;
                                    return (
                                        <tr key={profile.userId} className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${profile.userName === currentUser?.name ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                            <td className="px-6 py-4 text-center">
                                                {idx === 0 ? <span className="text-2xl">🥇</span>
                                                    : idx === 1 ? <span className="text-2xl">🥈</span>
                                                        : idx === 2 ? <span className="text-2xl">🥉</span>
                                                            : <span className="text-sm font-bold text-slate-400">#{idx + 1}</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full ${lv.bgColor} ${lv.borderColor} border flex items-center justify-center text-xs font-bold ${lv.color}`}>
                                                        {profile.userName.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-sm text-slate-700 dark:text-slate-200">{profile.userName}</p>
                                                        {profile.fraudFlag && <span className="text-[9px] text-red-400 font-bold">⚠️ Observação</span>}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`flex items-center justify-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase ${lv.bgColor} ${lv.color} ${lv.borderColor} border`}>
                                                    <span className="material-icons-round text-sm">{lv.icon}</span> {lv.name}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-sm font-bold text-slate-700 dark:text-slate-200">{profile.sprMonthly.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right font-mono text-sm text-slate-500">{profile.xpMonthly.toLocaleString()}</td>
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
                    🏅 Conquistas
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {(myProfile?.badges || []).map(badge => (
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
                            {badge.unlocked && badge.unlockedAt && (
                                <p className="text-[9px] text-yellow-600 font-bold mt-2 uppercase tracking-tighter">Conquistado!</p>
                            )}
                        </div>
                    ))}
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
                        const flagged = ranking.filter(p => p.fraudFlag);
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
                                {flagged.map(p => (
                                    <div key={p.userId} className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-4">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="material-icons-round text-red-500">warning</span>
                                                <div>
                                                    <p className="font-bold text-sm text-red-600 dark:text-red-400">{p.userName}</p>
                                                    <p className="text-[10px] text-red-400">XP reduzido em 20% • Em observação</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={async () => { await gamificationService.clearFraudFlag(p.userId, p.userName, currentUser!.company_id); window.location.reload(); }}
                                                className="text-[10px] px-3 py-1 bg-green-500/10 text-green-500 border border-green-500/30 rounded font-bold uppercase hover:bg-green-500/20 transition-colors"
                                            >
                                                Limpar Flag
                                            </button>
                                        </div>
                                        {p.fraudAlerts.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {p.fraudAlerts.slice(-3).map((alert, i) => (
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
