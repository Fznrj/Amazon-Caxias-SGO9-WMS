/**
 * GamificationContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Motor do sistema de gamificação da operação.
 * Gerencia XP, SPR, Ranking diário/mensal e Conquistas.
 *
 * FONTES:
 *  - useKpi() → operatorProductivity (ranking de scans válidos)
 *  - useWmsData() → logs brutos APENAS para erros e métricas de conquistas
 *
 * PROIBIDO:
 *  - Fazer SELECT/fetch direto no Supabase para tabelas de log
 *  - Toda matéria-prima vem de useKpi e useWmsData
 *
 * REATIVIDADE:
 *  - useEffect observa operatorProductivity → recalcula XP/SPR/Ranking
 * ─────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { User } from '../types';
import { useKpi, OperatorProductivity } from './KpiContext';
import { useWmsData } from './WmsDataContext';
import {
    gamificationService,
    DAILY_GOAL,
    LEVELS,
    type GamificationProfile,
    type GamificationLevel
} from '../services/gamificationService';
import { getDateKey, getSaoPauloDate, getSaoPauloIso, getTodayDate } from '../utils/dateUtils';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface RankingEntry {
    operator: string;
    position: number;
    totalScans: number;
    inboundScans: number;
    outboundScans: number;
    inventoryScans: number;
    rtsScans: number;
    errors: number;
    profile: GamificationProfile;
}

export interface AchievementProgress {
    current: number;
    goal: number;
    percent: number;
}

interface GamificationContextValue {
    ranking: RankingEntry[];
    allProfiles: GamificationProfile[];
    myProfile: GamificationProfile | null;
    myLevel: GamificationLevel;
    nextLevel: GamificationLevel | null;
    xpProgress: number;
    achievementsProgress: Record<string, AchievementProgress>;
    gamificationLoading: boolean;
    refreshGamification: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const GamificationContext = createContext<GamificationContextValue>({} as GamificationContextValue);

export const useGamification = () => useContext(GamificationContext);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

interface GamificationProviderProps {
    children: ReactNode;
    currentUser: User | null;
}

export const GamificationProvider: React.FC<GamificationProviderProps> = ({ children, currentUser }) => {

    // ── Consume KPI Context (scan counts from SQL View) ─────
    const { operatorProductivity, fetchProductivityReport } = useKpi();

    // ── Consume WmsData Context (for errors & achievement metrics ONLY) ──
    const {
        inboundItems,
        outboundItems,
        inventoryItems,
        rtsItems,
        rtsLogs,
        treatmentItems,
        stockItems
    } = useWmsData();

    // ── State ───────────────────────────────────────────────
    const [allProfiles, setAllProfiles] = useState<GamificationProfile[]>([]);
    const [gamificationLoading, setGamificationLoading] = useState(true);
    const [initialized, setInitialized] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ═══════════════════════════════════════════════════════
    // INIT: Load persisted gamification profiles from DB
    // ═══════════════════════════════════════════════════════

    useEffect(() => {
        if (!currentUser || initialized) return;
        (async () => {
            await gamificationService.init(currentUser);
            setInitialized(true);
        })();
    }, [currentUser, initialized]);

    // ═══════════════════════════════════════════════════════
    // ERROR MAP — Built from logs (NOT for counting scans)
    // Only used for: error counts, achievement metrics
    // ═══════════════════════════════════════════════════════

    const operatorMetrics = useMemo(() => {
        const todayKey = getSaoPauloDate();
        const currentMonth = todayKey.substring(0, 7);

        const metrics = new Map<string, {
            errors: number;
            monthlyErrors: number;
            monthlyUniqueDays: Set<string>;
            monthlyInventoryDays: Set<string>;
            monthlyTreatmentCount: number;
            monthlyLocalizedCount: number;
            monthlyIncidentsCount: number;
            monthlyDriversExpedited: Set<string>;
            monthlyReversaPallets: Set<string>;
            monthlyMixedActivityDays: number;
            dailyActivities: Record<string, Set<string>>;
            dailyErrors: Record<string, number>;
        }>();

        const ensureOp = (op: string) => {
            if (!metrics.has(op)) {
                metrics.set(op, {
                    errors: 0, monthlyErrors: 0,
                    monthlyUniqueDays: new Set(), monthlyInventoryDays: new Set(),
                    monthlyTreatmentCount: 0, monthlyLocalizedCount: 0,
                    monthlyIncidentsCount: 0, monthlyDriversExpedited: new Set(),
                    monthlyReversaPallets: new Set(), monthlyMixedActivityDays: 0,
                    dailyActivities: {}, dailyErrors: {}
                });
            }
            return metrics.get(op)!;
        };

        // ── Errors from inbound ─────────────────────────────
        inboundItems.forEach(item => {
            const op = item.operator;
            const data = ensureOp(op);
            const dateKey = getDateKey(item.createdAt || item.time);
            const isoCheck = dateKey.split('/').reverse().join('-');
            const isThisMonth = isoCheck.substring(0, 7) === currentMonth;

            if (item.error) {
                data.errors++;
                data.dailyErrors[dateKey] = (data.dailyErrors[dateKey] || 0) + 1;
                if (isThisMonth) data.monthlyErrors++;
            }

            if (isThisMonth) {
                data.monthlyUniqueDays.add(dateKey);
                if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
                data.dailyActivities[dateKey].add('ENTRADA');
            }
        });

        // ── Outbound activities & expedition achievements ────
        outboundItems.forEach(item => {
            const op = item.operator;
            const data = ensureOp(op);
            const dateKey = getDateKey(item.createdAt || item.time);
            const isoCheck = dateKey.split('/').reverse().join('-');
            const isThisMonth = isoCheck.substring(0, 7) === currentMonth;

            if (isThisMonth) {
                data.monthlyUniqueDays.add(dateKey);
                data.monthlyDriversExpedited.add(`${item.driverName}_${dateKey}`);
                if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
                data.dailyActivities[dateKey].add('SAIDA');

                if (item.status?.includes('Reversa')) {
                    const minuteKey = (item.createdAt || item.time || '').substring(0, 16);
                    data.monthlyReversaPallets.add(`${item.driverName}_${minuteKey}`);
                }
            }
        });

        // ── Inventory activities ─────────────────────────────
        inventoryItems.forEach(item => {
            const data = ensureOp(item.operator);
            const dateKey = getDateKey(item.createdAt || item.time);
            const isoCheck = dateKey.split('/').reverse().join('-');
            if (isoCheck.substring(0, 7) === currentMonth) {
                data.monthlyInventoryDays.add(dateKey);
                data.monthlyUniqueDays.add(dateKey);
                if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
                data.dailyActivities[dateKey].add('INVENTARIO');
            }
        });

        // ── RTS activities (NOT scan-counting, just activity tracking) ──
        [...rtsItems, ...rtsLogs].forEach(item => {
            if (!item.operator) return;
            const data = ensureOp(item.operator);
            const dateKey = getDateKey(item.created_at || item.time);
            if (dateKey.split('/').reverse().join('-').substring(0, 7) === currentMonth) {
                data.monthlyUniqueDays.add(dateKey);
                if (!data.dailyActivities[dateKey]) data.dailyActivities[dateKey] = new Set();
                data.dailyActivities[dateKey].add('RTS');
            }
        });

        // ── Treatments & Incidents ───────────────────────────
        treatmentItems.forEach(item => {
            const data = ensureOp(item.operator);
            const dateKey = getDateKey(item.time || (item as any).created_at);
            const isoCheck = dateKey.split('/').reverse().join('-');
            if (isoCheck.substring(0, 7) === currentMonth) {
                data.monthlyTreatmentCount++;
                data.monthlyIncidentsCount++;
            }
        });

        // ── Localized items from stock ───────────────────────
        stockItems.forEach(item => {
            if (item.localizedBy) {
                const data = ensureOp(item.localizedBy);
                data.monthlyLocalizedCount++;
            }
        });

        // ── Calculate mixed-activity days ────────────────────
        metrics.forEach(data => {
            data.monthlyMixedActivityDays = Object.values(data.dailyActivities).filter(acts =>
                acts.has('ENTRADA') && acts.has('SAIDA') && acts.has('INVENTARIO')
            ).length;
        });

        return metrics;
    }, [inboundItems, outboundItems, inventoryItems, rtsItems, rtsLogs, treatmentItems, stockItems]);

    // ═══════════════════════════════════════════════════════
    // RECALCULATE XP/SPR/RANKING
    // Triggered by operatorProductivity changes (debounced)
    //
    // KEY: XP, SPR, and Level are CUMULATIVE (monthly).
    //      We fetch the full month's productivity to avoid
    //      resetting at midnight.
    // ═══════════════════════════════════════════════════════

    const recalculateAll = useCallback(async () => {
        if (!currentUser || !initialized) return;

        setGamificationLoading(true);

        try {
            const todayKey = getSaoPauloDate();
            const monthStart = todayKey.substring(0, 8) + '01'; // YYYY-MM-01

            // ── Fetch CUMULATIVE monthly productivity ────────────
            // Wrapped in try/catch — if historical view doesn't exist, fall back to today's data
            const cumulativeByOperator = new Map<string, { scans: number; inbound: number; outbound: number; inventory: number; rts: number; daysAboveMeta: number }>();
            try {
                const monthlyReport = await fetchProductivityReport(monthStart, todayKey);
                monthlyReport.forEach(row => {
                    if (!row.operator) return;
                    const opKey = row.operator.toUpperCase().trim();
                    const prev = cumulativeByOperator.get(opKey) || { scans: 0, inbound: 0, outbound: 0, inventory: 0, rts: 0, daysAboveMeta: 0 };
                    prev.scans += row.total_scans;
                    prev.inbound += row.inbound_scans;
                    prev.outbound += row.outbound_scans;
                    prev.inventory += row.inventory_scans;
                    prev.rts += row.rts_scans;
                    if (row.total_scans >= DAILY_GOAL) prev.daysAboveMeta++;
                    cumulativeByOperator.set(opKey, prev);
                });
            } catch (e) {
                console.warn('GamificationContext: Could not fetch monthly report, using today data as fallback');
            }

            const profiles: GamificationProfile[] = [];
            const processedOperators = new Set<string>();

            // Sorted by today's total_scans descending (for daily ranking), errors ascending (tiebreaker)
            const sortedProductivity = [...operatorProductivity].sort((a, b) => {
                if (b.total_scans !== a.total_scans) return b.total_scans - a.total_scans;
                const errA = operatorMetrics.get(a.operator)?.errors || 0;
                const errB = operatorMetrics.get(b.operator)?.errors || 0;
                return errA - errB;
            });

            // Helper to process any operator's gamification based on monthly cumulative + today's scans
            const processOperator = async (operatorName: string, todayScans: number) => {
                const opKey = operatorName.toUpperCase().trim();
                const metrics = operatorMetrics.get(operatorName);
                const cumulative = cumulativeByOperator.get(opKey);

                // Use cumulative monthly scans when available, otherwise fall back to today's scans
                const monthlyScans = (cumulative?.scans && cumulative.scans > 0) ? cumulative.scans : todayScans;
                const monthlyErrors = metrics?.monthlyErrors || 0;
                const monthlyUniqueDays = metrics?.monthlyUniqueDays || new Set<string>();
                const monthlyDiasAcimaMeta = cumulative?.daysAboveMeta || (todayScans >= DAILY_GOAL ? 1 : 0);

                // Consecutive days above goal (simplified for today-only data)
                const consecutive = todayScans >= DAILY_GOAL ? 1 : 0;

                // Zero error days
                const errorDayCount = metrics ? Object.keys(metrics.dailyErrors).length : 0;
                const zeroErrorDays = Math.max(0, monthlyUniqueDays.size - errorDayCount);

                // Monthly meta % based on cumulative scans vs (goal × active days)
                const activeDays = Math.max(1, monthlyUniqueDays.size);
                const monthlyMetaPercent = Math.round((monthlyScans / (DAILY_GOAL * activeDays)) * 100);

                return await gamificationService.recalculate(
                    operatorName,     // userId
                    operatorName,     // userName
                    currentUser.company_id,
                    todayScans,       // periodScans (today — for daily ranking)
                    monthlyMetaPercent, // metaPercent (cumulative)
                    monthlyDiasAcimaMeta,
                    monthlyErrors,
                    monthlyScans,       // cumulative monthly scans
                    false,             // isTop1 (set after sort)
                    false,             // isTop3 (set after sort)
                    consecutive,
                    zeroErrorDays,
                    monthlyMetaPercent, // avgMetaPercent (cumulative)
                    currentUser,
                    {
                        inventoryParticipations: metrics?.monthlyInventoryDays.size || 0,
                        activeDays: monthlyUniqueDays.size,
                        treatmentsDone: metrics?.monthlyTreatmentCount || 0,
                        localizedItems: metrics?.monthlyLocalizedCount || 0,
                        driverExpeditions: metrics?.monthlyDriversExpedited.size || 0,
                        mixedActivityDays: metrics?.monthlyMixedActivityDays || 0,
                        incidentsLogged: metrics?.monthlyIncidentsCount || 0,
                        reversaPallets: metrics?.monthlyReversaPallets.size || 0
                    },
                    operatorName !== currentUser.name // skipSave for others
                );
            };

            for (const prod of sortedProductivity) {
                processedOperators.add(prod.operator.toUpperCase().trim());
                profiles.push(await processOperator(prod.operator, prod.total_scans));
            }

            // Ensure current user appears even with 0 scans today, computing their profile from cumulative history
            if (currentUser && !processedOperators.has(currentUser.name.toUpperCase().trim())) {
                profiles.push(await processOperator(currentUser.name, 0));
            }

            // Sort by SPR for final ranking
            profiles.sort((a, b) => b.sprMonthly - a.sprMonthly);

            // Fix Desafiante: only #1 can hold it
            if (profiles.length > 0) {
                const top1 = profiles[0];
                if (top1.sprMonthly > 0) {
                    const level = gamificationService.getLevel(top1.xpMonthly);
                    if (level.name === 'Desafiante') top1.currentLevel = 'Desafiante';
                }

                profiles.forEach((p, idx) => {
                    // Top 3 badge
                    const isTop3 = idx < 3 && p.sprMonthly > 0;
                    if (isTop3) {
                        const badge = p.badges.find(b => b.id === 'top3_weekly');
                        if (badge && !badge.unlocked) {
                            badge.unlocked = true;
                            badge.unlockedAt = getSaoPauloIso();
                        }
                    }
                    // Demote non-#1 from Desafiante
                    if (idx > 0 && p.currentLevel === 'Desafiante') {
                        p.currentLevel = 'Grão-Mestre';
                    }
                });
            }

            setAllProfiles(profiles);
        } catch (err) {
            console.error('GamificationContext: Recalculation error:', err);
        } finally {
            setGamificationLoading(false);
        }
    }, [currentUser, initialized, operatorProductivity, operatorMetrics, fetchProductivityReport]);

    // ═══════════════════════════════════════════════════════
    // REACTIVE TRIGGER — Debounced on productivity changes
    // ═══════════════════════════════════════════════════════

    useEffect(() => {
        if (!initialized || !currentUser) return;

        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            recalculateAll();
        }, 700); // Slightly longer debounce than KPI to let it settle first

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [operatorProductivity, initialized, currentUser, recalculateAll]);

    // ═══════════════════════════════════════════════════════
    // DERIVED STATE — Ranking, User profile, Level
    // ═══════════════════════════════════════════════════════

    const ranking: RankingEntry[] = useMemo(() => {
        return allProfiles.map((profile, idx) => {
            const prod = operatorProductivity.find(p => p.operator === profile.userName);
            const metrics = operatorMetrics.get(profile.userName);

            return {
                operator: profile.userName,
                position: idx + 1,
                totalScans: prod?.total_scans || 0,
                inboundScans: prod?.inbound_scans || 0,
                outboundScans: prod?.outbound_scans || 0,
                inventoryScans: prod?.inventory_scans || 0,
                rtsScans: prod?.rts_scans || 0,
                errors: metrics?.errors || 0,
                profile
            };
        });
    }, [allProfiles, operatorProductivity, operatorMetrics]);

    const myProfile = useMemo(() => {
        if (!currentUser) return null;
        return allProfiles.find(p => p.userName === currentUser.name) || null;
    }, [allProfiles, currentUser]);

    const myLevel = useMemo(() => {
        if (!myProfile) return LEVELS[0];
        return LEVELS.find(l => l.name === myProfile.currentLevel) || LEVELS[0];
    }, [myProfile]);

    const nextLevel = useMemo(() => {
        if (!myProfile) return LEVELS[1];
        return gamificationService.getNextLevel(myProfile.xpMonthly);
    }, [myProfile]);

    const xpProgress = useMemo(() => {
        if (!myProfile || !nextLevel) return myProfile ? 100 : 0;
        const range = nextLevel.minXP - myLevel.minXP;
        if (range <= 0) return 100;
        return Math.min(100, Math.round(((myProfile.xpMonthly - myLevel.minXP) / range) * 100));
    }, [myProfile, myLevel, nextLevel]);

    // ═══════════════════════════════════════════════════════
    // ACHIEVEMENTS PROGRESS — current / goal for each badge
    // ═══════════════════════════════════════════════════════

    const achievementsProgress: Record<string, AchievementProgress> = useMemo(() => {
        if (!currentUser) return {};

        const metrics = operatorMetrics.get(currentUser.name);
        const prod = operatorProductivity.find(p => p.operator === currentUser.name);
        const totalScans = prod?.total_scans || 0;

        const activeDays = metrics?.monthlyUniqueDays.size || 0;
        const errorDayCount = metrics ? Object.keys(metrics.dailyErrors).length : 0;
        const zeroErrorDays = Math.max(0, activeDays - errorDayCount);

        // Build a map: badge_id -> { current, goal }
        const raw: Record<string, { current: number; goal: number }> = {
            scans_1000: { current: totalScans, goal: 1000 },
            scanner_lendario: { current: totalScans, goal: 10000 },
            incansavel: { current: totalScans, goal: 30000 },
            streak_10: { current: 0, goal: 10 }, // consecutive days — not tracked here, leave 0
            zero_errors_30: { current: zeroErrorDays, goal: 30 },
            top3_weekly: { current: ranking.find(r => r.operator === currentUser.name)?.position || 0, goal: 3 },
            avg_110: { current: Math.round((totalScans / Math.max(DAILY_GOAL, 1)) * 100), goal: 110 },
            dr_inventario: { current: metrics?.monthlyInventoryDays.size || 0, goal: 12 },
            participacao_ativa: { current: activeDays, goal: 24 },
            protetor_pacotes: { current: metrics?.monthlyTreatmentCount || 0, goal: 50 },
            investigador: { current: metrics?.monthlyLocalizedCount || 0, goal: 50 },
            expedidor_mestre: { current: metrics?.monthlyDriversExpedited.size || 0, goal: 120 },
            proativo: { current: metrics?.monthlyMixedActivityDays || 0, goal: 20 },
            mestre_ps: { current: metrics?.monthlyIncidentsCount || 0, goal: 100 },
            mestre_reversa: { current: metrics?.monthlyReversaPallets.size || 0, goal: 20 },
        };

        // Convert to { current, goal, percent }
        const result: Record<string, AchievementProgress> = {};
        for (const [id, v] of Object.entries(raw)) {
            // top3_weekly: position <= 3 means achieved, invert logic
            if (id === 'top3_weekly') {
                const pos = v.current;
                result[id] = { current: pos, goal: v.goal, percent: pos > 0 && pos <= 3 ? 100 : 0 };
            } else {
                result[id] = { current: v.current, goal: v.goal, percent: Math.min(100, Math.round((v.current / Math.max(v.goal, 1)) * 100)) };
            }
        }
        return result;
    }, [currentUser, operatorMetrics, operatorProductivity, ranking]);

    // ═══════════════════════════════════════════════════════
    // PROVIDER VALUE
    // ═══════════════════════════════════════════════════════

    const value: GamificationContextValue = {
        ranking,
        allProfiles,
        myProfile,
        myLevel,
        nextLevel,
        xpProgress,
        achievementsProgress,
        gamificationLoading,
        refreshGamification: recalculateAll
    };

    return (
        <GamificationContext.Provider value={value}>
            {children}
        </GamificationContext.Provider>
    );
};
