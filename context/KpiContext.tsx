/**
 * KpiContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: fornecer produtividade de operadores
 * (já calculada pelo banco via v_today_operator_productivity)
 * e montar os KPIs do Dashboard.
 *
 * PROIBIDO:
 *  - .filter() / .reduce() sobre log arrays para calcular produtividade
 *  - Qualquer lógica de gamificação (XP, SPR, Ranking)
 *
 * FONTES:
 *  - v_today_operator_productivity (SELECT direto no Supabase)
 *  - useWmsData() para stockItems, expeditions, weeklyStatsFromView
 *
 * REATIVIDADE:
 *  - useEffect observa inboundItems, outboundItems, inventoryItems, rtsLogs
 *  - Quando qualquer um muda → SELECT na View SQL → atualiza operatorProductivity
 * ─────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { User } from '../types';
import { useWmsData } from './WmsDataContext';
import { supabase } from '../services/supabase';
import { ApiService } from '../services/apiService';
import { getSaoPauloDate, getTodayDate, parseToDate } from '../utils/dateUtils';

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
    refreshKpis: () => Promise<void>;
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
        weeklyStatsFromView,
        todayReversaCount
    } = useWmsData();

    // ── State ───────────────────────────────────────────────
    const [operatorProductivity, setOperatorProductivity] = useState<OperatorProductivity[]>([]);
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
    // REACTIVE TRIGGER — Debounced SELECT on log changes
    // When Realtime pushes new items into WmsDataContext arrays,
    // this effect fires and re-queries the SQL View.
    // ═══════════════════════════════════════════════════════

    useEffect(() => {
        if (!currentUser) return;

        // Debounce: wait 500ms after last change before querying
        if (debounceRef.current) clearTimeout(debounceRef.current);

        debounceRef.current = setTimeout(() => {
            fetchTodayProductivity();
        }, 500);

        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [inboundItems, outboundItems, inventoryItems, rtsLogs, currentUser, fetchTodayProductivity]);

    // ═══════════════════════════════════════════════════════
    // STATS SUMMARY — Dashboard KPIs
    // Uses operatorProductivity (from SQL View) for scan counts.
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

        // ── 2. Merge with v_weekly_stats view data ──────────
        let weeklyStats = last7Days.map(emptyDay => {
            const realDay = (weeklyStatsFromView || []).find((d: any) => d.day_date === emptyDay.rawDate);
            return realDay ? {
                ...emptyDay,
                entradas: Number(realDay.entradas || 0),
                saidas: Number(realDay.saidas || 0),
                inventario: Number(realDay.inventario || 0),
                entregues: Number(realDay.entregues || 0),
                rts: Number(realDay.rts || 0)
            } : emptyDay;
        });

        // ── 3. Today's counts — Use BOTH SQL View + raw arrays for reliability ──
        const totalInboundFromView = operatorProductivity.reduce((sum, op) => sum + op.inbound_scans, 0);
        const totalOutboundFromView = operatorProductivity.reduce((sum, op) => sum + op.outbound_scans, 0);
        const totalInventoryFromView = operatorProductivity.reduce((sum, op) => sum + op.inventory_scans, 0);
        const totalRtsFromView = operatorProductivity.reduce((sum, op) => sum + op.rts_scans, 0);

        // Fallback: count directly from raw log arrays (always accurate, even before SQL View loads)
        const totalInboundToday = Math.max(totalInboundFromView, inboundItems.length);
        const totalOutboundToday = Math.max(totalOutboundFromView, outboundItems.length);
        const totalInventoryToday = Math.max(totalInventoryFromView, inventoryItems.length);
        const totalRtsToday = Math.max(totalRtsFromView, rtsLogs.length);
        const totalReversaToday = todayReversaCount;

        // ── 4. Today's deliveries from expeditions ──────────
        const expeditionsToday = (expeditions || []).filter(e => e.dispatch_date === todayKey);
        const localEntreguesToday = expeditionsToday.reduce((sum, e) => sum + (e.delivered_count || 0), 0);

        // ── 5. Override today's slot in the weekly chart ─────
        weeklyStats = weeklyStats.map(d => {
            if (d.rawDate === todayKey) {
                return {
                    ...d,
                    entradas: Math.max(Number(d.entradas || 0), totalInboundToday),
                    saidas: Math.max(Number(d.saidas || 0), totalOutboundToday),
                    inventario: Math.max(Number(d.inventario || 0), totalInventoryToday),
                    entregues: Math.max(Number(d.entregues || 0), localEntreguesToday),
                    rts: Math.max(Number(d.rts || 0), totalRtsToday)
                };
            }
            return d;
        });

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
    }, [operatorProductivity, weeklyStatsFromView, expeditions, stockItems, todayReversaCount, inboundItems, outboundItems, inventoryItems, rtsLogs]);

    // ═══════════════════════════════════════════════════════
    // FETCH PRODUCTIVITY REPORT (for historical date range)
    // Used by ProductivityView when the user selects a custom range.
    // ═══════════════════════════════════════════════════════

    const fetchProductivityReport = useCallback(async (startDate: string, endDate: string): Promise<OperatorProductivity[]> => {
        if (!currentUser) return [];

        // If requesting today only, return the in-memory state
        const todayStr = getSaoPauloDate();
        if (startDate === todayStr && endDate === todayStr) {
            return operatorProductivity;
        }

        // Otherwise, query the historical view
        const result = await ApiService.fetchProductivityReport(startDate, endDate, currentUser);
        return result.success ? (result.data || []) : [];
    }, [currentUser, operatorProductivity]);

    // ═══════════════════════════════════════════════════════
    // PROVIDER VALUE
    // ═══════════════════════════════════════════════════════

    const value: KpiContextValue = {
        operatorProductivity,
        statsSummary,
        kpiLoading,
        refreshKpis: fetchTodayProductivity,
        fetchProductivityReport
    };

    return (
        <KpiContext.Provider value={value}>
            {children}
        </KpiContext.Provider>
    );
};
