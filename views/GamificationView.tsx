import React from 'react';
import { useWms } from '../context/WmsContext';
import {
    gamificationService,
    LEVELS,
    DAILY_GOAL,
    type GamificationProfile,
    type GamificationLevel,
} from '../services/gamificationService';
import { getDateKey, isSameDay, getTodayDate, getSaoPauloDate, getSaoPauloIso } from '../utils/dateUtils';

const GamificationView: React.FC = () => {
    const { currentUser, inboundItems, outboundItems, inventoryItems } = useWms();

    const [startDate, setStartDate] = React.useState(getSaoPauloDate(getTodayDate())); // YYYY-MM-DD
    const [endDate, setEndDate] = React.useState(getSaoPauloDate(getTodayDate()));
    const [isComparisonMode, setIsComparisonMode] = React.useState(false);

    // --- Aggregate data per operator ---
    interface OperatorStats {
        scans: number; // Period scans
        errors: number; // Period errors
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
        monthlyScans: number; // For XP/SPR calculation (full month)
        monthlyErrors: number;
        monthlyUniqueDays: Set<string>;
        monthlyInventoryDays: Set<string>;
        monthlyTreatmentCount: number;
        monthlyLocalizedCount: number;
        monthlyIncidentsCount: number;
        monthlyDriversExpedited: Set<string>;
        monthlyReversaPallets: Set<string>;
        monthlyMixedActivityDays: number;
    }
    const { treatmentItems, stockItems } = useWms(); // Add missing deps
    const operatorData: Map<string, OperatorStats> = React.useMemo(() => {
        const map = new Map<string, OperatorStats>();

        const getEmptyStats = (): OperatorStats => ({
            scans: 0, errors: 0, dailyScans: {}, dailyErrors: {},
            uniqueDays: new Set(), inventoryDays: new Set(),
            treatmentCount: 0, localizedCount: 0, incidentsCount: 0,
            driversExpedited: new Set(), reversaPallets: new Set(),
            dailyActivities: {},
            monthlyScans: 0,
            monthlyErrors: 0,
            monthlyUniqueDays: new Set(),
            monthlyInventoryDays: new Set(),
            monthlyTreatmentCount: 0,
            monthlyLocalizedCount: 0,
            monthlyIncidentsCount: 0,
            monthlyDriversExpedited: new Set(),
            monthlyReversaPallets: new Set(),
            monthlyMixedActivityDays: 0
        });

        const currentMonth = getSaoPauloDate(getTodayDate()).substring(0, 7); // YYYY-MM

        inboundItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            const dateKey = getDateKey(item.time || (item as any).created_at);
            const isoCheck = dateKey.split('/').reverse().join('-');
            const itemMonth = isoCheck.substring(0, 7);

            const isThisMonth = itemMonth === currentMonth;

            if (isThisMonth) {
                data.monthlyUniqueDays.add(dateKey);
                if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
                data.dailyActivities[dateKey].add('ENTRADA');
            }

            if (item.error) {
                if (isoCheck >= startDate && isoCheck <= endDate) {
                    data.errors++;
                    data.dailyErrors[dateKey] = (data.dailyErrors[dateKey] || 0) + 1;
                }
                if (isThisMonth) data.monthlyErrors++;
            } else {
                if (isoCheck >= startDate && isoCheck <= endDate) {
                    data.scans++;
                    data.dailyScans[dateKey] = (data.dailyScans[dateKey] || 0) + 1;
                    data.uniqueDays.add(dateKey);
                }
                if (isThisMonth) {
                    data.monthlyScans++;
                }
            }
        });

        outboundItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            const dateKey = getDateKey(item.time || (item as any).created_at);
            const isoCheck = dateKey.split('/').reverse().join('-');
            const itemMonth = isoCheck.substring(0, 7);
            const isThisMonth = itemMonth === currentMonth;

            if (isThisMonth) data.monthlyUniqueDays.add(dateKey);

            if (isoCheck >= startDate && isoCheck <= endDate) {
                data.scans++;
                data.dailyScans[dateKey] = (data.dailyScans[dateKey] || 0) + 1;
                data.uniqueDays.add(dateKey);
            }
            if (isThisMonth) data.monthlyScans++;

            // Count unique driver expeditions
            const expeditionKey = `${item.driverName}_${dateKey}`;
            if (isoCheck >= startDate && isoCheck <= endDate) data.driversExpedited.add(expeditionKey);
            if (isThisMonth) data.monthlyDriversExpedited.add(expeditionKey);

            if (item.status === 'Reversa - Saiu com Motorista') {
                const minuteKey = (item.time || '').substring(0, 16);
                const reversaKey = `${item.driverName}_${minuteKey}`;
                if (isoCheck >= startDate && isoCheck <= endDate) data.reversaPallets.add(reversaKey);
                if (isThisMonth) data.monthlyReversaPallets.add(reversaKey);
            }

            if (isThisMonth) {
                if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
                data.dailyActivities[dateKey].add('SAIDA');
            }
        });

        inventoryItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            const dateKey = getDateKey(item.time || (item as any).created_at);
            const isoCheck = dateKey.split('/').reverse().join('-');
            const itemMonth = isoCheck.substring(0, 7);
            const isThisMonth = itemMonth === currentMonth;

            if (isThisMonth) {
                data.monthlyUniqueDays.add(dateKey);
                data.monthlyInventoryDays.add(dateKey);
            }

            if (isoCheck >= startDate && isoCheck <= endDate) {
                data.scans++;
                data.dailyScans[dateKey] = (data.dailyScans[dateKey] || 0) + 1;
                data.inventoryDays.add(dateKey);
                data.uniqueDays.add(dateKey);
            }
            if (isThisMonth) data.monthlyScans++;

            if (isThisMonth) {
                if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
                data.dailyActivities[dateKey].add('INVENTARIO');
            }
        });

        treatmentItems.forEach(item => {
            const op = item.operator;
            if (!map.has(op)) map.set(op, getEmptyStats());
            const data = map.get(op)!;
            const dateKey = getDateKey(item.time || (item as any).created_at);
            const isoCheck = dateKey.split('/').reverse().join('-');
            const isThisMonth = isoCheck.substring(0, 7) === currentMonth;

            if (isoCheck >= startDate && isoCheck <= endDate) {
                data.treatmentCount++;
                data.incidentsCount++;
            }
            if (isThisMonth) {
                data.monthlyTreatmentCount++;
                data.monthlyIncidentsCount++;
            }
        });

        stockItems.forEach(item => {
            if (item.localizedBy) {
                const op = item.localizedBy;
                if (!map.has(op)) map.set(op, getEmptyStats());
                const data = map.get(op)!;

                // Assuming entry_time or loss_detected_time could be used, but since we don't have item-specific time easily here
                // let's just count all for now as localized items are usually a per-user life-time or monthly stat.
                // For simplicity, we count all currently marked as localized.
                data.localizedCount++;
                data.monthlyLocalizedCount++;
            }
        });

        // Calculate monthly mixed activity days
        map.forEach(data => {
            data.monthlyMixedActivityDays = Object.values(data.dailyActivities).filter(acts =>
                acts.has('ENTRADA') && acts.has('SAIDA') && acts.has('INVENTARIO')
            ).length;
        });

        return map;
    }, [inboundItems, outboundItems, inventoryItems, treatmentItems, stockItems, startDate, endDate]);

    const [ranking, setRanking] = React.useState<GamificationProfile[]>([]);
    const [loadingRanking, setLoadingRanking] = React.useState(true);

    React.useEffect(() => {
        const fetchRanking = async () => {
            setLoadingRanking(true);
            const profiles: GamificationProfile[] = [];
            const processedOperators = new Set<string>();

            for (const [operatorName, data] of Array.from(operatorData.entries())) {
                processedOperators.add(operatorName);

                // --- PERIOD STATS (Display Only) ---
                const metaPercent = Math.round((data.scans / DAILY_GOAL) * 100);
                const dayKeys = Object.keys(data.dailyScans);
                const diasAcimaMeta = dayKeys.filter(d => (data.dailyScans[d] || 0) >= DAILY_GOAL).length;

                // --- MONTHLY STATS (Gamification Calculation) ---
                const monthlyDayKeys = Array.from(data.monthlyUniqueDays);
                const monthlyDiasAcimaMeta = monthlyDayKeys.filter(d =>
                    (inboundItems.filter(i => i.operator === operatorName && getDateKey(i.time || (i as any).created_at) === d && !i.error).length +
                        outboundItems.filter(i => i.operator === operatorName && getDateKey(i.time || (i as any).created_at) === d).length +
                        inventoryItems.filter(i => i.operator === operatorName && getDateKey(i.time || (i as any).created_at) === d).length) >= DAILY_GOAL
                ).length;

                const monthlyErrorDayKeys = Object.keys(data.dailyErrors).filter(k => k.split('/').reverse().join('-').substring(0, 7) === getSaoPauloDate(getTodayDate()).substring(0, 7));
                const monthlyZeroErrorDays = data.monthlyUniqueDays.size - monthlyErrorDayKeys.length;

                let consecutive = 0;
                const sortedMonthlyDays = [...monthlyDayKeys].sort((a, b) => {
                    const [da, ma, ya] = a.split('/').map(Number);
                    const [db, mb, yb] = b.split('/').map(Number);
                    return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
                });
                for (let i = sortedMonthlyDays.length - 1; i >= 0; i--) {
                    const dayScanCount = (inboundItems.filter(inv => inv.operator === operatorName && getDateKey(inv.time || (inv as any).created_at) === sortedMonthlyDays[i] && !inv.error).length +
                        outboundItems.filter(out => out.operator === operatorName && getDateKey(out.time || (out as any).created_at) === sortedMonthlyDays[i]).length +
                        inventoryItems.filter(inv => inv.operator === operatorName && getDateKey(inv.time || (inv as any).created_at) === sortedMonthlyDays[i]).length);
                    if (dayScanCount >= DAILY_GOAL) {
                        consecutive++;
                    } else break;
                }

                const cumulativeMeta = Math.round((data.monthlyScans / DAILY_GOAL) * 100);
                const avgMeta = monthlyDayKeys.length > 0
                    ? Math.round(monthlyDayKeys.reduce((sum, d) => {
                        const dayScanCount = (inboundItems.filter(inv => inv.operator === operatorName && getDateKey(inv.time || (inv as any).created_at) === d && !inv.error).length +
                            outboundItems.filter(out => out.operator === operatorName && getDateKey(out.time || (out as any).created_at) === d).length +
                            inventoryItems.filter(inv => inv.operator === operatorName && getDateKey(inv.time || (inv as any).created_at) === d).length);
                        return sum + (dayScanCount / DAILY_GOAL) * 100;
                    }, 0) / monthlyDayKeys.length)
                    : 0;

                const profile = await gamificationService.recalculate(
                    operatorName,
                    operatorName,
                    currentUser!.company_id,
                    data.scans, // Period Scans
                    cumulativeMeta, // USE CUMULATIVE META FOR PROFILE CALC TO AVOID DROPS
                    monthlyDiasAcimaMeta, // USE MONTHLY DAYS ABOVE META
                    data.monthlyErrors,
                    data.monthlyScans,
                    false,
                    false,
                    consecutive,
                    monthlyZeroErrorDays,
                    avgMeta,
                    {
                        inventoryParticipations: data.monthlyInventoryDays.size,
                        activeDays: data.monthlyUniqueDays.size,
                        treatmentsDone: data.monthlyTreatmentCount,
                        localizedItems: data.monthlyLocalizedCount,
                        driverExpeditions: data.monthlyDriversExpedited.size,
                        mixedActivityDays: data.monthlyMixedActivityDays,
                        incidentsLogged: data.monthlyIncidentsCount,
                        reversaPallets: data.monthlyReversaPallets.size
                    },
                    true // skipSave
                );
                profiles.push(profile);
            }

            // Ensure current user is in profiles even if no scans
            if (currentUser && !processedOperators.has(currentUser.name)) {
                const profile = await gamificationService.recalculate(
                    currentUser.id,
                    currentUser.name,
                    currentUser.company_id,
                    0, 0, 0, 0, 0, false, false, 0, 0, 0,
                    undefined,
                    true // skipSave
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
                            badge.unlockedAt = getSaoPauloIso();
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

    // Period-based stats for performance cards
    const scansPeriod = myData ? myData.scans : 0;
    const metaPeriod = Math.round((scansPeriod / DAILY_GOAL) * 100);
    const errorsPeriod = myData ? myData.errors : 0;
    const daysAboveMetaPeriod = myData ? Object.keys(myData.dailyScans).filter(d => (myData.dailyScans[d] || 0) >= DAILY_GOAL).length : 0;

    // Monthly cumulative for game progress
    const monthlyDaysAbove = myProfile ? myProfile.consecutiveDaysAboveMeta : 0;

    const getLevelInfo = (levelName: string): GamificationLevel => {
        return LEVELS.find(l => l.name === levelName) || LEVELS[0];
    };

    return (
        <div className="space-y-8">
            {/* === DATE FILTER === */}
            {/* ... (keep existing filter UI) ... */}
            <div className="bg-white dark:bg-card-dark p-4 rounded-lg shadow-sm border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <span className="material-icons-round text-primary">emoji_events</span>
                    <h2 className="font-display font-bold tracking-widest uppercase text-sm">Filtro de Ranking por Período</h2>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Início</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setIsComparisonMode(true);
                            }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Fim</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setIsComparisonMode(true);
                            }}
                            className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded px-2 py-1 text-xs outline-none focus:border-primary"
                        />
                    </div>
                    <button
                        onClick={() => {
                            const today = getSaoPauloDate(getTodayDate());
                            setStartDate(today);
                            setEndDate(today);
                            setIsComparisonMode(false);
                        }}
                        className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
                    >
                        Hoje
                    </button>
                    <button
                        onClick={() => {
                            const today = getTodayDate();
                            const weekAgo = new Date(today);
                            weekAgo.setDate(today.getDate() - 7);
                            setStartDate(getSaoPauloDate(weekAgo));
                            setEndDate(getSaoPauloDate(today));
                            setIsComparisonMode(true);
                        }}
                        className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3 py-1.5 rounded transition-colors"
                    >
                        7 Dias
                    </button>
                </div>
            </div>
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
                    label={isComparisonMode ? "Total Scans (Período)" : "Total Scans (Hoje)"}
                    value={scansPeriod}
                    icon="qr_code_scanner"
                    color="text-primary"
                />
                <StatCard
                    label={isComparisonMode ? "Meta % (Período)" : "Meta % (Hoje)"}
                    value={`${metaPeriod}%`}
                    icon="flag"
                    color={metaPeriod >= 100 ? 'text-green-400' : metaPeriod >= 70 ? 'text-blue-400' : 'text-red-400'}
                />
                <StatCard label="Dias Acima Meta" value={monthlyDaysAbove} icon="calendar_today" color="text-emerald-400" />
                <StatCard
                    label={isComparisonMode ? "Erros (Período)" : "Erros (Hoje)"}
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
                        🏆 Ranking {isComparisonMode ? ' do Período' : ' Hoje'}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-mono">
                        {new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).toUpperCase()}
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
                    {(myProfile?.badges || []).map(badge => {
                        // Progress calculation (heuristics)
                        let progress: string | null = null;
                        if (!badge.unlocked && myProfile) {
                            if (badge.id === 'streak_10') progress = `${myProfile.consecutiveDaysAboveMeta}/10`;
                            if (badge.id === 'scans_1000') progress = `${myData?.scans || 0}/1000`;
                            if (badge.id === 'participacao_ativa') progress = `${myData?.uniqueDays.size || 0}/24`;
                            if (badge.id === 'dr_inventario') progress = `${myData?.inventoryDays.size || 0}/12`;
                            if (badge.id === 'mestre_reversa') progress = `${myData?.reversaPallets.size || 0}/20`;
                        }

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
                                {progress && (
                                    <div className="mt-2 h-1 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div className="h-full bg-primary" style={{ width: `${Math.min(100, (parseInt(progress.split('/')[0]) / parseInt(progress.split('/')[1])) * 100)}%` }} />
                                    </div>
                                )}
                                {badge.unlocked && badge.unlockedAt && (
                                    <p className="text-[9px] text-yellow-600 font-bold mt-2 uppercase tracking-tighter">Conquistado!</p>
                                )}
                                {!badge.unlocked && progress && (
                                    <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-tighter">{progress}</p>
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
