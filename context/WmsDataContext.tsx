/**
 * WmsDataContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: manter o estado bruto dos dados do dia atual
 * e gerenciar os listeners do Supabase Realtime.
 *
 * PROIBIDO:
 *  - Calcular produtividade (useMemo sobre arrays)
 *  - Importar gamificationService / XP / SPR / Ranking
 *  - Carregar histórico (apenas registros de "Hoje" SP)
 *
 * REGRAS:
 *  - Filtro de data rigoroso: isSameDay / getSaoPauloDate para "Hoje"
 *  - Realtime: INSERT, UPDATE, DELETE nas 4 tabelas de log
 *  - Timezone: America/Sao_Paulo em todas as validações
 * ─────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import {
    User, Driver, InboundItem, OutboundItem, StockItem,
    TreatmentItem, ExpeditionItem, InventoryItem
} from '../types';
import { supabase } from '../services/supabase';
import { ApiService } from '../services/apiService';
import { getSaoPauloDate, getSaoPauloIso, formatToLocalTime } from '../utils/dateUtils';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface WmsDataContextValue {
    // Raw Today Lists
    inboundItems: InboundItem[];
    outboundItems: OutboundItem[];
    inventoryItems: InventoryItem[];
    rtsLogs: any[];

    // Auxiliary Data (always loaded)
    stockItems: StockItem[];
    possibleLossItems: StockItem[];
    drivers: Driver[];
    treatmentItems: TreatmentItem[];
    expeditions: ExpeditionItem[];
    rtsItems: any[];
    users: User[];
    expectedInboundList: string[];

    // Dashboard Stats (from SQL view)
    dashboardStats: DashboardStats | null;
    weeklyStatsFromView: any[];

    // Reversa count (separate from outbound for Dashboard KPI)
    todayReversaCount: number;

    // State Setters exposed for CRUD operations in the orchestrator
    setInboundItems: React.Dispatch<React.SetStateAction<InboundItem[]>>;
    setOutboundItems: React.Dispatch<React.SetStateAction<OutboundItem[]>>;
    setInventoryItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    setRtsLogs: React.Dispatch<React.SetStateAction<any[]>>;
    setStockItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
    setPossibleLossItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
    setDrivers: React.Dispatch<React.SetStateAction<Driver[]>>;
    setTreatmentItems: React.Dispatch<React.SetStateAction<TreatmentItem[]>>;
    setExpeditions: React.Dispatch<React.SetStateAction<ExpeditionItem[]>>;
    setRtsItems: React.Dispatch<React.SetStateAction<any[]>>;
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setExpectedInboundList: React.Dispatch<React.SetStateAction<string[]>>;
    setDashboardStats: React.Dispatch<React.SetStateAction<DashboardStats | null>>;
    setWeeklyStatsFromView: React.Dispatch<React.SetStateAction<any[]>>;
    setTodayReversaCount: React.Dispatch<React.SetStateAction<number>>;

    // Actions
    loadInitialData: () => Promise<void>;
    broadcastRefresh: () => Promise<void>;
}

interface DashboardStats {
    total_em_estoque: number;
    entradas_hoje: number;
    saidas_hoje: number;
    reversas_hoje: number;
    parados_24h: number;
    possiveis_perdas: number;
    total_perdas: number;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const WmsDataContext = createContext<WmsDataContextValue>({} as WmsDataContextValue);

export const useWmsData = () => useContext(WmsDataContext);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

interface WmsDataProviderProps {
    children: ReactNode;
    currentUser: User | null;
}

export const WmsDataProvider: React.FC<WmsDataProviderProps> = ({ children, currentUser }) => {

    // ── Raw Today Lists ────────────────────────────────────
    const [inboundItems, setInboundItems] = useState<InboundItem[]>([]);
    const [outboundItems, setOutboundItems] = useState<OutboundItem[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [rtsLogs, setRtsLogs] = useState<any[]>([]);

    // ── Auxiliary Data ─────────────────────────────────────
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [possibleLossItems, setPossibleLossItems] = useState<StockItem[]>([]);
    const [drivers, setDrivers] = useState<Driver[]>([]);
    const [treatmentItems, setTreatmentItems] = useState<TreatmentItem[]>([]);
    const [expeditions, setExpeditions] = useState<ExpeditionItem[]>([]);
    const [rtsItems, setRtsItems] = useState<any[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [expectedInboundList, setExpectedInboundList] = useState<string[]>([]);
    const [todayReversaCount, setTodayReversaCount] = useState(0);

    // ── Dashboard Stats (from SQL views) ───────────────────
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [weeklyStatsFromView, setWeeklyStatsFromView] = useState<any[]>([]);

    // ── Scoped query helper ────────────────────────────────
    const applyFilter = useCallback((query: any) => {
        return ApiService.applyScope(query, currentUser);
    }, [currentUser]);

    // ═══════════════════════════════════════════════════════
    // LOAD INITIAL DATA — Only "today" (America/Sao_Paulo)
    // ═══════════════════════════════════════════════════════

    const loadInitialData = useCallback(async () => {
        if (!currentUser) return;

        const todayStr = getSaoPauloDate();
        const companyId = currentUser.company_id;
        const userRole = (currentUser.role || '').toLowerCase();
        const isSuperAdmin = userRole === 'superadmin';

        console.log(`WmsDataContext: Loading data for ${todayStr}. Role: ${userRole}`);

        // Force a zero-state flush before hitting the db to prevent memory bleed
        setInboundItems([]);
        setOutboundItems([]);
        setInventoryItems([]);
        setRtsLogs([]);
        setTodayReversaCount(0);

        try {
            // ── 1. Users ────────────────────────────────────
            let { data: usersData, error: usersErr } = await (
                isSuperAdmin
                    ? supabase.from('users').select('*').order('name', { ascending: true })
                    : supabase.from('users').select('*').eq('company_id', companyId).order('name', { ascending: true })
            );
            if (!usersErr && (!usersData || usersData.length === 0) && isSuperAdmin) {
                const { data: fallback } = await supabase.from('users').select('*').limit(200);
                if (fallback?.length) usersData = fallback;
            }
            if (usersErr) console.error('WmsDataContext: Users error:', usersErr);
            else if (usersData) setUsers(usersData as User[]);

            // ── 2. Bulk fetch via ApiService.fetchAppData ───
            const apiResult = await ApiService.fetchAppData(currentUser);
            if (!apiResult.success) {
                console.error('WmsDataContext: fetchAppData error:', apiResult.error);
                return;
            }

            const [
                { data: driversData, error: de },
                { data: config, error: confE },
                { data: inventory, error: invE },
                { data: rtsData, error: rtsE },
                { data: expData, error: expE },
                { data: dbStats, error: statsE },
                { data: weeklyData, error: weekE },
                { data: allInbound, error: tie },
                { data: toeNormal, error: toeError },
                { data: toeReversa, error: treError },
                { data: allStock, error: sce },
                { data: allIncidents, error: incE },
                { data: _prodData, error: _prodErr },   // Ignored — KpiContext will consume the view directly
                { data: rtsLogsToday, error: rlE }
            ] = apiResult.data;

            // ── Drivers ─────────────────────────────────────
            if (de) console.error('WmsDataContext: Drivers error:', de);
            else if (driversData) {
                setDrivers(driversData.map((d: any) => ({
                    id: d.id, name: d.name, cpf: d.cpf, plate: d.plate,
                    company: d.company, status: d.status,
                    vehicleProfile: d.vehicle_profile,
                    lastActivity: d.last_activity
                })));
            }

            // ── Inventory (Today only — already filtered by fetchAppData) ──
            if (invE) console.error('WmsDataContext: Inventory error:', invE);
            else if (inventory) {
                setInventoryItems(inventory.map((i: any) => ({
                    id: i.id, time: i.time, operator: i.operator, createdAt: i.created_at
                })));
            }

            // ── Config ──────────────────────────────────────
            if (confE) console.error('WmsDataContext: Config error:', confE);
            else if (config?.expected_inbound) setExpectedInboundList(config.expected_inbound);

            // ── Expeditions ─────────────────────────────────
            if (expE) console.error('WmsDataContext: Expeditions error:', expE);
            else if (expData) {
                setExpeditions(expData.map((e: any) => ({
                    id: e.id, driver_name: e.driver_name, plate: e.plate,
                    dispatch_date: e.dispatch_date, total_packages: e.total_packages,
                    delivered_count: e.delivered_count, returned_count: e.returned_count,
                    status: e.status
                })));
            }

            // ── RTS Items & Logs ────────────────────────────
            if (rtsE) console.error('WmsDataContext: RTS Items error:', rtsE);
            else if (rtsData) setRtsItems(rtsData);

            if (rlE) console.error('WmsDataContext: RTS Logs error:', rlE);
            else if (rtsLogsToday) setRtsLogs(rtsLogsToday);

            // ── Stock Items ─────────────────────────────────
            if (sce) console.error('WmsDataContext: Stock error:', sce);
            else if (allStock) {
                const mapped = allStock.map((s: any) => ({
                    id: s.id, entryTime: s.entry_time, operator: s.operator,
                    status: s.status, lossDetectedTime: s.loss_detected_time,
                    localizedBy: s.localized_by, rackLocation: s.rack_location
                }));
                setStockItems(mapped);
                setPossibleLossItems(mapped.filter((s: StockItem) => s.status?.toLowerCase() === 'possível perda'));

                // Dashboard stats with accurate stock count
                const stockCount = mapped.filter((s: StockItem) => s.status?.toLowerCase() === 'em estoque').length;
                if (dbStats) {
                    setDashboardStats({ ...dbStats, total_em_estoque: stockCount } as DashboardStats);
                } else {
                    setDashboardStats({
                        total_em_estoque: stockCount,
                        entradas_hoje: 0, saidas_hoje: 0, reversas_hoje: 0,
                        parados_24h: 0, possiveis_perdas: 0, total_perdas: 0
                    });
                }
            }

            // ── Weekly Stats (from v_weekly_stats view) ─────
            if (weekE) console.error('WmsDataContext: Weekly stats error:', weekE);
            else if (weeklyData) setWeeklyStatsFromView(weeklyData);

            // ── Inbound (Today — already date-filtered by fetchAppData) ──
            if (tie) console.error('WmsDataContext: Inbound error:', tie);
            else if (allInbound) {
                setInboundItems(allInbound.map((i: any) => ({
                    id: i.tbr_id || i.id, status: i.status || 'Sucesso', operator: i.operator,
                    time: formatToLocalTime(i.created_at || i.time), error: i.error || false, createdAt: i.created_at
                })));
            }

            // ── Outbound (Today) ────────────────────────────
            if (toeError) console.error('WmsDataContext: Outbound error:', toeError);
            else {
                // Normal outbound items
                const normalItems = (toeNormal as any[] || []).map((i: any) => ({
                    id: i.tbr_id || i.id, driverName: i.driver_name, vehicle: i.vehicle,
                    time: formatToLocalTime(i.created_at || i.time), operator: i.operator, status: i.status,
                    palletId: i.pallet_id, createdAt: i.created_at
                }));
                // Reversa outbound items
                const reversaItems = (toeReversa as any[] || []).map((i: any) => ({
                    id: i.tbr_id || i.id, driverName: i.driver_name, vehicle: i.vehicle,
                    time: formatToLocalTime(i.created_at || i.time), operator: i.operator, status: i.status,
                    palletId: i.pallet_id, createdAt: i.created_at
                }));
                setOutboundItems([...normalItems, ...reversaItems]);

                if (!treError) {
                    setTodayReversaCount(reversaItems.length);
                }
            }

            // ── Incidents / Treatments ──────────────────────
            if (incE) console.error('WmsDataContext: Incidents error:', incE);
            else if (allIncidents) {
                setTreatmentItems(allIncidents.map((inc: any) => ({
                    id: inc.id, tbrId: inc.tbr_id, type: inc.type,
                    description: inc.description, operator: inc.operator,
                    time: inc.time, status: inc.status
                })));
            }

            console.log('WmsDataContext: Initial data loaded successfully.');

        } catch (err) {
            console.error('WmsDataContext: Unexpected error in loadInitialData:', err);
        }
    }, [currentUser, applyFilter]);

    // ═══════════════════════════════════════════════════════
    // AUTO-LOAD on user change
    // ═══════════════════════════════════════════════════════

    useEffect(() => {
        if (currentUser) loadInitialData();
    }, [currentUser, loadInitialData]);

    // ═══════════════════════════════════════════════════════
    // REALTIME LISTENERS
    // ═══════════════════════════════════════════════════════

    useEffect(() => {
        if (!currentUser) return;

        const companyId = currentUser.company_id;

        const channel = supabase.channel('wms_data_realtime')
            .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
                console.log(`WmsDataContext: Realtime [${payload.table}] ${payload.eventType}`);

                // ── inbound_log ─────────────────────────────
                if (payload.table === 'inbound_log') {
                    if (payload.eventType === 'INSERT') {
                        const n = payload.new as any;
                        setInboundItems(prev => [{
                            id: n.id, status: n.status || 'Sucesso', operator: n.operator,
                            time: n.time, error: n.error || false, createdAt: n.created_at
                        }, ...prev]);
                    } else if (payload.eventType === 'DELETE') {
                        setInboundItems(prev => prev.filter(i => i.id !== payload.old.id));
                    }

                    // ── outbound_log ────────────────────────────
                } else if (payload.table === 'outbound_log') {
                    if (payload.eventType === 'INSERT') {
                        const n = payload.new as any;
                        const item: OutboundItem = {
                            id: n.id, driverName: n.driver_name, vehicle: n.vehicle,
                            time: n.time, operator: n.operator, status: n.status,
                            palletId: n.pallet_id, createdAt: n.created_at
                        };
                        setOutboundItems(prev => [item, ...prev]);
                        if (n.status?.toLowerCase().includes('reversa')) {
                            setTodayReversaCount(prev => prev + 1);
                        }
                    } else if (payload.eventType === 'DELETE') {
                        setOutboundItems(prev => prev.filter(i => i.id !== payload.old.id));
                    }

                    // ── inventory_log ───────────────────────────
                } else if (payload.table === 'inventory_log' || payload.table === 'inventory') {
                    if (payload.eventType === 'INSERT') {
                        const n = payload.new as any;
                        setInventoryItems(prev => [{
                            id: n.id, time: n.time, operator: n.operator, createdAt: n.created_at
                        }, ...prev]);
                    } else if (payload.eventType === 'DELETE') {
                        setInventoryItems(prev => prev.filter(i => i.id !== payload.old.id));
                    }

                    // ── rts_log ─────────────────────────────────
                } else if (payload.table === 'rts_log') {
                    if (payload.eventType === 'INSERT') {
                        const n = payload.new as any;
                        setRtsLogs(prev => [n, ...prev]);
                    } else if (payload.eventType === 'DELETE') {
                        setRtsLogs(prev => prev.filter(i => i.id !== payload.old.id));
                    }

                    // ── stock_items ─────────────────────────────
                } else if (payload.table === 'stock_items') {
                    if (payload.eventType === 'INSERT') {
                        const n = payload.new as any;
                        setStockItems(prev => [...prev, {
                            id: n.id, entryTime: n.entry_time, operator: n.operator,
                            status: n.status, lossDetectedTime: n.loss_detected_time,
                            localizedBy: n.localized_by, rackLocation: n.rack_location
                        }]);
                    } else if (payload.eventType === 'UPDATE') {
                        const u = payload.new as any;
                        setStockItems(prev => prev.map(s => s.id === u.id ? {
                            ...s, status: u.status, lossDetectedTime: u.loss_detected_time,
                            localizedBy: u.localized_by, rackLocation: u.rack_location
                        } : s));
                    } else if (payload.eventType === 'DELETE') {
                        setStockItems(prev => prev.filter(s => s.id !== payload.old.id));
                    }

                    // ── expeditions ──────────────────────────────
                } else if (payload.table === 'expeditions') {
                    const { data } = await applyFilter(
                        supabase.from('expeditions').select('*')
                    ).order('dispatch_date', { ascending: false });
                    if (data) {
                        setExpeditions(data.map((e: any) => ({
                            id: e.id, driver_name: e.driver_name, plate: e.plate,
                            dispatch_date: e.dispatch_date, total_packages: e.total_packages,
                            delivered_count: e.delivered_count, returned_count: e.returned_count,
                            status: e.status
                        })));
                    }

                    // ── incidents ────────────────────────────────
                } else if (payload.table === 'incidents') {
                    if (payload.eventType === 'INSERT') {
                        const n = payload.new as any;
                        setTreatmentItems(prev => [{
                            id: n.id, tbrId: n.tbr_id, type: n.type,
                            description: n.description, operator: n.operator,
                            time: n.time, status: n.status
                        }, ...prev]);
                    } else if (payload.eventType === 'UPDATE') {
                        const u = payload.new as any;
                        setTreatmentItems(prev => prev.map(t => t.id === u.id ? { ...t, status: u.status } : t));
                    }

                    // ── users ────────────────────────────────────
                } else if (payload.table === 'users') {
                    const u = payload.new as any;
                    if (payload.eventType === 'INSERT') setUsers(prev => [u as User, ...prev]);
                    else if (payload.eventType === 'UPDATE') setUsers(prev => prev.map(x => x.id === u.id ? (u as User) : x));
                    else if (payload.eventType === 'DELETE') setUsers(prev => prev.filter(x => x.id !== payload.old.id));

                    // ── drivers ──────────────────────────────────
                } else if (payload.table === 'drivers') {
                    const d = payload.new as any;
                    const mapped = {
                        id: d.id, name: d.name, cpf: d.cpf, plate: d.plate,
                        company: d.company, status: d.status,
                        vehicleProfile: d.vehicle_profile, lastActivity: d.last_activity
                    };
                    if (payload.eventType === 'INSERT') setDrivers(prev => [...prev, mapped as Driver]);
                    else if (payload.eventType === 'UPDATE') setDrivers(prev => prev.map(x => x.id === d.id ? mapped as Driver : x));
                }
            })
            .subscribe();

        // System Control Channel (cross-tab broadcast)
        const controlChannel = supabase.channel('system_control')
            .on('broadcast', { event: 'FORCE_REFRESH' }, (payload) => {
                const { company_id, sender } = payload.payload;
                if (company_id === companyId && sender !== currentUser.id) {
                    console.log('WmsDataContext: Received FORCE_REFRESH from another session.');
                    loadInitialData();
                }
            })
            .subscribe();

        // Safety net: full reload every 5 minutes
        const safetyInterval = setInterval(loadInitialData, 5 * 60 * 1000);

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(controlChannel);
            clearInterval(safetyInterval);
        };
    }, [currentUser, applyFilter, loadInitialData]);

    // ═══════════════════════════════════════════════════════
    // BROADCAST REFRESH
    // ═══════════════════════════════════════════════════════

    const broadcastRefresh = useCallback(async () => {
        if (!currentUser) return;
        const channel = supabase.channel('system_control');
        await channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'FORCE_REFRESH',
                    payload: { company_id: currentUser.company_id, sender: currentUser.id }
                });
                supabase.removeChannel(channel);
            }
        });
    }, [currentUser]);

    // ═══════════════════════════════════════════════════════
    // PROVIDER VALUE
    // ═══════════════════════════════════════════════════════

    const value: WmsDataContextValue = {
        // Read-only data
        inboundItems, outboundItems, inventoryItems, rtsLogs,
        stockItems, possibleLossItems, drivers, treatmentItems,
        expeditions, rtsItems, users, expectedInboundList,
        dashboardStats, weeklyStatsFromView, todayReversaCount,

        // Setters (for CRUD in orchestrator)
        setInboundItems, setOutboundItems, setInventoryItems, setRtsLogs,
        setStockItems, setPossibleLossItems, setDrivers, setTreatmentItems,
        setExpeditions, setRtsItems, setUsers, setExpectedInboundList,
        setDashboardStats, setWeeklyStatsFromView, setTodayReversaCount,

        // Actions
        loadInitialData,
        broadcastRefresh
    };

    return (
        <WmsDataContext.Provider value={value}>
            {children}
        </WmsDataContext.Provider>
    );
};
