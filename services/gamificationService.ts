// Gamification Engine — SPR, XP, Levels, Achievements, Anti-Fraud
// import { supabase } from './supabase'; // Mocked but unused now

// ... (keep types and constants as is) ...

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
    { name: 'Grão-Mestre', minXP: 35000, color: 'text-red-400', bgColor: 'bg-red-500/20', borderColor: 'border-red-400', icon: 'local_fire_department' },
    { name: 'Desafiante', minXP: 45000, color: 'text-yellow-300', bgColor: 'bg-gradient-to-r from-black to-yellow-900/40', borderColor: 'border-yellow-400', icon: 'military_tech' },
];

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
    { id: 'streak_10', title: 'Consistência de Ferro', description: '10 dias consecutivos acima da meta', icon: 'whatshot', unlocked: false },
    { id: 'scans_1000', title: 'Scanner Mestre', description: '1.000 scans no mês', icon: 'inventory_2', unlocked: false },
    { id: 'zero_errors_30', title: 'Perfeição', description: '0 erros por 30 dias', icon: 'auto_awesome', unlocked: false },
    { id: 'top3_weekly', title: 'Pódio Semanal', description: 'Top 3 no ranking do período', icon: 'military_tech', unlocked: false },
    { id: 'avg_110', title: 'Superação', description: '110% meta média no mês', icon: 'speed', unlocked: false },
    // Novas Conquistas
    { id: 'dr_inventario', title: 'Doutor Inventário', description: 'Participar de 12 inventários cíclicos', icon: 'fact_check', unlocked: false },
    { id: 'participacao_ativa', title: 'Participação Ativa', description: 'Bipar pacotes 24 dias no mês', icon: 'calendar_month', unlocked: false },
    { id: 'protetor_pacotes', title: 'Protetor de Pacotes', description: '50 tratativas no mês', icon: 'verified_user', unlocked: false },
    { id: 'investigador', title: 'O Investigador', description: 'Achar 50 possíveis perdas no mês', icon: 'manage_search', unlocked: false },
    { id: 'expedidor_mestre', title: 'Expedidor Mestre', description: 'Expedir 120 motoristas no mês', icon: 'local_shipping', unlocked: false },
    { id: 'scanner_lendario', title: 'Scanner Lendário', description: '10.000 scans no mês', icon: 'stars', unlocked: false },
    { id: 'proativo', title: 'O Proativo', description: '20 dias com Entrada+Saída+Inventário', icon: 'bolt', unlocked: false },
    { id: 'mestre_ps', title: 'Mestre do PS', description: '100 incidentes registrados no mês', icon: 'assignment_late', unlocked: false },
    { id: 'mestre_reversa', title: 'Mestre da Reversa', description: 'Expedir 20 pallets de reversa no mês', icon: 'sync_alt', unlocked: false },
    { id: 'incansavel', title: 'O Incansável', description: '30.000 scans no mês', icon: 'battery_full', unlocked: false },
];

const STORAGE_KEY = 'wms_gamification_profiles';

// ========================
// SERVICE
// ========================

export class GamificationService {
    private profiles: Map<string, GamificationProfile> = new Map();
    private initialized: boolean = false;

    async init(): Promise<void> {
        if (this.initialized) return;
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                Object.entries(parsed).forEach(([userId, profile]) => {
                    this.profiles.set(userId, profile as GamificationProfile);
                });
            }
            this.initialized = true;
        } catch (e) {
            console.error("Gamification init failed", e);
        }
    }

    private async save(userId: string): Promise<void> {
        const profile = this.profiles.get(userId);
        if (!profile) return;

        const data = localStorage.getItem(STORAGE_KEY);
        const allProfiles = data ? JSON.parse(data) : {};
        allProfiles[userId] = profile;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allProfiles));
    }

    async getProfile(userId: string): Promise<GamificationProfile | undefined> {
        if (!this.initialized) await this.init();
        return this.profiles.get(userId);
    }

    async getAllProfiles(): Promise<GamificationProfile[]> {
        if (!this.initialized) await this.init();
        return Array.from(this.profiles.values());
    }

    private ensureProfile(userId: string, userName: string): GamificationProfile {
        if (!this.profiles.has(userId)) {
            this.profiles.set(userId, {
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
                lastScanTimestamps: [],
            });
        }
        const p = this.profiles.get(userId)!;
        if (userName && p.userName !== userName) p.userName = userName;
        return p;
    }

    // ========================
    // SPR CALCULATION
    // ========================
    calculateSPR(totalScans: number, metaPercent: number, diasAcimaMeta: number, erros: number): number {
        const raw = (totalScans * 0.5) + (metaPercent * 5) + (diasAcimaMeta * 20) - (erros * 30);
        return Math.max(0, Math.round(raw));
    }

    // ========================
    // XP CALCULATION
    // ========================
    calculateXP(spr: number): number {
        return Math.round(spr * 1.2);
    }

    // ========================
    // LEVEL DETERMINATION
    // ========================
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

    // ========================
    // FULL RECALCULATION
    // ========================
    async recalculate(
        userId: string,
        userName: string,
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
        extraMetrics?: {
            inventoryParticipations: number;
            activeDays: number;
            treatmentsDone: number;
            localizedItems: number;
            driverExpeditions: number;
            mixedActivityDays: number;
            incidentsLogged: number;
            reversaPallets: number;
        }
    ): Promise<GamificationProfile> {
        const profile = this.ensureProfile(userId, userName);

        const currentMonth = new Date().toISOString().slice(0, 7);
        const lastLog = profile.performanceLogs[profile.performanceLogs.length - 1];
        if (lastLog && lastLog.mesReferencia !== currentMonth) {
            profile.xpMonthly = 0;
            profile.sprMonthly = 0;
        }

        const spr = this.calculateSPR(totalScans, metaPercent, diasAcimaMeta, erros);
        const xp = this.calculateXP(spr);

        profile.sprMonthly = spr;
        profile.xpMonthly = xp;
        profile.xpTotal = Math.max(profile.xpTotal, xp);
        profile.consecutiveDaysAboveMeta = consecutiveDays;

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

        const logEntry: PerformanceLog = {
            userId, userName, totalScans, metaPercent, diasAcimaMeta, erros, spr, xp: profile.xpMonthly, mesReferencia: currentMonth
        };

        const existingIdx = profile.performanceLogs.findIndex(l => l.mesReferencia === currentMonth);
        if (existingIdx >= 0) {
            profile.performanceLogs[existingIdx] = logEntry;
        } else {
            profile.performanceLogs.push(logEntry);
        }

        await this.save(userId);
        return profile;
    }

    // ========================
    // ACHIEVEMENTS
    // ========================
    private async checkAchievements(
        profile: GamificationProfile,
        monthlyScans: number,
        consecutiveDays: number,
        zeroErrorDays: number,
        isTop3Weekly: boolean,
        avgMetaPercent: number,
        extra?: {
            inventoryParticipations: number;
            activeDays: number;
            treatmentsDone: number;
            localizedItems: number;
            driverExpeditions: number;
            mixedActivityDays: number;
            incidentsLogged: number;
            reversaPallets: number;
        }
    ): Promise<void> {
        const unlock = async (id: string) => {
            const badge = profile.badges.find(b => b.id === id);
            if (badge && !badge.unlocked) {
                badge.unlocked = true;
                badge.unlockedAt = new Date().toISOString();
            }
        };

        if (consecutiveDays >= 10) await unlock('streak_10');
        if (monthlyScans >= 1000) await unlock('scans_1000');
        if (zeroErrorDays >= 30) await unlock('zero_errors_30');
        if (isTop3Weekly) await unlock('top3_weekly');
        if (avgMetaPercent >= 110) await unlock('avg_110');

        // Novas Conquistas
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

    // ========================
    // ANTI-FRAUD
    // ========================
    async registerScan(userId: string, userName: string): Promise<{ suspicious: boolean; reason?: string }> {
        const profile = this.ensureProfile(userId, userName);
        const now = Date.now();

        profile.lastScanTimestamps.push(now);
        if (profile.lastScanTimestamps.length > 20) profile.lastScanTimestamps = profile.lastScanTimestamps.slice(-20);

        const timestamps = profile.lastScanTimestamps;

        if (timestamps.length >= 10) {
            const last10 = timestamps.slice(-10);
            const span = (last10[last10.length - 1] - last10[0]) / 1000;
            if (span < 20) {
                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Velocidade suspeita: ${(10 / span).toFixed(1)} scans/s`);
                profile.fraudFlag = true;
                await this.save(userId);
                return { suspicious: true, reason: 'Velocidade de scan suspeita detectada' };
            }
        }

        if (timestamps.length >= 6) {
            const last6 = timestamps.slice(-6);
            const intervals = [];
            for (let i = 1; i < last6.length; i++) intervals.push(last6[i] - last6[i - 1]);
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            const allSimilar = intervals.every(iv => Math.abs(iv - avgInterval) < 100);
            if (allSimilar && avgInterval < 3000) {
                profile.fraudAlerts.push(`${new Date().toLocaleString()} - Padrão repetitivo: intervalo constante de ${Math.round(avgInterval)}ms`);
                profile.fraudFlag = true;
                await this.save(userId);
                return { suspicious: true, reason: 'Padrão repetitivo de scan detectado' };
            }
        }

        await this.save(userId);
        return { suspicious: false };
    }

    async clearFraudFlag(userId: string): Promise<void> {
        const profile = this.profiles.get(userId);
        if (profile) {
            profile.fraudFlag = false;
            await this.save(userId);
        }
    }

    // ========================
    // RANKING
    // ========================
    async getMonthlyRanking(): Promise<GamificationProfile[]> {
        if (!this.initialized) await this.init();
        return Array.from(this.profiles.values())
            .filter(p => p.sprMonthly > 0)
            .sort((a, b) => b.sprMonthly - a.sprMonthly);
    }
}

// Singleton
export const gamificationService = new GamificationService();
