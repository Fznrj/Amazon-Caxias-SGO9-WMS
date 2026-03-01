/**
 * KpiContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: fornecer produtividade de operadores
 * (já calculada pelo banco via v_today_operator_productivity)
 * e montar os KPIs do Dashboard.
 *
 * FONTES:
 *  - v_today_operator_productivity (SELECT direto no Supabase)
 *  - Direct queries to inbound_log, outbound_log, inventory_log, rts_log
 *    for weekly chart volume and historical productivity reports
 *  - useWmsData() para stockItems, expeditions
 *
 * REATIVIDADE:
 *  - useEffect observa inboundItems, outboundItems, inventoryItems, rtsLogs
 *  - Quando qualquer um muda → SELECT na View SQL + fetch weekly volume
 * ─────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { User } from '../types';
import { useWmsData } from './WmsDataContext';
import { supabase } from '../services/supabase';
import { ApiService } from '../services/apiService';
import { getSaoPauloDate, getTodayDate, parseToDate, isSameDay } from '../utils/dateUtils';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface OperatorProductivity {
    operator: string;
    company_id?: string;
    scan_date: string;
    total_scans: number;
    inbound_scans: number;
    outbound_scans: number;
    inventory_scans: number;
    rts_scans: number;
}

export interface StatsSummary {
    weeklyStats: WeeklyStatDay[];
    totalInboundToday: number;
    totalOutboundToday: number;
    totalReversaToday: number;
    totalEmEstoque: number;
    staleItemsCount: number;
    totalPossibleLosses: number;
    totalLossItems: number;
}

interface WeeklyStatDay {
    name: string;
    rawDate: string;
    entradas: number;
    saidas: number;
    inventario: number;
    entregues: number;
    rts: number;
}

interface KpiContextValue {
    operatorProductivity: OperatorProductivity[];
    statsSummary: StatsSummary;
    kpiLoading: boolean;
    fetchWeeklyVolumeData: () => Promise<void>;
    fetchDashboardPeriodStats: (startDate: string, endDate: string) => Promise<{ entradas: number; saidas: number; reversas: number }>;
    fetchProductivityReport: (startDate: string, endDate: string) => Promise<OperatorProductivity[]>;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const KpiContext = createContext<KpiContextValue>({} as KpiContextValue);

export const useKpi = () => useContext(KpiContext);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

interface KpiProviderProps {
    children: ReactNode;
    currentUser: User | null;
}

export const KpiProvider: React.FC<KpiProviderProps> = ({ children, currentUser }) => {

    // ── Consume raw data from WmsDataContext ────────────────
    const {
        inboundItems,
        outboundItems,
        inventoryItems,
        rtsLogs,
        stockItems,
        expeditions,
        todayReversaCount
    } = useWmsData();

    // ── State ───────────────────────────────────────────────
    const [operatorProductivity, setOperatorProductivity] = useState<OperatorProductivity[]>([]);
    const [weeklyVolumeFromDb, setWeeklyVolumeFromDb] = useState<Record<string, { entradas: number; saidas: number; inventario: number; rts: number }>>({});
    const [kpiLoading, setKpiLoading] = useState(false);

    // ── Debounce ref to avoid hammering the DB ─────────────
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ═══════════════════════════════════════════════════════
    // FETCH from v_today_operator_productivity
    // Produtividade calculada 100% pelo banco. Zero JS sums.
    // ═══════════════════════════════════════════════════════

    const fetchTodayProductivity = useCallback(async () => {
        if (!currentUser) return;

        try {
            setKpiLoading(true);

            const query = supabase
                .from('v_today_operator_productivity')
                .select('*');

            const { data, error } = await ApiService.applyScope(query, currentUser);

            if (error) {
                console.error('KpiContext: Error fetching v_today_operator_productivity:', error);
                return;
            }

            if (data) {
                const mapped: OperatorProductivity[] = data.map((row: any) => ({
                    operator: row.operator,
                    company_id: row.company_id,
                    scan_date: row.scan_date,
                    total_scans: Number(row.total_scans || 0),
                    inbound_scans: Number(row.inbound_scans || 0),
                    outbound_scans: Number(row.outbound_scans || 0),
                    inventory_scans: Number(row.inventory_scans || 0),
                    rts_scans: Number(row.rts_scans || 0)
                }));
                setOperatorProductivity(mapped);
            }
        } catch (err) {
            console.error('KpiContext: Unexpected error fetching productivity:', err);
        } finally {
            setKpiLoading(false);
        }
    }, [currentUser]);

    // ═══════════════════════════════════════════════════════
    // FETCH DASHBOARD PERIOD STATS — Queries historical events
    // ═══════════════════════════════════════════════════════
    const fetchDashboardPeriodStats = async (startDate: string, endDate: string) => {
        if (!currentUser) return { entradas: 0, saidas: 0, reversas: 0 };
        try {
            // Need to cover the whole exact day in America/Sao_Paulo
            // Assuming startDate and endDate are 'YYYY-MM-DD'
            const startIso = `${startDate}T00:00:00.000-03:00`;
            const endIso = `${endDate}T23:59:59.999-03:00`;

            const [inbRes, outRes] = await Promise.all([
                ApiService.applyScope(
                    supabase.from('inbound_log')
                        .select('id', { count: 'exact' })
                        .gte('created_at', startIso)
                        .lte('created_at', endIso)
                        .eq('error', false),
                    currentUser
                ),
                ApiService.applyScope(
                    supabase.from('outbound_log')
                        .select('status')
                        .gte('created_at', startIso)
                        .lte('created_at', endIso),
                    currentUser
                )
            ]);

            const entradas = inbRes.count || 0;
            let saidas = 0;
            let reversas = 0;

            if (outRes.data) {
                outRes.data.forEach(row => {
                    const st = row.status?.toLowerCase() || '';
                    if (st.includes('reversa')) {
                        reversas++;
                    } else {
                        saidas++;
                    }
                });
            }

            return { entradas, saidas, reversas };
        } catch (error) {
            console.error('API Error in fetchDashboardPeriodStats:', error);
            return { entradas: 0, saidas: 0, reversas: 0 };
        }
    };

    // ═══════════════════════════════════════════════════════
    // FETCH WEEKLY VOLUME — Direct queries to raw log tables
    // Queries inbound_log, outbound_log, inventory_log, rts_log
    // for the last 7 days. No dependency on SQL Views.
    // ═══════════════════════════════════════════════════════

    const fetchWeeklyVolumeData = useCallback(async () => {
        if (!currentUser) return;

        try {
            const baseDate = getTodayDate();
            const sevenDaysAgo = new Date(baseDate);
            sevenDaysAgo.setDate(baseDate.getDate() - 7);
            const sinceIso = sevenDaysAgo.toISOString();

            // Parallel queries to all 4 log tables (only need created_at for grouping)
            const [inbRes, outRes, invRes, rtsRes] = await Promise.all([
                ApiService.applyScope(
                    supabase.from('inbound_log').select('created_at').gte('created_at', sinceIso).eq('error', false),
                    currentUser
                ),
                ApiService.applyScope(
                    supabase.from('outbound_log').select('created_at').gte('created_at', sinceIso),
                    currentUser
                ),
                ApiService.applyScope(
                    supabase.from('inventory_log').select('created_at').gte('created_at', sinceIso),
                    currentUser
                ),
                ApiService.applyScope(
                    supabase.from('rts_log').select('created_at').gte('created_at', sinceIso),
                    currentUser
                ),
            ]);

            // Group counts by São Paulo date key (YYYY-MM-DD)
            const volume: Record<string, { entradas: number; saidas: number; inventario: number; rts: number }> = {};

            const countByDay = (rows: any[] | null, field: 'entradas' | 'saidas' | 'inventario' | 'rts') => {
                (rows || []).forEach((row: any) => {
                    if (!row.created_at) return;
                    const dayKey = getSaoPauloDate(parseToDate(row.created_at));
                    if (!volume[dayKey]) volume[dayKey] = { entradas: 0, saidas: 0, inventario: 0, rts: 0 };
                    volume[dayKey][field]++;
                });
            };

            countByDay(inbRes?.data, 'entradas');
            countByDay(outRes?.data, 'saidas');
            countByDay(invRes?.data, 'inventario');
            countByDay(rtsRes?.data, 'rts');

            setWeeklyVolumeFromDb(volume);
        } catch (err) {
            console.error('KpiContext: Error fetching weekly volume from raw logs:', err);
        }
    }, [currentUser]);

    // ═══════════════════════════════════════════════════════
    // REACTIVE TRIGGER — Debounced SELECT on log changes
    // When Realtime pushes new items into WmsDataContext arrays,
    // this effect fires and re-queries the SQL View + weekly volume.
    // ═══════════════════════════════════════════════════════

    useEffect(() => {
        if (!currentUser) return;

        // Debounce: wait 500ms after last change before querying
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            fetchTodayProductivity();
            fetchWeeklyVolumeData();
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [inboundItems, outboundItems, inventoryItems, rtsLogs, currentUser, fetchTodayProductivity, fetchWeeklyVolumeData]);

    // ═══════════════════════════════════════════════════════
    // STATS SUMMARY — Dashboard KPIs
    // Uses operatorProductivity (from SQL View) for today's scan counts.
    // Uses weeklyVolumeFromDb (from direct log queries) for weekly chart.
    // Uses stockItems (from WmsDataContext) for stock KPIs.
    // ═══════════════════════════════════════════════════════

    const statsSummary: StatsSummary = useMemo(() => {
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        const baseDate = getTodayDate();
        const todayKey = getSaoPauloDate(baseDate);

        // ── 1. Build 7-day skeleton ─────────────────────────
        const last7Days: WeeklyStatDay[] = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date(baseDate);
            d.setDate(baseDate.getDate() - i);
            last7Days.push({
                name: dayNames[d.getDay()],
                rawDate: getSaoPauloDate(d),
                entradas: 0, saidas: 0, inventario: 0, entregues: 0, rts: 0
            });
        }

        // ── 2. Merge with DIRECT DB volume data ─────────────
        const weeklyStats = last7Days.map(emptyDay => {
            const dbDay = weeklyVolumeFromDb[emptyDay.rawDate];
            if (dbDay) {
                return {
                    ...emptyDay,
                    entradas: dbDay.entradas || 0,
                    saidas: (dbDay.saidas || 0) + (dbDay.rts || 0),
                    inventario: dbDay.inventario || 0,
                    rts: dbDay.rts || 0
                };
            }
            return emptyDay;
        });

        // ── 3. Today's counts from operatorProductivity (SQL View) ──
        const todayDate = getTodayDate();
        const totalInboundFromView = operatorProductivity.reduce((sum, op) => sum + op.inbound_scans, 0);
        const totalOutboundFromView = operatorProductivity.reduce((sum, op) => sum + op.outbound_scans, 0);

        // Fallback: count ONLY items whose created_at is today (São Paulo timezone)
        const inboundTodayCount = inboundItems.filter(i => isSameDay(i.createdAt || i.time, todayDate)).length;
        const outboundTodayCount = outboundItems.filter(i => isSameDay((i as any).createdAt || i.time, todayDate)).length;

        // Best available today count
        const dbToday = weeklyVolumeFromDb[todayKey];
        const totalInboundToday = Math.max(totalInboundFromView, inboundTodayCount, dbToday?.entradas || 0);
        const totalOutboundToday = Math.max(totalOutboundFromView, outboundTodayCount, dbToday?.saidas || 0);
        const totalReversaToday = todayReversaCount;

        // ── 4. Today's deliveries from expeditions ──────────
        const expeditionsToday = (expeditions || []).filter(e => e.dispatch_date === todayKey);
        const localEntreguesToday = expeditionsToday.reduce((sum, e) => sum + (e.delivered_count || 0), 0);

        // ── 5. Ensure today's slot in chart uses best available data ──
        const todayIdx = weeklyStats.findIndex(d => d.rawDate === todayKey);
        if (todayIdx >= 0) {
            weeklyStats[todayIdx] = {
                ...weeklyStats[todayIdx],
                entradas: totalInboundToday,
                saidas: totalOutboundToday + totalReversaToday,
                entregues: localEntreguesToday
            };
        }

        // ── 6. Stock-based KPIs ─────────────────────────────
        const totalEmEstoque = stockItems.filter(s => s.status?.toLowerCase() === 'em estoque').length;

        const staleItemsCount = stockItems.filter(s =>
            s.status?.toLowerCase() === 'em estoque' &&
            s.entryTime &&
            getSaoPauloDate(parseToDate(s.entryTime)) < todayKey
        ).length;

        const totalPossibleLosses = stockItems.filter(s => s.status?.toLowerCase() === 'possível perda').length;

        const totalLossItems = stockItems.filter(s => s.status?.toLowerCase() === 'perda').length;

        return {
            weeklyStats,
            totalInboundToday,
            totalOutboundToday,
            totalReversaToday,
            totalEmEstoque,
            staleItemsCount,
            totalPossibleLosses,
            totalLossItems
        };
    }, [operatorProductivity, weeklyVolumeFromDb, expeditions, stockItems, todayReversaCount, inboundItems, outboundItems]);

    // ═══════════════════════════════════════════════════════
    // FETCH PRODUCTIVITY REPORT — Direct log table queries
    // Queries inbound_log, outbound_log, inventory_log, rts_log
    // for a date range. Groups by operator + scan_date.
    // Used by GamificationContext for cumulative monthly XP.
    // ═══════════════════════════════════════════════════════

    const fetchProductivityReport = useCallback(async (startDate: string, endDate: string): Promise<OperatorProductivity[]> => {
        if (!currentUser || !startDate || !endDate) return [];

        try {
            // Build ISO range for Supabase queries (São Paulo timezone)
            const startIso = `${startDate}T00:00:00-03:00`;
            const endIso = `${endDate}T23:59:59-03:00`;

            // Parallel queries to all 4 log tables
            const [inbRes, outRes, invRes, rtsRes] = await Promise.all([
                ApiService.applyScope(
                    supabase.from('inbound_log').select('operator, created_at, error').gte('created_at', startIso).lte('created_at', endIso),
                    currentUser
                ),
                ApiService.applyScope(
                    supabase.from('outbound_log').select('operator, created_at').gte('created_at', startIso).lte('created_at', endIso),
                    currentUser
                ),
                ApiService.applyScope(
                    supabase.from('inventory_log').select('operator, created_at').gte('created_at', startIso).lte('created_at', endIso),
                    currentUser
                ),
                ApiService.applyScope(
                    supabase.from('rts_log').select('operator, created_at').gte('created_at', startIso).lte('created_at', endIso),
                    currentUser
                ),
            ]);

            // Aggregate per operator per day
            const byOpDay = new Map<string, OperatorProductivity>();

            const process = (rows: any[] | null, scanType: 'inbound' | 'outbound' | 'inventory' | 'rts') => {
                (rows || []).forEach((row: any) => {
                    if (!row.operator || !row.created_at) return;
                    if (scanType === 'inbound' && row.error) return;
                    const dayKey = getSaoPauloDate(parseToDate(row.created_at));
                    const mapKey = `${row.operator}__${dayKey}`;
                    if (!byOpDay.has(mapKey)) {
                        byOpDay.set(mapKey, {
                            operator: row.operator,
                            scan_date: dayKey,
                            total_scans: 0, inbound_scans: 0, outbound_scans: 0, inventory_scans: 0, rts_scans: 0
                        });
                    }
                    const entry = byOpDay.get(mapKey)!;
                    entry.total_scans++;
                    if (scanType === 'inbound') entry.inbound_scans++;
                    else if (scanType === 'outbound') entry.outbound_scans++;
                    else if (scanType === 'inventory') entry.inventory_scans++;
                    else if (scanType === 'rts') entry.rts_scans++;
                });
            };

            process(inbRes?.data, 'inbound');
            process(outRes?.data, 'outbound');
            process(invRes?.data, 'inventory');
            process(rtsRes?.data, 'rts');

            return Array.from(byOpDay.values());
        } catch (err) {
            console.error('KpiContext: Error fetching productivity from raw logs:', err);
            return operatorProductivity; // Fallback to today's data
        }
    }, [currentUser, operatorProductivity]);

    // ═══════════════════════════════════════════════════════
    // PROVIDER VALUE
    // ═══════════════════════════════════════════════════════

    const value: KpiContextValue = {
        operatorProductivity,
        statsSummary,
        kpiLoading,
        fetchWeeklyVolumeData,
        fetchDashboardPeriodStats,
        fetchProductivityReport
    };

    return (
        <KpiContext.Provider value={value}>
            {children}
        </KpiContext.Provider>
    );
};
