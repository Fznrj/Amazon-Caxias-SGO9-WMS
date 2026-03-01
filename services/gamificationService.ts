import { getSaoPauloIso } from '../utils/dateUtils';
import { ApiService } from './apiService';
import { User } from '../types';

export interface GamificationLevel {
    name: string;
    minXP: number;
    color: string;       // Tailwind text color
    bgColor: string;     // Tailwind bg color
    borderColor: string; // Tailwind border color
    icon: string;        // emoji
}

export interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    unlocked: boolean;
    unlockedAt?: string;
}

export interface PerformanceLog {
    userId: string;
    userName: string;
    totalScans: number;
    metaPercent: number;
    diasAcimaMeta: number;
    erros: number;
    spr: number;
    xp: number;
    mesReferencia: string; // YYYY-MM
}

export interface GamificationProfile {
    userId: string;
    userName: string;
    xpMonthly: number;
    xpTotal: number;
    currentLevel: string;
    sprMonthly: number;
    badges: Achievement[];
    fraudFlag: boolean;
    fraudAlerts: string[];
    performanceLogs: PerformanceLog[];
    // Daily tracking
    dailyScans: Record<string, number>; // date -> scan count
    dailyErrors: Record<string, number>; // date -> error count
    consecutiveDaysAboveMeta: number;
    totalDaysAboveMeta: number;
    lastScanTimestamps: number[]; // timestamps for anti-fraud
}

// ========================
// CONSTANTS
// ========================

export const DAILY_GOAL = 350;

export const LEVELS: GamificationLevel[] = [
    { name: 'Ferro', minXP: 0, color: 'text-slate-400', bgColor: 'bg-slate-700', borderColor: 'border-slate-500', icon: 'diamond' },
    { name: 'Bronze', minXP: 1000, color: 'text-amber-700', bgColor: 'bg-amber-900/30', borderColor: 'border-amber-700', icon: 'workspace_premium' },
    { name: 'Prata', minXP: 2500, color: 'text-slate-300', bgColor: 'bg-slate-400/20', borderColor: 'border-slate-300', icon: 'workspace_premium' },
    { name: 'Ouro', minXP: 5000, color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', borderColor: 'border-yellow-400', icon: 'workspace_premium' },
    { name: 'Platina', minXP: 8000, color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', borderColor: 'border-cyan-400', icon: 'auto_awesome' },
    { name: 'Esmeralda', minXP: 12000, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', borderColor: 'border-emerald-400', icon: 'verified' },
    { name: 'Diamante', minXP: 18000, color: 'text-blue-400', bgColor: 'bg-blue-500/20', borderColor: 'border-blue-400', icon: 'diamond' },
    { name: 'Mestre', minXP: 25000, color: 'text-purple-400', bgColor: 'bg-purple-500/20', borderColor: 'border-purple-400', icon: 'stars' },
    { name: 'Gr\u00e3o-Mestre', minXP: 35000, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-400', icon: 'local_fire_department' },
    { name: 'Desafiante', minXP: 45000, color: 'text-yellow-300', bgColor: 'bg-gradient-to-r from-black to-yellow-900/40', borderColor: 'border-yellow-400', icon: 'military_tech' },
];

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
    { id: 'streak_10', title: 'Consist\u00eancia de Ferro', description: '10 dias consecutivos acima da meta', icon: 'whatshot', unlocked: false },
    { id: 'scans_1000', title: 'Scanner Mestre', description: '1.000 scans no m\u00eas', icon: 'inventory_2', unlocked: false },
    { id: 'zero_errors_30', title: 'Perfeição', description: '0 erros por 30 dias', icon: 'auto_awesome', unlocked: false },
    { id: 'top3_weekly', title: 'P\u00f3dio Semanal', description: 'Top 3 no ranking do per\u00edodo', icon: 'military_tech', unlocked: false },
    { id: 'avg_110', title: 'Supera\u00e7\u00e3o', description: '110% meta m\u00e9dia no m\u00eas', icon: 'speed', unlocked: false },
    { id: 'dr_inventario', title: 'Doutor Invent\u00e1rio', description: 'Participar de 12 invent\u00e1rios c\u00edclicos', icon: 'fact_check', unlocked: false },
    { id: 'participacao_ativa', title: 'Participa\u00e7\u00e3o Ativa', description: 'Bipar pacotes 24 dias no m\u00eas', icon: 'calendar_month', unlocked: false },
    { id: 'protetor_pacotes', title: 'Protetor de Pacotes', description: '50 tratativas no m\u00eas', icon: 'verified_user', unlocked: false },
    { id: 'investigador', title: 'O Investigador', description: 'Achar 50 poss\u00edveis perdas no m\u00eas', icon: 'manage_search', unlocked: false },
    { id: 'expedidor_mestre', title: 'Expedidor Mestre', description: 'Expedir 120 motoristas no m\u00eas', icon: 'local_shipping', unlocked: false },
    { id: 'scanner_lendario', title: 'Scanner Lend\u00e1rio', description: '10.000 scans no m\u00eas', icon: 'stars', unlocked: false },
    { id: 'proativo', title: 'O Proativo', description: '20 dias com Entrada+Saída+Inventário', icon: 'bolt', unlocked: false },
    { id: 'mestre_ps', title: 'Mestre do PS', description: '100 incidentes registrados no m\u00eas', icon: 'assignment_late', unlocked: false },
    { id: 'mestre_reversa', title: 'Mestre da Reversa', description: 'Expedir 20 pallets de reversa no m\u00eas', icon: 'sync_alt', unlocked: false },
    { id: 'incansavel', title: 'O Incans\u00e1vel', description: '30.000 scans no m\u00eas', icon: 'battery_full', unlocked: false },
];

export class GamificationService {
    private profiles: Map<string, GamificationProfile> = new Map();
    private initialized: boolean = false;

    async init(currentUser: User): Promise<void> {
        try {
            const apiResult = await ApiService.getGamificationProfiles(currentUser);

            if (!apiResult.success) throw new Error(apiResult.error);

            const data = apiResult.data;

            if (apiResult.data) {
                this.profiles.clear();
                apiResult.data.forEach((p: any) => {
                    this.profiles.set(p.user_name, {
                        userId: p.user_id,
                        userName: p.user_name,
                        xpMonthly: p.xp_monthly,
                        xpTotal: p.xp_total,
                        currentLevel: p.current_level,
                        sprMonthly: p.spr_monthly,
                        badges: p.badges || DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
                        fraudFlag: p.fraud_flag,
                        fraudAlerts: p.fraud_alerts || [],
                        performanceLogs: [],
                        dailyScans: {},
                        dailyErrors: {},
                        consecutiveDaysAboveMeta: 0,
                        totalDaysAboveMeta: 0,
                        lastScanTimestamps: [],
                    });
                });
            }
            this.initialized = true;
        } catch (e) {
            console.error("Gamification init failed", e);
        }
    }

    private async save(userId: string, userName: string, currentUser: User): Promise<void> {
        const profile = this.profiles.get(userName);
        if (!profile) return;

        const dbProfile = {
            user_id: userId,
            user_name: userName,
            xp_monthly: profile.xpMonthly,
            xp_total: profile.xpTotal,
            current_level: profile.currentLevel,
            spr_monthly: profile.sprMonthly,
            badges: profile.badges,
            fraud_flag: profile.fraudFlag,
            fraud_alerts: profile.fraudAlerts
        };

        const result = await ApiService.saveGamificationProfile(dbProfile, currentUser);
        if (!result.success) console.error("Gamification save failed", result.error);
    }

    async getProfile(userName: string): Promise<GamificationProfile | undefined> {
        return this.profiles.get(userName);
    }

    async getAllProfiles(): Promise<GamificationProfile[]> {
        return Array.from(this.profiles.values());
    }

    private ensureProfile(userId: string, userName: string): GamificationProfile {
        if (!this.profiles.has(userName)) {
            this.profiles.set(userName, {
                userId,
                userName,
                xpMonthly: 0,
                xpTotal: 0,
                currentLevel: 'Ferro',
                sprMonthly: 0,
                badges: DEFAULT_ACHIEVEMENTS.map(a => ({ ...a })),
                fraudFlag: false,
                fraudAlerts: [],
                performanceLogs: [],
                dailyScans: {},
                dailyErrors: {},
                consecutiveDaysAboveMeta: 0,
                totalDaysAboveMeta: 0,
                lastScanTimestamps: [],
            });
        }
        return this.profiles.get(userName)!;
    }

    calculateSPR(totalScans: number, metaPercent: number, diasAcimaMeta: number, erros: number, timestamps: number[] = []): number {
        const baseBonus = (metaPercent * 5) + (diasAcimaMeta * 20) - (erros * 30);
        let projectedScansPerHour = totalScans * 0.5; // fallback

        if (timestamps && timestamps.length > 0) {
            const sorted = [...timestamps].sort((a, b) => a - b);

            if (sorted.length === 1) {
                // "1 bipe isolado deve calcular a projeção de SPR baseada no tempo"
                // For a single scan, project a reasonable baseline velocity (e.g., 1 scan per 30s = 120 SPH)
                projectedScansPerHour = 120;
            } else {
                let totalDiff = 0;
                let diffCount = 0;
                for (let i = 1; i < sorted.length; i++) {
                    const diff = (sorted[i] - sorted[i - 1]) / 1000; // secs
                    if (diff > 0 && diff < 1800) { // max 30 mins gap
                        totalDiff += diff;
                        diffCount++;
                    }
                }
                if (diffCount > 0) {
                    const avgSecs = totalDiff / diffCount;
                    projectedScansPerHour = 3600 / Math.max(avgSecs, 1);
                }
            }
        }

        const raw = projectedScansPerHour + baseBonus;
        return Math.max(0, Math.round(raw));
    }

    calculateXP(spr: number, totalScans: number): number {
        // Flat rate + velocity bonus
        const baseXP = totalScans * 2;
        const speedBonus = Math.round(spr * 0.5);
        return baseXP + speedBonus;
    }

    getLevel(xp: number): GamificationLevel {
        let level = LEVELS[0];
        for (const l of LEVELS) {
            if (xp >= l.minXP) level = l;
        }
        return level;
    }

    getNextLevel(xp: number): GamificationLevel | null {
        for (const l of LEVELS) {
            if (l.minXP > xp) return l;
        }
        return null;
    }

    async recalculate(
        userId: string,
        userName: string,
        companyId: string,
        totalScans: number,
        metaPercent: number,
        diasAcimaMeta: number,
        erros: number,
        monthlyTotalScans: number,
        isTop1: boolean,
        isTop3Weekly: boolean,
        consecutiveDays: number,
        zeroErrorDays: number,
        avgMetaPercent: number,
        currentUser: User,
        extraMetrics?: any,
        skipSave: boolean = false
    ): Promise<GamificationProfile> {
        const profile = this.ensureProfile(userId, userName);

        const spr = this.calculateSPR(monthlyTotalScans, metaPercent, diasAcimaMeta, erros, extraMetrics?.todayTimestamps);
        const xp = this.calculateXP(spr, monthlyTotalScans);

        profile.sprMonthly = spr;
        profile.xpMonthly = xp;
        profile.xpTotal = Math.max(profile.xpTotal, xp);
        profile.consecutiveDaysAboveMeta = consecutiveDays;
        profile.totalDaysAboveMeta = diasAcimaMeta;

        let level = this.getLevel(xp);
        if (level.name === 'Desafiante' && !isTop1) {
            level = LEVELS[8]; // Grão-Mestre
        }
        profile.currentLevel = level.name;

        await this.checkAchievements(
            profile,
            monthlyTotalScans,
            consecutiveDays,
            zeroErrorDays,
            isTop3Weekly,
            avgMetaPercent,
            extraMetrics
        );

        if (profile.fraudFlag) {
            profile.xpMonthly = Math.round(profile.xpMonthly * 0.8);
        }

        if (!skipSave) {
            await this.save(userId, userName, currentUser);
        }
        return profile;
    }

    private async checkAchievements(
        profile: GamificationProfile,
        monthlyScans: number,
        consecutiveDays: number,
        zeroErrorDays: number,
        isTop3Weekly: boolean,
        avgMetaPercent: number,
        extra?: any
    ): Promise<void> {
        const unlock = async (id: string) => {
            const badge = profile.badges.find(b => b.id === id);
            if (badge && !badge.unlocked) {
                badge.unlocked = true;
                badge.unlockedAt = getSaoPauloIso();
            }
        };

        if (consecutiveDays >= 10) await unlock('streak_10');
        if (monthlyScans >= 1000) await unlock('scans_1000');
        if (zeroErrorDays >= 30) await unlock('zero_errors_30');
        if (isTop3Weekly) await unlock('top3_weekly');

        // Desativar badge "Superação" no primeiro dia do mês; só calcular se tiver histórico consolidado
        if (avgMetaPercent >= 110 && extra?.activeDays > 1) await unlock('avg_110');

        if (extra) {
            if (extra.inventoryParticipations >= 12) await unlock('dr_inventario');
            if (extra.activeDays >= 24) await unlock('participacao_ativa');
            if (extra.treatmentsDone >= 50) await unlock('protetor_pacotes');
            if (extra.localizedItems >= 50) await unlock('investigador');
            if (extra.driverExpeditions >= 120) await unlock('expedidor_mestre');
            if (monthlyScans >= 10000) await unlock('scanner_lendario');
            if (extra.mixedActivityDays >= 20) await unlock('proativo');
            if (extra.incidentsLogged >= 100) await unlock('mestre_ps');
            if (extra.reversaPallets >= 20) await unlock('mestre_reversa');
            if (monthlyScans >= 30000) await unlock('incansavel');
        }
    }

    async registerScan(userId: string, userName: string, currentUser: User): Promise<{ suspicious: boolean; reason?: string }> {
        const profile = this.ensureProfile(userId, userName);
        const now = Date.now();

        profile.lastScanTimestamps.push(now);
        if (profile.lastScanTimestamps.length > 20) profile.lastScanTimestamps = profile.lastScanTimestamps.slice(-20);

        const timestamps = profile.lastScanTimestamps;

        if (timestamps.length >= 10) {
            const last10 = timestamps.slice(-10);
            const span = (last10[last10.length - 1] - last10[0]) / 1000;
            if (span < 2) { // 2 seconds for 10 scans is inhumanly fast
                profile.fraudAlerts.push(`${getSaoPauloIso()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
                profile.fraudFlag = true;
                await this.save(userId, userName, currentUser);
                return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
            }
        }

        await this.save(userId, userName, currentUser);
        return { suspicious: false };
    }

    async clearFraudFlag(userId: string, userName: string, currentUser: User): Promise<void> {
        const profile = this.profiles.get(userName);
        if (profile) {
            profile.fraudFlag = false;
            await this.save(userId, userName, currentUser);
        }
    }

    async getMonthlyRanking(): Promise<GamificationProfile[]> {
        return Array.from(this.profiles.values())
            .filter(p => p.sprMonthly > 0)
            .sort((a, b) => b.sprMonthly - a.sprMonthly);
    }
}

export const gamificationService = new GamificationService();
