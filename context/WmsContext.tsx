import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Driver, Role, UserStatus, VehicleProfile, View } from '../types';
import { AuthService } from '../services/authService';
import { gamificationService } from '../services/gamificationService';
import { supabase } from '../services/supabase';
import { isSameDay, parseToDate, getDateKey, getSaoPauloDate, getTodayDate, getSaoPauloIso, formatToLocalTime } from '../utils/dateUtils';
import { isValidTbr } from '../utils/validation';

interface InboundItem {
    id: string;
    status: 'Sucesso' | 'Prefixo Inválido' | 'Duplicado' | 'Perda Definitiva';
    operator: string;
    time: string;
    error: boolean;
    createdAt?: string;
}

interface OutboundItem {
    id: string;
    driverName: string;
    vehicle: string;
    time: string;
    operator: string;
    status: 'Saiu com Motorista' | 'Reversa - Saiu com Motorista';
    palletId?: string;
    createdAt?: string;
}

interface InventoryItem {
    id: string;
    time: string;
    operator: string;
    createdAt?: string;
}

interface StockItem {
    id: string;
    entryTime: string;
    operator: string;
    status: 'Em Estoque' | 'Saiu' | 'Possível Perda' | 'Perda';
    lossDetectedTime?: string; // ISO string when it was marked as missing
    localizedBy?: string;      // Who found it
}

interface TreatmentItem {
    id: string; // Incident unique ID
    tbrId: string;
    type: 'Avaria' | 'Extravio' | 'Erro de Sistema' | 'Outros';
    description: string;
    status: 'Pendente' | 'Em Análise' | 'Resolvido';
    operator: string;
    time: string;
}

interface ExpeditionItem {
    id: string;
    driver_name: string;
    plate: string;
    dispatch_date: string;
    total_packages: number;
    delivered_count: number;
    returned_count: number;
    status: 'EM_ROTA' | 'AGUARDANDO_RETORNO' | 'FINALIZADO';
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

// UserItem agora é apenas User vindo de types.ts
// Removida interface UserItem legada

interface WmsContextData {
    // Inbound
    inboundItems: InboundItem[];
    addInboundItem: (item: InboundItem) => Promise<void>;
    expectedInboundList: string[];
    setExpectedInboundList: (list: string[]) => Promise<void>;
    clearInboundManifest: () => Promise<void>;
    // Outbound
    outboundItems: OutboundItem[];
    addOutboundItem: (item: OutboundItem) => Promise<{ success: boolean; message?: string }>;
    bulkAddOutboundItems: (items: OutboundItem[]) => Promise<{ success: boolean; message?: string }>;
    deleteOutboundItem: (id: string) => Promise<void>;

    // Inventory
    inventoryItems: InventoryItem[];
    stockItems: StockItem[];
    possibleLossItems: StockItem[];
    staleStockItems: StockItem[]; // +24h items list
    addInventoryItem: (item: InventoryItem) => Promise<void>;
    isInventoryActive: boolean;
    setIsInventoryActive: (active: boolean) => void;
    startInventory: () => Promise<void>;
    stopInventory: () => Promise<void>;
    localizeItem: (id: string, scannerInput: string) => Promise<{ success: boolean; message: string }>;

    // Treatments
    treatmentItems: TreatmentItem[];
    addTreatment: (item: Omit<TreatmentItem, 'id' | 'time' | 'status'>) => Promise<{ success: boolean; message: string }>;
    updateTreatmentStatus: (id: string, status: TreatmentItem['status']) => Promise<void>;
    updateTreatment: (id: string, updates: Partial<Pick<TreatmentItem, 'type' | 'description'>>) => Promise<void>;

    // Auth & Users
    currentUser: User | null;
    login: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: () => Promise<void>;
    register: (name: string, email: string, password: string, company_id: string, customId?: string) => Promise<{ success: boolean; message: string }>;

    // Navigation
    currentView: View;
    setCurrentView: (view: View) => void;

    // Admin User Management
    users: User[]; // List of all users for admin
    refreshUsers: () => Promise<void>; // Reload users from service
    updateUserStatus: (id: string, status: UserStatus, role?: Role | null) => Promise<void>;
    updateUser: (originalId: string, updates: Partial<User>) => Promise<{ success: boolean; message: string }>;
    deleteUser: (id: string) => Promise<void>;
    inviteUser: (email: string) => Promise<{ success: boolean; message: string }>;
    updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;

    // Driver Management
    drivers: Driver[];
    addDriver: (driver: Omit<Driver, 'id' | 'lastActivity'>) => Promise<void>;
    bulkAddDrivers: (drivers: Omit<Driver, 'id' | 'lastActivity'>[]) => Promise<void>;
    updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
    deleteDriver: (id: string) => Promise<void>;
    // activeDriversCount handled in Stats section for centralization

    // RTS Management
    expeditions: ExpeditionItem[];
    updateExpeditionDelivered: (id: string, delivered: number) => Promise<void>;
    verifyReturn: (tbrId: string, driverName: string) => Promise<{ success: boolean; message: string }>;

    // Stats
    adminResetPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
    totalInboundToday: number;
    totalOutboundToday: number;
    totalReversaToday: number;
    todayInboundList: InboundItem[];
    todayOutboundList: OutboundItem[];
    inboundReconciliation: {
        matches: string[];
        missing: string[];
        unexpected: string[];
        progressPercent: number;
        successfulScansToday: string[];
    };
    activeDriversCount: number;
    availableStockCount: number;
    totalInventoryScanned: number;
    totalLossItems: number;
    staleItemsCount: number; // +24h items
    totalExpected: number;
    totalPossibleLosses: number;
    weeklyStats: { name: string; entradas: number; saidas: number; entregues: number; rts: number }[];
    resetTransactions: () => Promise<void>;

    // Helpers
    verifyStock: (id: string) => Promise<{ success: boolean; message: string }>;
    isValidTbr: (id: string) => { isValid: boolean; message?: string };
    isSameDay: (dateStr: string) => boolean;
    getLocalDateIso: () => string;

    // Audio
    playAudio: (type: 'success' | 'error') => void;
    refreshProfile: () => Promise<void>;
    uploadUserAvatar: (file: File) => Promise<{ success: boolean; message: string }>;
    syncDetailedLogs: (module: 'stock' | 'inbound' | 'outbound' | 'treatments') => Promise<void>;
    // Novo helper para alto volume: busca contagem de saídas de um motorista hoje
    fetchDriverTodayCount: (driverId: string) => Promise<number>;
}

const WmsContext = createContext<WmsContextData>({} as WmsContextData);

export const WmsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    // ... (Audio System - keep as is) ...
    const playAudio = (type: 'success' | 'error') => {
        try {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioContext) return;

            const ctx = new AudioContext();
            const oscillator = ctx.createOscillator();
            const gainNode = ctx.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(ctx.destination);

            if (type === 'success') {
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(800, ctx.currentTime);
                oscillator.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
                gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.15);
            } else {
                oscillator.type = 'sawtooth';
                oscillator.frequency.setValueAtTime(150, ctx.currentTime);
                oscillator.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
                gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
                gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                oscillator.start();
                oscillator.stop(ctx.currentTime + 0.25);
            }
        } catch (e) {
            console.error("Audio play failed", e);
        }
    };

    // ... (Stock, Inbound, Outbound, Inventory Logic - KEEP AS IS) ...
    // To save context space, I will re-implement the state logic briefly but robustly using previous implementation reference.

    // --- Navigation State ---
    const [currentView, _setCurrentView] = useState<View>(() => {
        const saved = localStorage.getItem('wms_active_view') as View;
        if (saved && saved !== View.LOGIN && Object.values(View).includes(saved)) {
            return saved;
        }
        return View.DASHBOARD;
    });

    const setCurrentView = (view: View) => {
        _setCurrentView(view);
        if (view !== View.LOGIN) {
            localStorage.setItem('wms_active_view', view);
        }
    };

    // --- Auth & User Management State ---
    const [currentUser, setCurrentUser] = useState<User | null>(AuthService.getCurrentUser());
    const [users, setUsers] = useState<User[]>([]);

    const refreshProfile = async () => {
        const stored = AuthService.getCurrentUser();
        if (stored) {
            const { data: fresh, error } = await supabase
                .from('users')
                .select('*')
                .eq('id', stored.id)
                .maybeSingle();

            if (fresh) {
                const user = fresh as User;
                setCurrentUser(user);
                AuthService.saveSession(user);
            }
        } else {
            _setCurrentView(View.LOGIN);
        }
    };

    // Force profile refresh from DB to ensure correct company_id and role
    useEffect(() => {
        refreshProfile();
    }, []);

    // --- Initial Sync ---
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [possibleLossItems, setPossibleLossItems] = useState<StockItem[]>([]);

    // --- Inbound State ---
    const [inboundItems, setInboundItems] = useState<InboundItem[]>([]);
    const [expectedInboundList, _setExpectedInboundList] = useState<string[]>([]);

    // --- Outbound State ---
    const [outboundItems, setOutboundItems] = useState<OutboundItem[]>([]);
    const [todayOutboundCount, setTodayOutboundCount] = useState(0);
    const [todayReversaCount, setTodayReversaCount] = useState(0);

    // --- Inventory State ---
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

    // --- Drivers State ---
    const [drivers, setDrivers] = useState<Driver[]>([]);

    // --- Treatments State ---
    const [treatmentItems, setTreatmentItems] = useState<TreatmentItem[]>([]);

    // --- RTS State ---
    const [expeditions, setExpeditions] = useState<ExpeditionItem[]>([]);

    // --- Optimized Stats State ---
    const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
    const [weeklyStatsFromView, setWeeklyStatsFromView] = useState<any[]>([]);

    // --- Local Storage Keys ---
    const STORAGE_KEYS = {
        CONFIG: 'wms_system_config',
        ACTIVE_VIEW: 'wms_active_view',
        STOCK: 'wms_stock',
        INVENTORY_LOG: 'wms_inventory_log'
    };

    const staleStockItems = React.useMemo(() => stockItems.filter(item => {
        if (item.status?.toLowerCase() !== 'em estoque' || !item.entryTime) return false;
        return !isSameDay(item.entryTime);
    }), [stockItems]);

    // --- Helper for Local Persistence ---
    const saveLocal = (key: string, data: any) => {
        localStorage.setItem(key, JSON.stringify(data));
    };

    const loadLocal = (key: string, defaultValue: any = []) => {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    };

    // --- Synchronization (Cross-tab) ---
    useEffect(() => {
        const handleStorageChange = (e: StorageEvent) => {
            if (!currentUser) return;
            if (Object.values(STORAGE_KEYS).includes(e.key as string)) {
                console.log('WmsContext: Syncing data from another tab', e.key);
                loadInitialData();
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [currentUser]);

    const loadInitialData = async () => {
        if (!currentUser) {
            console.log('WmsContext: Skipping loadInitialData - no currentUser');
            return;
        }

        try {
            const companyId = currentUser.company_id;
            const userRole = (currentUser.role || '').toLowerCase();
            const isAdmin = userRole === 'superadmin' || userRole === 'admin';

            console.log(`WmsContext: Fetching users. Role: ${userRole}, Company: "${companyId}"`);

            // Fetch users with resilience
            let { data: userData, error: userError } = await (
                userRole === 'superadmin'
                    ? supabase.from('users').select('*').order('name', { ascending: true })
                    : supabase.from('users').select('*').eq('company_id', companyId).order('name', { ascending: true })
            );

            // Resilience check: Fallback fetch if empty for admins
            if (!userError && (!userData || userData.length === 0) && isAdmin) {
                console.log('WmsContext: Users empty, trying fallback fetch...');
                const { data: fallback } = await supabase.from('users').select('*').limit(100);
                if (fallback && fallback.length > 0) userData = fallback;
            }

            if (userError) {
                console.error('WmsContext: User fetch error:', userError);
            } else if (userData) {
                console.log(`WmsContext: Loaded ${userData.length} users.`);
                setUsers(userData as User[]);
            }

            const [
                { data: driversData, error: de },
                { data: config, error: confE },
                { data: inventory, error: invE },
                { data: expData, error: expE },
                { data: dbStats, error: statsE },
                { data: weeklyData, error: weekE },
                { data: allInbound, error: tie },
                { data: allOutbound, error: toe },
                { data: allStock, error: sce },
                { data: allIncidents, error: incE }
            ] = await Promise.all([
                supabase.from('drivers').select('*').eq('company_id', companyId),
                supabase.from('system_configs').select('expected_inbound').eq('company_id', companyId).maybeSingle(),
                supabase.from('inventory_log').select('*').eq('company_id', companyId),
                supabase.from('expeditions').select('*').eq('company_id', companyId).order('dispatch_date', { ascending: false }),
                supabase.from('v_dashboard_stats').select('*').eq('company_id', companyId).maybeSingle(),
                supabase.from('mv_weekly_movement').select('*').eq('company_id', companyId).order('day_date', { ascending: true }),
                supabase.from('inbound_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100),
                // OTIMIZAÇÃO: Busca apenas contagem agregada de saídas de hoje para evitar lentidão
                supabase.from('outbound_log').select('id', { count: 'exact', head: true })
                    .eq('company_id', companyId)
                    .gte('created_at', getSaoPauloDate() + 'T00:00:00')
                    .lte('created_at', getSaoPauloDate() + 'T23:59:59'),
                supabase.from('stock_items').select('*').eq('company_id', companyId),
                supabase.from('incidents').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50)
            ]);

            console.log('WmsContext: Operational data loaded.');

            // Gerenciar Motoristas
            if (de) console.error('WmsContext: Drivers fetch error:', de);
            else if (driversData) {
                const mappedDrivers = driversData.map(d => ({
                    id: d.id,
                    name: d.name,
                    cpf: d.cpf,
                    plate: d.plate,
                    company: d.company,
                    status: d.status,
                    vehicleProfile: d.vehicle_profile,
                    lastActivity: d.last_activity
                }));
                setDrivers(mappedDrivers);
            }

            // Gerenciar Inventário
            if (invE) console.error('WmsContext: Inventory fetch error:', invE);
            else if (inventory) {
                const mappedInventory = inventory.map(i => ({
                    id: i.id,
                    time: i.time,
                    operator: i.operator,
                    createdAt: i.created_at
                }));
                setInventoryItems(mappedInventory);
            }

            // Gerenciar Configurações
            if (confE) console.error('WmsContext: Config fetch error:', confE);
            else if (config?.expected_inbound) _setExpectedInboundList(config.expected_inbound);

            // Gerenciar Expedições (RTS)
            if (expE) console.error('WmsContext: Expeditions fetch error:', expE);
            else if (expData) {
                setExpeditions(expData.map(e => ({
                    id: e.id,
                    driver_name: e.driver_name,
                    plate: e.plate,
                    dispatch_date: e.dispatch_date,
                    total_packages: e.total_packages,
                    delivered_count: e.delivered_count,
                    returned_count: e.returned_count,
                    status: e.status
                })));
            }

            // Gerenciar Itens de Estoque
            if (sce) console.error('WmsContext: Stock items fetch error:', sce);
            else if (allStock) {
                const mapped = allStock.map((s: any) => ({
                    id: s.id,
                    entryTime: s.entry_time,
                    operator: s.operator,
                    status: s.status,
                    lossDetectedTime: s.loss_detected_time,
                    localizedBy: s.localized_by,
                    rackLocation: s.rack_location
                }));
                setStockItems(mapped);
                setPossibleLossItems(mapped.filter((s: any) => s.status?.toLowerCase() === 'possível perda'));

                // Gerenciar fallback das estatísticas do dashboard com contagem real
                const stockCount = mapped.filter((s: any) => s.status?.toLowerCase() === 'em estoque').length;
                if (dbStats) {
                    const updatedStats = {
                        ...dbStats,
                        total_em_estoque: stockCount
                    };
                    setDashboardStats(updatedStats as DashboardStats);
                } else {
                    setDashboardStats({
                        total_em_estoque: stockCount,
                        entradas_hoje: 0,
                        saidas_hoje: 0,
                        reversas_hoje: 0,
                        parados_24h: 0,
                        possiveis_perdas: 0,
                        total_perdas: 0
                    } as DashboardStats);
                }
            }

            // Gerenciar Estatísticas Semanais
            if (weekE) console.error('WmsContext: Weekly stats fetch error:', weekE);
            else if (weeklyData) setWeeklyStatsFromView(weeklyData);

            // Gerenciar logs de Entrada
            if (tie) console.error('WmsContext: Inbound fetch error:', tie);
            else if (allInbound) {
                setInboundItems(allInbound.map((i: any) => ({
                    id: i.id,
                    status: i.status || 'Sucesso',
                    operator: i.operator,
                    time: i.time,
                    error: i.error || false,
                    createdAt: i.created_at
                })));
            }

            // Handle Outbound logs (OTIMIZADO: Agora usamos apenas o count para o dashboard)
            if (toe) console.error('WmsContext: Outbound count error:', toe);
            else {
                const totalCount = (toe as any).count || 0;
                // Como não estamos carregando a lista completa por performance, 
                // inicializamos o estado com uma lista vazia ou os últimos registros se necessário.
                // Para o Dashboard, usamos o total_saidas do v_dashboard_stats ou este count.
                setOutboundItems([]);
            }

            // Gerenciar Incidentes
            if (incE) console.error('WmsContext: Incidents fetch error:', incE);
            else if (allIncidents) {
                setTreatmentItems(allIncidents.map((inc: any) => ({
                    id: inc.id,
                    tbrId: inc.tbr_id,
                    type: inc.type,
                    description: inc.description,
                    operator: inc.operator,
                    time: inc.time,
                    status: inc.status
                })));
            }

            // Inicializar Gamificação
            await gamificationService.init(companyId);

        } catch (err) {
            console.error('WmsContext: Unexpected error in loadInitialData:', err);
        }
    };

    /**
     * Efficiently syncs detailed logs for specific modules on-demand.
     * This avoids loading thousands of rows on app startup.
     */
    const syncDetailedLogs = async (module: 'stock' | 'inbound' | 'outbound' | 'treatments') => {
        // This is kept for manual refresh or realtime backup, but mostly optimized away
        await loadInitialData();
    };

    // Navegação Zero-Loading: Removido syncDetailedLogs do efeito de mudança de view
    React.useEffect(() => {
        if (!currentUser) return;
        // Navigation is now handled by pure state access
    }, [currentView, currentUser]);

    // --- Realtime Implementation ---
    useEffect(() => {
        if (!currentUser) return;

        const companyId = currentUser.company_id;

        const channels = [
            supabase.channel('wms_realtime_all')
                .on('postgres_changes', { event: '*', schema: 'public' }, async (payload) => {
                    console.log('WmsContext: Realtime event received:', payload.table, payload.eventType);

                    // Update specific logs incrementally
                    if (payload.table === 'inbound_log') {
                        if (payload.eventType === 'INSERT') {
                            const newItem = payload.new as any;
                            setInboundItems(prev => [{
                                id: newItem.id,
                                status: newItem.status || 'Sucesso',
                                operator: newItem.operator,
                                time: newItem.time,
                                error: newItem.error || false,
                                createdAt: newItem.created_at
                            }, ...prev]);
                        } else if (payload.eventType === 'DELETE') {
                            setInboundItems(prev => prev.filter(i => i.id !== payload.old.id));
                        }
                    } else if (payload.table === 'outbound_log') {
                        if (payload.eventType === 'INSERT') {
                            const newItem = payload.new as any;
                            // OTIMIZAÇÃO: Incrementar contadores em tempo real em vez de gerenciar arrays massivos
                            if (newItem.status?.toLowerCase().includes('reversa')) {
                                setTodayReversaCount(prev => prev + 1);
                            } else {
                                setTodayOutboundCount(prev => prev + 1);
                            }
                        } else if (payload.eventType === 'DELETE') {
                            // Decrementar contadores se necessário (embora deleções sejam raras em alto volume)
                            const oldItem = payload.old as any;
                            if (oldItem.status?.toLowerCase().includes('reversa')) {
                                setTodayReversaCount(prev => Math.max(0, prev - 1));
                            } else {
                                setTodayOutboundCount(prev => Math.max(0, prev - 1));
                            }
                        }
                    } else if (payload.table === 'stock_items') {
                        if (payload.eventType === 'INSERT') {
                            const newItem = payload.new as any;
                            const mapped = {
                                id: newItem.id,
                                entryTime: newItem.entry_time,
                                operator: newItem.operator,
                                status: newItem.status,
                                lossDetectedTime: newItem.loss_detected_time,
                                localizedBy: newItem.localized_by,
                                rackLocation: newItem.rack_location
                            };
                            setStockItems(prev => [...prev, mapped]);
                        } else if (payload.eventType === 'UPDATE') {
                            const updated = payload.new as any;
                            setStockItems(prev => prev.map(s => s.id === updated.id ? {
                                ...s,
                                status: updated.status,
                                lossDetectedTime: updated.loss_detected_time,
                                localizedBy: updated.localized_by,
                                rackLocation: updated.rack_location
                            } : s));
                        } else if (payload.eventType === 'DELETE') {
                            setStockItems(prev => prev.filter(s => s.id !== payload.old.id));
                        }
                    } else if (payload.table === 'incidents') {
                        if (payload.eventType === 'INSERT') {
                            const newItem = payload.new as any;
                            setTreatmentItems(prev => [{
                                id: newItem.id,
                                tbrId: newItem.tbr_id,
                                type: newItem.type,
                                description: newItem.description,
                                operator: newItem.operator,
                                time: newItem.time,
                                status: newItem.status
                            }, ...prev]);
                        } else if (payload.eventType === 'UPDATE') {
                            const updated = payload.new as any;
                            setTreatmentItems(prev => prev.map(t => t.id === updated.id ? { ...t, status: updated.status } : t));
                        }
                    } else if (payload.table === 'users') {
                        // Keep user list synced for UserManagementView
                        const updated = payload.new as any;
                        if (payload.eventType === 'INSERT') {
                            setUsers(prev => [updated as User, ...prev]);
                        } else if (payload.eventType === 'UPDATE') {
                            setUsers(prev => prev.map(u => u.id === updated.id ? (updated as User) : u));
                        } else if (payload.eventType === 'DELETE') {
                            setUsers(prev => prev.filter(u => u.id !== payload.old.id));
                        }
                    } else if (payload.table === 'drivers') {
                        const updated = payload.new as any;
                        if (payload.eventType === 'INSERT') {
                            setDrivers(prev => [...prev, {
                                id: updated.id,
                                name: updated.name,
                                cpf: updated.cpf,
                                plate: updated.plate,
                                company: updated.company,
                                status: updated.status,
                                vehicleProfile: updated.vehicle_profile,
                                lastActivity: updated.last_activity
                            }]);
                        } else if (payload.eventType === 'UPDATE') {
                            setDrivers(prev => prev.map(d => d.id === updated.id ? {
                                id: updated.id,
                                name: updated.name,
                                cpf: updated.cpf,
                                plate: updated.plate,
                                company: updated.company,
                                status: updated.status,
                                vehicleProfile: updated.vehicle_profile,
                                lastActivity: updated.last_activity
                            } : d));
                        }
                    } else if (payload.table === 'expeditions') {
                        const updated = payload.new as any;
                        if (payload.eventType === 'INSERT') {
                            setExpeditions(prev => [{
                                id: updated.id,
                                driver_name: updated.driver_name,
                                plate: updated.plate,
                                dispatch_date: updated.dispatch_date,
                                total_packages: updated.total_packages,
                                delivered_count: updated.delivered_count,
                                returned_count: updated.returned_count,
                                status: updated.status
                            }, ...prev]);
                        } else if (payload.eventType === 'UPDATE') {
                            setExpeditions(prev => prev.map(e => e.id === updated.id ? {
                                id: updated.id,
                                driver_name: updated.driver_name,
                                plate: updated.plate,
                                dispatch_date: updated.dispatch_date,
                                total_packages: updated.total_packages,
                                delivered_count: updated.delivered_count,
                                returned_count: updated.returned_count,
                                status: updated.status
                            } : e));
                        } else if (payload.eventType === 'DELETE') {
                            setExpeditions(prev => prev.filter(e => e.id !== payload.old.id));
                        }
                    }

                    // Refresh Dashboard Views (they are complex aggregations)
                    const { data: dbStats } = await supabase.from('v_dashboard_stats').select('*').eq('company_id', companyId).maybeSingle();
                    const { data: weeklyData } = await supabase.from('mv_weekly_movement').select('*').eq('company_id', companyId).order('day_date', { ascending: true });

                    if (dbStats) {
                        // Patch stock items count from our local state for absolute accuracy
                        setDashboardStats(prev => ({
                            ...(dbStats as DashboardStats),
                            total_em_estoque: stockItems.filter(s => s.status?.toLowerCase() === 'em estoque').length
                        }));
                    }
                    if (weeklyData) setWeeklyStatsFromView(weeklyData);
                })
                .subscribe((status) => {
                    console.log('WmsContext: Realtime subscription status:', status);
                })
        ];

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel));
        };
    }, [currentUser]);

    const statsSummary = React.useMemo(() => {
        const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

        // Map weekly stats from view
        let weeklyStats = (weeklyStatsFromView || []).map(d => {
            const date = parseToDate(d.day_date);
            const dayLabel = dayNames[date.getDay()];
            return {
                name: dayLabel,
                entradas: d.entradas,
                saidas: d.saidas,
                entregues: d.entregues,
                rts: d.rts,
                rawDate: d.day_date
            };
        });

        // Local calculation for "Today" counts to avoid DB timezone issues
        const localInboundToday = inboundItems.filter(item => isSameDay(item.time || (item as any).created_at)).length;

        // OTIMIZADO: Usamos os estados de contagem explícitos em vez de filtrar arrays
        const localOutboundToday = todayOutboundCount;
        const localReversaToday = todayReversaCount;

        const localEntreguesToday = (expeditions || [])
            .filter(e => isSameDay(e.dispatch_date))
            .reduce((sum, e) => sum + (e.delivered_count || 0), 0);

        // Atualizar o dia atual nas estatísticas semanais com contagens locais se forem maiores
        const todayLabel = dayNames[getTodayDate().getDay()];
        const todayKey = getSaoPauloDate();

        let foundToday = false;
        weeklyStats = weeklyStats.map(d => {
            if (d.name === todayLabel || d.rawDate === todayKey) {
                foundToday = true;
                return {
                    ...d,
                    entradas: Math.max(d.entradas, localInboundToday),
                    saidas: Math.max(d.saidas, localOutboundToday),
                    entregues: Math.max(d.entregues || 0, localEntreguesToday),
                    rts: Math.max(d.rts, localReversaToday)
                };
            }
            return d;
        });

        // Se hoje não estiver na lista (ex: banco vazio), adiciona-o
        if (!foundToday && (localInboundToday > 0 || localOutboundToday > 0 || localEntreguesToday > 0)) {
            weeklyStats.push({
                name: todayLabel,
                entradas: localInboundToday,
                saidas: localOutboundToday,
                entregues: localEntreguesToday,
                rts: localReversaToday,
                rawDate: todayKey
            });
            // Mantém apenas os últimos 7 dias
            if (weeklyStats.length > 7) weeklyStats.shift();
        }

        return {
            weeklyStats,
            totalInboundToday: localInboundToday || dashboardStats?.entradas_hoje || 0,
            totalOutboundToday: localOutboundToday || dashboardStats?.saidas_hoje || 0,
            totalReversaToday: localReversaToday || dashboardStats?.reversas_hoje || 0,
            totalLossItems: stockItems.filter(s => s.status?.toLowerCase() === 'perda').length || dashboardStats?.total_perdas || 0,
            staleItemsCount: staleStockItems.length || dashboardStats?.parados_24h || 0,
            totalPossibleLosses: possibleLossItems.length || dashboardStats?.possiveis_perdas || 0
        };
    }, [dashboardStats, weeklyStatsFromView, inboundItems, expeditions, stockItems, staleStockItems, possibleLossItems, todayOutboundCount, todayReversaCount]);

    // --- Optimized Centralized Data (Zero-Loading) ---
    const todayInboundList = React.useMemo(() =>
        inboundItems.filter(item => isSameDay(item.time || (item as any).created_at)),
        [inboundItems]);

    const todayOutboundList = React.useMemo(() =>
        outboundItems.filter(item => isSameDay(item.time || (item as any).createdAt || (item as any).created_at)),
        [outboundItems]);

    const inboundReconciliation = React.useMemo(() => {
        const successfulScansToday = Array.from(new Set(
            todayInboundList.filter(item => !item.error).map(item => item.id)
        ));
        const matches = expectedInboundList.filter(id => successfulScansToday.includes(id));
        const missing = expectedInboundList.filter(id => !successfulScansToday.includes(id));
        const unexpected = successfulScansToday.filter(id => !expectedInboundList.includes(id));
        const progressPercent = expectedInboundList.length > 0
            ? Math.round((matches.length / expectedInboundList.length) * 100)
            : 0;

        return { matches, missing, unexpected, progressPercent, successfulScansToday };
    }, [todayInboundList, expectedInboundList]);

    const activeDriversCount = React.useMemo(() => drivers.filter(d => d.status === 'Ativo').length, [drivers]);
    const availableStockCount = React.useMemo(() => stockItems.filter(item => item.status?.toLowerCase() === 'em estoque').length, [stockItems]);

    // Constantes derivadas para compatibilidade retroativa
    const weeklyStats = statsSummary.weeklyStats;
    const totalInboundToday = statsSummary.totalInboundToday;
    const totalOutboundToday = statsSummary.totalOutboundToday;
    const totalReversaToday = statsSummary.totalReversaToday;

    useEffect(() => {
        if (!currentUser) return;
        loadInitialData();
    }, [currentUser]);

    const clearInboundManifest = async () => {
        if (!currentUser) return;
        _setExpectedInboundList([]);
        await supabase
            .from('system_configs')
            .upsert({ company_id: currentUser.company_id, expected_inbound: [] });
    };

    const setExpectedInboundList = async (list: string[]) => {
        if (!currentUser) return;
        _setExpectedInboundList(list);
        await supabase
            .from('system_configs')
            .upsert({ company_id: currentUser.company_id, expected_inbound: list });
    };

    const addInboundItem = async (item: InboundItem) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        const enrichedItem = { ...item, time: now };

        if (item.status === 'Sucesso') {
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser.company_id);
        }

        const { error } = await supabase.from('inbound_log').insert({
            ...enrichedItem,
            company_id: currentUser.company_id
        });

        if (error) {
            console.error('WmsContext: Error adding inbound item:', error);
            playAudio('error');
            return;
        }

        const exists = stockItems.find(s => s.id === item.id);
        const stockData = exists
            ? {
                id: item.id,
                entry_time: now,
                operator: item.operator,
                status: 'Em Estoque' as const,
                loss_detected_time: null,
                company_id: currentUser.company_id
            }
            : {
                id: item.id,
                entry_time: now,
                operator: item.operator,
                status: 'Em Estoque' as const,
                company_id: currentUser.company_id
            };

        await supabase.from('stock_items').upsert(stockData);
        playAudio('success');
    };

    const addOutboundItem = async (item: OutboundItem) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const now = getSaoPauloIso();
        const enrichedItem = { ...item, time: now };

        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser.company_id);

        const { error: insE } = await supabase.from('outbound_log').insert({
            id: enrichedItem.id,
            driver_name: enrichedItem.driverName,
            vehicle: enrichedItem.vehicle,
            time: enrichedItem.time,
            operator: enrichedItem.operator,
            status: enrichedItem.status,
            pallet_id: (enrichedItem as any).palletId,
            company_id: currentUser.company_id
        });

        if (insE) {
            console.error('WmsContext: Error adding outbound item:', insE);
            playAudio('error');
            return { success: false, message: insE.message };
        }

        await supabase.from('stock_items')
            .update({ status: 'Saiu' })
            .eq('id', item.id)
            .eq('company_id', currentUser.company_id);

        loadInitialData();
        syncDetailedLogs('outbound');
        playAudio('success');

        // Sync with RTS Expeditions
        await syncExpedition(enrichedItem.driverName, enrichedItem.vehicle, 1);

        return { success: true };
    };

    const bulkAddOutboundItems = async (items: OutboundItem[]) => {
        if (!currentUser || items.length === 0) return { success: false, message: 'Nada para expedir' };
        const now = getSaoPauloIso();
        const companyId = currentUser.company_id;

        const enrichedItems = items.map(item => ({
            id: item.id,
            driver_name: item.driverName,
            vehicle: item.vehicle,
            time: item.time || now,
            operator: item.operator,
            status: item.status,
            pallet_id: (item as any).palletId,
            company_id: companyId
        }));

        // 1. Bulk Insert into outbound_log
        const { error: insE } = await supabase.from('outbound_log').insert(enrichedItems);
        if (insE) {
            console.error('WmsContext: Error bulk adding outbound items:', insE);
            playAudio('error');
            return { success: false, message: `Erro ao salvar logs: ${insE.message}` };
        }

        // 2. Bulk Update stock_items status and pallet_id
        const ids = items.map(i => i.id);
        const batchPalletId = (items[0] as any).palletId;

        const { error: updE } = await supabase.from('stock_items')
            .update({
                status: 'Saiu',
                pallet_id: batchPalletId
            })
            .in('id', ids)
            .eq('company_id', companyId);

        if (updE) {
            console.error('WmsContext: Error bulk updating stock status:', updE);
        }

        // 3. Register scans in gamification
        for (const item of items) {
            await gamificationService.registerScan(currentUser.id, currentUser.name, companyId);
        }

        loadInitialData();
        syncDetailedLogs('outbound');
        playAudio('success');

        // Sync with RTS Expeditions
        if (items.length > 0) {
            await syncExpedition(items[0].driverName, items[0].vehicle, items.length);
        }

        return { success: true };
    };

    const deleteOutboundItem = async (id: string) => {
        if (!currentUser) return;
        await supabase.from('outbound_log')
            .delete()
            .eq('id', id)
            .eq('company_id', currentUser.company_id);

        await supabase.from('stock_items')
            .update({ status: 'Em Estoque' })
            .eq('id', id)
            .eq('company_id', currentUser.company_id);

        loadInitialData();
        syncDetailedLogs('outbound');
        playAudio('success');
    };


    const addDriver = async (driverData: Omit<Driver, 'id' | 'lastActivity'>) => {
        if (!currentUser) return;
        const newDriverId = 'dr-' + Math.random().toString(36).substr(2, 9);
        const now = getSaoPauloIso();

        await supabase.from('drivers').insert({
            id: newDriverId,
            name: driverData.name,
            cpf: driverData.cpf,
            plate: driverData.plate,
            company: driverData.company,
            status: driverData.status,
            vehicle_profile: driverData.vehicleProfile,
            last_activity: now,
            company_id: currentUser.company_id
        });
        await loadInitialData();
        playAudio('success');
    };

    const bulkAddDrivers = async (driversList: Omit<Driver, 'id' | 'lastActivity'>[]) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        const newOnes = driversList.map(d => ({
            id: 'dr-' + Math.random().toString(36).substr(2, 9),
            name: d.name,
            cpf: d.cpf,
            plate: d.plate,
            company: d.company,
            status: d.status,
            vehicle_profile: d.vehicleProfile,
            last_activity: now,
            company_id: currentUser.company_id
        }));
        await supabase.from('drivers').insert(newOnes);
        await loadInitialData();
        playAudio('success');
    };

    const updateDriver = async (id: string, updates: Partial<Driver>) => {
        if (!currentUser) return;

        // Map camelCase to snake_case for the database
        const dbUpdates: any = { ...updates };
        if (updates.vehicleProfile) {
            dbUpdates.vehicle_profile = updates.vehicleProfile;
            delete dbUpdates.vehicleProfile;
        }
        if (updates.lastActivity) {
            dbUpdates.last_activity = updates.lastActivity;
            delete dbUpdates.lastActivity;
        }

        const { error } = await supabase.from('drivers')
            .update(dbUpdates)
            .eq('id', id)
            .eq('company_id', currentUser.company_id);

        if (error) {
            console.error('WmsContext: Error updating driver:', error);
            playAudio('error');
        } else {
            await loadInitialData();
            playAudio('success');
        }
    };

    // --- RTS Helper & Methods ---
    const syncExpedition = async (driverName: string, plate: string, count: number) => {
        if (!currentUser) return;
        const today = getSaoPauloDate(); // YYYY-MM-DD

        console.log(`WmsContext: Syncing expedition for ${driverName} on ${today} (+${count} packages)`);

        try {
            // Use RPC or Upsert with onConflict if supported, 
            // but since we added a unique constraint, we can use a simpler approach:
            // 1. Fetch current total
            const { data: existing } = await supabase.from('expeditions')
                .select('id, total_packages')
                .eq('company_id', currentUser.company_id)
                .eq('driver_name', driverName)
                .eq('dispatch_date', today)
                .maybeSingle();

            if (existing) {
                const { error: ue } = await supabase.from('expeditions')
                    .update({
                        total_packages: (existing.total_packages || 0) + count,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (ue) throw ue;
            } else {
                const { error: ie } = await supabase.from('expeditions').insert({
                    company_id: currentUser.company_id,
                    driver_name: driverName,
                    plate: plate,
                    dispatch_date: today,
                    total_packages: count,
                    delivered_count: 0,
                    returned_count: 0,
                    status: 'EM_ROTA'
                });
                if (ie) throw ie;
            }

            // Proactively refresh expeditions in state
            const { data: freshExp } = await supabase.from('expeditions')
                .select('*')
                .eq('company_id', currentUser.company_id)
                .order('dispatch_date', { ascending: false });

            if (freshExp) setExpeditions(freshExp);

        } catch (err) {
            console.error('WmsContext: syncExpedition critical error:', err);
        }
    };

    const updateExpeditionDelivered = async (id: string, delivered: number) => {
        if (!currentUser) return;
        await supabase.from('expeditions')
            .update({
                delivered_count: delivered
            })
            .eq('id', id)
            .eq('company_id', currentUser.company_id);
        loadInitialData();
    };

    const verifyReturn = async (tbrId: string, driverName: string) => {
        if (!currentUser) return { success: false, message: 'Não logado' };

        // 1. Check if the item was indeed out with this driver today
        const { data: outbound } = await supabase.from('outbound_log')
            .select('*')
            .eq('id', tbrId)
            .eq('driver_name', driverName)
            .eq('company_id', currentUser.company_id)
            .order('time', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (!outbound) {
            return { success: false, message: `TBR não encontrada na saída deste motorista.` };
        }

        // 2. Increment returned_count in expedition
        const today = getSaoPauloIso().split('T')[0];
        const { data: exp } = await supabase.from('expeditions')
            .select('*')
            .eq('driver_name', driverName)
            .eq('dispatch_date', today)
            .eq('company_id', currentUser.company_id)
            .maybeSingle();

        if (exp) {
            await supabase.from('expeditions')
                .update({
                    returned_count: exp.returned_count + 1
                })
                .eq('id', exp.id);
        }

        // 3. Update stock_items to 'Em Estoque'
        await supabase.from('stock_items')
            .update({ status: 'Em Estoque' })
            .eq('id', tbrId)
            .eq('company_id', currentUser.company_id);

        loadInitialData();
        syncDetailedLogs('stock');
        return { success: true, message: 'Retorno verificado com sucesso.' };
    };

    const deleteDriver = async (id: string) => {
        if (!currentUser) return;
        const { error } = await supabase.from('drivers')
            .delete()
            .eq('id', id)
            .eq('company_id', currentUser.company_id);

        if (error) {
            console.error('WmsContext: Error deleting driver:', error);
            playAudio('error');
        } else {
            await loadInitialData();
            playAudio('success');
        }
    };

    const [isInventoryActive, setIsInventoryActive] = useState(false);

    const addInventoryItem = async (item: InventoryItem) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        if (inventoryItems.some(i => i.id === item.id)) {
            playAudio('error');
            return;
        }
        if (currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser.company_id);
        }

        const { error } = await supabase.from('inventory_log').insert({
            ...item,
            time: now,
            company_id: currentUser.company_id
        });

        if (error) {
            console.error('WmsContext: Error adding inventory item:', error);
            playAudio('error');
            return;
        }

        syncDetailedLogs('stock');
        playAudio('success');
    };

    const startInventory = async () => {
        setIsInventoryActive(true);
        setInventoryItems([]);
        localStorage.removeItem(STORAGE_KEYS.INVENTORY_LOG);
    };

    const stopInventory = async () => {
        if (!currentUser) return;
        setIsInventoryActive(false);
        const missingIds = stockItems
            .filter(s => s.status?.toLowerCase() === 'em estoque' && !inventoryItems.some(inv => inv.id === s.id))
            .map(s => s.id);

        const now = getSaoPauloIso();

        // Update each missing item in Supabase
        for (const id of missingIds) {
            await supabase.from('stock_items')
                .update({
                    status: 'Possível Perda' as const,
                    loss_detected_time: now
                })
                .eq('id', id)
                .eq('company_id', currentUser.company_id);
        }

        loadInitialData();
    };

    const localizeItem = async (id: string, scannerInput: string) => {
        if (!currentUser) return { success: false, message: 'Não logado' };

        const validation = isValidTbr(scannerInput);
        if (!validation.isValid) {
            playAudio('error');
            return { success: false, message: validation.message };
        }

        const stockItem = stockItems.find(s => s.id === id);

        if (!stockItem) {
            playAudio('error');
            return { success: false, message: `TBR ${id} não encontrada no estoque.` };
        }

        if (stockItem.status?.toLowerCase() !== 'em estoque' && stockItem.status?.toLowerCase() !== 'possível perda') {
            const status = stockItem?.status?.toLowerCase();
            const statusMsg = status === 'saiu'
                ? `ERRO: TBR ${id} já foi expedida anteriormente. Se ela retornou, faça o recebimento na Entrada.`
                : status === 'perda'
                    ? `ERRO: TBR ${id} está marcada como Perda definitiva.`
                    : `ERRO: TBR ${id} está com status: ${stockItem.status}.`;
            playAudio('error');
            return { success: false, message: statusMsg };
        }

        if (stockItem.lossDetectedTime) {
            const hoursElapsed = (getTodayDate().getTime() - new Date(stockItem.lossDetectedTime).getTime()) / (1000 * 60 * 60);
            if (hoursElapsed > 72) {
                // Update status to 'Perda' in DB and local state
                await supabase.from('stock_items')
                    .update({ status: 'Perda' as const })
                    .eq('id', id)
                    .eq('company_id', currentUser.company_id);
                loadInitialData(); // Reload to get updated status
                playAudio('error');
                return { success: false, message: 'Tempo limite de 72h excedido. Item marcado como Perda definitiva.' };
            }
        }

        // If the item is already in stock and the scanner input is different from the item ID,
        // it means we are re-allocating it to a new rack.
        if (stockItem.status?.toLowerCase() === 'em estoque' && id !== scannerInput) {
            const updates = {
                rack_location: scannerInput,
                localized_by: currentUser?.name || 'Sistema'
            };
            await supabase.from('stock_items')
                .update(updates)
                .eq('id', id)
                .eq('company_id', currentUser.company_id);
            loadInitialData();
            playAudio('success');
            return { success: true, message: `Item ${id} realocado para o rack ${scannerInput}.` };
        }

        // If the item is not in stock or is a possible loss, we are localizing it.
        if (stockItem.status?.toLowerCase() === 'possível perda') {
            const updates = {
                status: 'Em Estoque' as const,
                entry_time: getSaoPauloIso(), // Update entry time as it's "re-entered"
                operator: currentUser?.name || 'Sistema',
                loss_detected_time: null,
                localized_by: currentUser?.name || 'Sistema',
                rack_location: scannerInput // Assuming scannerInput is the rack location
            };

            await supabase.from('stock_items')
                .update(updates)
                .eq('id', id)
                .eq('company_id', currentUser.company_id);

            loadInitialData();
            playAudio('success');
            return { success: true, message: `Item ${id} localizado e re-alocado no rack ${scannerInput}.` };
        }

        // If it's already 'Em Estoque' and scannerInput is the same as ID, it's just a confirmation.
        playAudio('success');
        return { success: true, message: `TBR ${id} confirmada no estoque.` };
    };

    const uploadUserAvatar = async (file: File) => {
        if (!currentUser) return { success: false, message: 'Não logado' };

        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${currentUser.id}/${Math.random()}.${fileExt}`;
            const filePath = `${fileName}`;

            // 1. Upload to Supabase Storage
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            // 2. Get Public URL
            const { data: { publicUrl } } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            // 3. Update User Profile in DB
            const { error: updateError } = await supabase
                .from('users')
                .update({ avatar_url: publicUrl })
                .eq('id', currentUser.id);

            if (updateError) throw updateError;

            // 4. Refresh Local State
            await refreshProfile();
            playAudio('success');

            return { success: true, message: 'Avatar atualizado com sucesso!' };
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            playAudio('error');
            return { success: false, message: error.message || 'Erro ao fazer upload' };
        }
    };

    const verifyStock = async (id: string) => {
        const validation = isValidTbr(id);
        if (!validation.isValid) return { success: false, message: validation.message };

        const currentId = id.trim().toUpperCase();

        // Check for active incidents
        const activeIncident = treatmentItems.find(t => t.tbrId === currentId && t.status !== 'Resolvido');
        if (activeIncident) {
            return {
                success: false,
                message: `BLOQUEADO: TBR ${currentId} possui uma tratativa ativa (${activeIncident.id}). Resolva antes de prosseguir.`
            };
        }

        const item = stockItems.find(s => s.id === currentId);
        if (!item) {
            return { success: false, message: `TBR ${currentId} não encontrada no estoque.` };
        }
        if (item.status?.toLowerCase() !== 'em estoque') {
            return { success: false, message: `TBR ${currentId} está com status: ${item.status}.` };
        }
        return { success: true, message: 'Item validado.' };
    };


    const addTreatment = async (itemData: Omit<TreatmentItem, 'id' | 'time' | 'status'>) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const existingActive = treatmentItems.find(t => t.tbrId === itemData.tbrId && t.status?.toLowerCase() !== 'resolvido');
        if (existingActive) {
            playAudio('error');
            return { success: false, message: `Já existe uma tratativa ativa (${existingActive.id}) para esta TBR.` };
        }

        const trtId = `TRT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const now = getSaoPauloIso();
        const displayTime = formatToLocalTime(getSaoPauloIso());

        const newItem = {
            id: trtId,
            tbr_id: itemData.tbrId,
            type: itemData.type,
            description: itemData.description,
            operator: itemData.operator,
            time: now,
            status: 'Pendente' as const,
            company_id: currentUser.company_id
        };

        await supabase.from('incidents').insert(newItem);

        if (itemData.type === 'Extravio' || itemData.type === 'Avaria') {
            await supabase.from('stock_items')
                .update({
                    status: 'Possível Perda' as const,
                    loss_detected_time: now
                })
                .eq('id', itemData.tbrId)
                .eq('company_id', currentUser.company_id);
        }

        await loadInitialData();
        syncDetailedLogs('treatments');
        playAudio('success');
        return { success: true, message: 'Incidente registrado com sucesso.' };
    };

    const updateTreatmentStatus = async (id: string, status: TreatmentItem['status']) => {
        if (!currentUser) return;
        await supabase.from('incidents')
            .update({ status })
            .eq('id', id)
            .eq('company_id', currentUser.company_id);
        playAudio('success');
    };

    const updateTreatment = async (id: string, updates: Partial<Pick<TreatmentItem, 'type' | 'description'>>) => {
        if (!currentUser) return;
        await supabase.from('incidents')
            .update(updates)
            .eq('id', id)
            .eq('company_id', currentUser.company_id);
        playAudio('success');
    };

    // --- Auth & User Management Logic ---

    const login = async (identifier: string, password: string) => {
        console.log('WmsContext: login attempt for', identifier);
        const result = await AuthService.login(identifier, password);
        console.log('WmsContext: login result:', result.success ? 'SUCCESS' : 'FAILURE', result.message);
        if (result.success && result.user) {
            setCurrentUser(result.user);
        }
        return { success: result.success, message: result.message };
    };

    const logout = async () => {
        try {
            await AuthService.logout();
        } finally {
            setCurrentUser(null);
            setInboundItems([]);
            setOutboundItems([]);
            setStockItems([]);
            setInventoryItems([]);
            setDrivers([]);
            setTreatmentItems([]);
            setUsers([]);
            _setCurrentView(View.LOGIN);
            localStorage.removeItem('wms_active_view');
        }
    };

    const register = async (name: string, email: string, password: string, companyId: string, customId?: string) => {
        const result = await AuthService.register(name, email, password, companyId, customId);
        // Refresh users list if we are admin and just added someone (though usually we are logged out when registering)
        await refreshUsers();
        return result;
    };

    const refreshUsers = async () => {
        if (!currentUser) return;
        const userRole = (currentUser.role || '').toLowerCase();
        const isSuperAdmin = userRole === 'superadmin';
        const isAdmin = isSuperAdmin || userRole === 'admin';

        console.log('WmsContext: Manual refresh. Admin?', isAdmin);

        let query = supabase.from('users').select('*').order('name', { ascending: true });

        if (!isSuperAdmin) {
            query = query.eq('company_id', currentUser.company_id);
        }

        let { data, error } = await query;

        // Fallback for admins if company filter yields nothing
        if (!error && (!data || data.length === 0) && isAdmin) {
            console.log('WmsContext: Refresh empty, trying fallback...');
            const { data: fallback } = await supabase.from('users').select('*').limit(100);
            if (fallback) data = fallback;
        }

        if (error) {
            console.error('WmsContext: Error refreshing users:', error);
            return;
        }
        console.log('WmsContext: Refreshed users count:', data?.length || 0);
        setUsers(data as User[]);
    };
    const updateUserStatus = async (id: string, status: UserStatus, role?: Role | null) => {
        await AuthService.updateUserStatus(id, status, role);
        await refreshUsers();
    };

    const updateUser = async (originalId: string, updates: Partial<User>) => {
        const result = await AuthService.updateUser(originalId, updates);
        await refreshUsers();

        if (currentUser && currentUser.id === originalId) {
            const allUsers = await AuthService.getUsers();
            const updated = allUsers.find(u => u.id === (updates.id || originalId));
            if (updated) {
                setCurrentUser(updated);
                AuthService.saveSession(updated);
            }
        }
        return result;
    };

    const deleteUser = async (id: string) => {
        await AuthService.deleteUser(id);
        await refreshUsers();
    };

    const inviteUser = async (email: string) => {
        if (!currentUser) return { success: false, message: 'Admin não logado.' };
        const result = await AuthService.inviteUser(email, currentUser);
        await refreshUsers();
        return result;
    };

    const updatePassword = async (newPassword: string) => {
        const result = await AuthService.updatePassword(newPassword);
        if (result.success && currentUser) {
            setCurrentUser({ ...currentUser, force_password_reset: false });
        }
        return result;
    };

    const adminResetPassword = async (userId: string, newPassword: string) => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
            return { success: false, message: 'Não autorizado' };
        }

        const { data, error } = await supabase.functions.invoke('admin-reset-password', {
            body: { userId, newPassword }
        });

        if (error) {
            console.error('WmsContext: Error resetting password:', error);
            playAudio('error');
            return { success: false, message: error.message };
        }

        if (data?.success) {
            playAudio('success');
            return { success: true, message: data.message };
        } else {
            return { success: false, message: data?.error || 'Erro desconhecido' };
        }
    };

    const resetTransactions = async () => {
        if (!currentUser) return;
        const companyId = currentUser.company_id;

        await supabase.from('inbound_log').delete().eq('company_id', companyId);
        await supabase.from('outbound_log').delete().eq('company_id', companyId);
        await supabase.from('stock_items').delete().eq('company_id', companyId);
        await supabase.from('incidents').delete().eq('company_id', companyId);
        await supabase.from('inventory_log').delete().eq('company_id', companyId);
        await supabase.from('expeditions').delete().eq('company_id', companyId);
        await supabase.from('system_configs').update({ expected_inbound: [] }).eq('company_id', companyId);

        // Reset local stats states immediately to show zeroed dashboard
        setDashboardStats(null);
        setWeeklyStatsFromView([]);

        // Refresh the materialized view in the database
        await supabase.rpc('refresh_weekly_movement');

        loadInitialData();
        playAudio('success');
    };

    // Helper para buscar contagem de hoje de um motorista específico (Alto Volume)
    const fetchDriverTodayCount = React.useCallback(async (driverId: string): Promise<number> => {
        const { count, error } = await supabase
            .from('outbound_log')
            .select('id', { count: 'exact', head: true })
            .eq('driver_id', driverId)
            .gte('created_at', getSaoPauloDate() + 'T00:00:00');

        if (error) {
            console.error('WmsContext: Erro ao buscar contagem do motorista:', error);
            return 0;
        }
        return count || 0;
    }, []);

    const totalInventoryScanned = inventoryItems.length;
    const totalLossItems = statsSummary.totalLossItems;
    const staleItemsCount = statsSummary.staleItemsCount;

    // Total Esperado são os itens atualmente marcados como 'Em Estoque'
    const totalExpected = dashboardStats?.total_em_estoque || 0;

    return (
        <WmsContext.Provider value={{
            currentUser, logout, login, register,
            updatePassword, adminResetPassword, users, inviteUser, refreshUsers, updateUserStatus, updateUser, deleteUser,
            currentView, setCurrentView,
            stockItems, possibleLossItems, staleStockItems,
            inboundItems, addInboundItem, expectedInboundList, setExpectedInboundList, clearInboundManifest,
            outboundItems, addOutboundItem, bulkAddOutboundItems, deleteOutboundItem,
            inventoryItems, isInventoryActive, setIsInventoryActive, addInventoryItem,
            startInventory, stopInventory, localizeItem,
            drivers, addDriver, bulkAddDrivers, updateDriver, deleteDriver,
            treatmentItems, addTreatment, updateTreatmentStatus, updateTreatment,
            expeditions, updateExpeditionDelivered, verifyReturn,
            totalInboundToday, totalOutboundToday, totalReversaToday, totalInventoryScanned, totalLossItems, staleItemsCount,
            totalExpected, totalPossibleLosses: statsSummary.totalPossibleLosses,
            todayInboundList, todayOutboundList, inboundReconciliation,
            activeDriversCount, availableStockCount,
            weeklyStats,
            resetTransactions,
            verifyStock, isValidTbr, isSameDay, getLocalDateIso: () => getSaoPauloDate(),
            playAudio, refreshProfile, uploadUserAvatar,
            syncDetailedLogs,
            fetchDriverTodayCount
        }}>
            {children}
        </WmsContext.Provider>
    );
};

export const useWms = () => useContext(WmsContext);
