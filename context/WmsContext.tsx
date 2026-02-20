import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Driver, Role, UserStatus, VehicleProfile, View } from '../types';
import { AuthService } from '../services/authService';
import { supabase } from '../services/supabase';

// ... (keep InboundItem, OutboundItem, InventoryItem, StockItem interfaces as is) ...

interface InboundItem {
    id: string;
    status: 'Sucesso' | 'Prefixo Inválido' | 'Duplicado' | 'Perda Definitiva';
    operator: string;
    time: string;
    error: boolean;
}

interface OutboundItem {
    id: string;
    driverName: string;
    vehicle: string;
    time: string;
    operator: string;
    status: 'Saiu com Motorista' | 'Reversa - Saiu com Motorista';
}

interface InventoryItem {
    id: string;
    time: string;
    operator: string;
}

interface StockItem {
    id: string;
    entryTime: string;
    operator: string;
    status: 'Em Estoque' | 'Saiu' | 'Possível Perda' | 'Perda';
    lossDetectedTime?: string; // ISO string when it was marked as missing
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

// UserItem is now just User from types.ts
// Removed legacy UserItem interface

interface WmsContextData {
    // Inbound
    inboundItems: InboundItem[];
    addInboundItem: (item: InboundItem) => Promise<void>;
    expectedInboundList: string[];
    setExpectedInboundList: (list: string[]) => Promise<void>;

    // Outbound
    outboundItems: OutboundItem[];
    addOutboundItem: (item: OutboundItem) => Promise<void>;
    deleteOutboundItem: (id: string) => Promise<void>;

    // Inventory
    inventoryItems: InventoryItem[];
    stockItems: StockItem[];
    possibleLossItems: StockItem[];
    staleStockItems: StockItem[]; // +24h items list
    addInventoryItem: (item: InventoryItem) => Promise<void>;
    isInventoryActive: boolean;
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

    // Stats
    totalInboundToday: number;
    totalOutboundToday: number;
    totalReversaToday: number;
    totalInventoryScanned: number;
    totalLossItems: number;
    staleItemsCount: number; // +24h items
    weeklyStats: { name: string; entradas: number; saudas: number }[];
    resetTransactions: () => Promise<void>;

    // Helpers
    verifyStock: (id: string) => Promise<{ success: boolean; message: string }>;

    // Audio
    playAudio: (type: 'success' | 'error') => void;
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
        // Basic check to avoid 'LOGIN' or empty values
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

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                console.log('Auth state change: session detected', session.user.id);
                const { data: userData, error } = await supabase.from('users').select('*').eq('id', session.user.id).single();
                if (userData && !error) {
                    const user = userData as User;
                    console.log('User profile loaded:', user.name);
                    setCurrentUser(user);
                    AuthService.saveSession(user);
                } else {
                    console.error('Failed to load user profile after session detection', error);
                }
            } else {
                console.log('Auth state change: no session (event:', event, ')');
                if (event === 'SIGNED_OUT') {
                    setCurrentUser(null);
                    _setCurrentView(View.LOGIN);
                }
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // --- Initial Sync ---
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [possibleLossItems, setPossibleLossItems] = useState<StockItem[]>([]);

    // --- Inbound State ---
    const [inboundItems, setInboundItems] = useState<InboundItem[]>([]);
    const [expectedInboundList, _setExpectedInboundList] = useState<string[]>([]);

    // --- Outbound State ---
    const [outboundItems, setOutboundItems] = useState<OutboundItem[]>([]);

    // --- Inventory State ---
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);

    // --- Drivers State ---
    const [drivers, setDrivers] = useState<Driver[]>([]);

    // --- Treatments State ---
    const [treatmentItems, setTreatmentItems] = useState<TreatmentItem[]>([]);

    // --- Weekly Stats State ---
    const [weeklyStats, setWeeklyStats] = useState<{ name: string; entradas: number; saudas: number }[]>([]);
    // --- Initial Sync ---
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!currentUser) return;
            console.log('WmsContext: Fetching initial data for user', currentUser.id);

            try {
                // 1. Fetch Expected List
                const { data: config, error: configError } = await supabase.from('system_config').select('value').eq('key', 'expected_inbound').single();
                if (configError && configError.code !== 'PGRST116') console.warn('WmsContext: Error fetching config', configError);
                if (config) _setExpectedInboundList(config.value as string[]);

                // 2. Fetch Drivers
                const { data: driversData, error: driversError } = await supabase.from('drivers').select('*');
                if (driversError) console.error('WmsContext: Error fetching drivers', driversError);
                if (driversData) setDrivers(driversData.map(d => ({
                    id: d.id,
                    name: d.name,
                    cpf: d.cpf,
                    plate: d.plate,
                    company: d.company_id,
                    status: d.status,
                    vehicleProfile: d.vehicle || 'Moto',
                    lastActivity: d.last_activity
                })));

                // 3. Fetch Treatments
                const { data: treatmentsData, error: trtError } = await supabase.from('incidents').select('*');
                if (trtError) console.error('WmsContext: Error fetching incidents', trtError);
                if (treatmentsData) setTreatmentItems(treatmentsData.map(t => ({
                    id: t.id,
                    tbrId: t.tbr_id,
                    type: t.type,
                    description: t.description,
                    status: t.status,
                    operator: t.operator,
                    time: t.time ? new Date(t.time).toLocaleString('pt-BR') : ''
                })));

                // 4. Fetch Stock
                const { data: stockData, error: stockError } = await supabase.from('stock').select('*');
                if (stockError) console.error('WmsContext: Error fetching stock', stockError);
                if (stockData) {
                    const mappedStock = stockData.map(s => ({
                        id: s.id,
                        entryTime: s.entry_time, // Keep as ISO string in state for easier parsing
                        operator: s.operator,
                        status: s.status as StockItem['status'],
                        lossDetectedTime: s.loss_detected_time
                    }));
                    setStockItems(mappedStock);
                    setPossibleLossItems(mappedStock.filter(s => s.status === 'Possível Perda'));
                }

                // 5. Fetch logs (limiting to recent)
                const { data: inboundLogs, error: inLogErr } = await supabase.from('inbound_log').select('*').order('time', { ascending: false }).limit(200);
                if (inLogErr) console.error('WmsContext: Error fetching inbound logs', inLogErr);
                if (inboundLogs) setInboundItems(inboundLogs.map(l => ({
                    id: l.tbr_id,
                    status: l.status as InboundItem['status'],
                    operator: l.operator,
                    time: l.time ? new Date(l.time).toLocaleString('pt-BR') : '',
                    error: l.error
                })));

                const { data: outboundLogs, error: outLogErr } = await supabase.from('outbound_log').select('*').order('time', { ascending: false }).limit(200);
                if (outLogErr) console.error('WmsContext: Error fetching outbound logs', outLogErr);
                if (outboundLogs) setOutboundItems(outboundLogs.map(l => ({
                    id: l.tbr_id,
                    driverName: l.driver_name,
                    vehicle: l.vehicle,
                    time: l.time ? new Date(l.time).toLocaleString('pt-BR') : '',
                    operator: l.operator,
                    status: l.status as OutboundItem['status']
                })));

                // 6. Aggregate Weekly Stats
                const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
                const statsMap: Record<string, { name: string, entradas: number, saudas: number }> = {};

                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

                if (!currentUser) return;

                const { data: recentInbound } = await supabase.from('inbound_log')
                    .select('time')
                    .gte('time', sevenDaysAgo.toISOString())
                    .eq('error', false)
                    .eq('company_id', currentUser.company_id);

                const { data: recentOutbound } = await supabase.from('outbound_log')
                    .select('time')
                    .gte('time', sevenDaysAgo.toISOString())
                    .eq('company_id', currentUser.company_id);

                recentInbound?.forEach(log => {
                    const dateKey = new Date(log.time).toLocaleDateString('pt-BR');
                    if (statsMap[dateKey]) statsMap[dateKey].entradas++;
                });

                recentOutbound?.forEach(log => {
                    const dateKey = new Date(log.time).toLocaleDateString('pt-BR');
                    if (statsMap[dateKey]) statsMap[dateKey].saudas++;
                });

                setWeeklyStats(Object.values(statsMap));
            } catch (err) {
                console.error('WmsContext: Critical error in fetchInitialData:', err);
            }
        };

        fetchInitialData();
    }, [currentUser]);

    const setExpectedInboundList = async (list: string[]) => {
        _setExpectedInboundList(list);
        await supabase.from('system_config').upsert({ key: 'expected_inbound', value: list, company_id: currentUser?.company_id });
    };

    const addInboundItem = async (item: InboundItem) => {
        // Enforce 72h rule for lost items
        const stockItem = stockItems.find(s => s.id === item.id);
        if (stockItem?.status === 'Possível Perda' && stockItem.lossDetectedTime) {
            const lossTime = new Date(stockItem.lossDetectedTime).getTime();
            const now = new Date().getTime();
            const hoursElapsed = (now - lossTime) / (1000 * 60 * 60);

            if (hoursElapsed > 72) {
                // Update stock in Supabase
                await supabase.from('stock').update({ status: 'Perda' }).eq('id', item.id);
                setStockItems(prev => prev.map(s => s.id === item.id ? { ...s, status: 'Perda' } : s));
                setPossibleLossItems(prev => prev.filter(p => p.id !== item.id));

                playAudio('error');
                const errorLog = { ...item, status: 'Perda Definitiva' as const, error: true };
                setInboundItems(prev => [errorLog, ...prev]);
                await supabase.from('inbound_log').insert({
                    tbr_id: item.id,
                    status: 'Perda Definitiva',
                    operator: item.operator,
                    error: true,
                    company_id: currentUser?.company_id
                });
                return;
            }
        }

        setInboundItems(prev => [item, ...prev]);

        try {
            // Log Inbound
            const { error: logErr } = await supabase.from('inbound_log').insert({
                tbr_id: item.id,
                status: item.status,
                operator: item.operator,
                error: item.error,
                company_id: currentUser?.company_id
            });
            if (logErr) console.error('WmsContext: Inbound log error', logErr);

            if (!item.error) {
                const now = new Date().toISOString();

                // 1. Auto-resolve treatments (local + remote)
                setTreatmentItems(prev => prev.map(t =>
                    (t.tbrId === item.id && t.status !== 'Resolvido')
                        ? { ...t, status: 'Resolvido' }
                        : t
                ));
                const { error: trtResError } = await supabase.from('incidents')
                    .update({ status: 'Resolvido', updated_at: now })
                    .eq('tbr_id', item.id)
                    .eq('status', 'Pendente');
                if (trtResError) console.error('WmsContext: Treatment resolution error', trtResError);

                // 2. Upsert Stock Item (remote)
                const { data: existing, error: checkErr } = await supabase.from('stock')
                    .select('id')
                    .eq('id', item.id)
                    .single();

                if (existing) {
                    const { error: updErr } = await supabase.from('stock').update({
                        entry_time: now,
                        operator: item.operator,
                        status: 'Em Estoque',
                        company_id: currentUser?.company_id,
                        loss_detected_time: null
                    }).eq('id', item.id);
                    if (updErr) console.error('WmsContext: Stock update error', updErr);
                } else {
                    const { error: insErr } = await supabase.from('stock').insert({
                        id: item.id,
                        entry_time: now,
                        operator: item.operator,
                        status: 'Em Estoque',
                        company_id: currentUser?.company_id
                    });
                    if (insErr) console.error('WmsContext: Stock insert error', insErr);
                }

                // 3. Update Local State
                setStockItems(prev => {
                    const exists = prev.find(s => s.id === item.id);
                    if (exists) {
                        return prev.map(s => s.id === item.id ? {
                            ...s,
                            entryTime: now,
                            operator: item.operator,
                            status: 'Em Estoque' as const
                        } : s);
                    } else {
                        return [...prev, {
                            id: item.id,
                            entryTime: now,
                            operator: item.operator,
                            status: 'Em Estoque' as const
                        }];
                    }
                });

                setPossibleLossItems(prev => prev.filter(p => p.id !== item.id));

                // 4. Gamification
                try {
                    const { gamificationService } = await import('../services/gamificationService');
                    await gamificationService.registerScan(currentUser!.id, currentUser!.name);
                } catch (gErr) {
                    console.error('Inbound Gamification Error:', gErr);
                }

                playAudio('success');
            } else {
                playAudio('error');
            }
        } catch (fatalErr) {
            console.error('WmsContext: Fatal error in addInboundItem', fatalErr);
            playAudio('error');
        }
    };

    const addOutboundItem = async (item: OutboundItem) => {
        if (!currentUser) return;
        setOutboundItems(prev => [item, ...prev]);

        try {
            // Update Stock
            const { error: stockErr } = await supabase.from('stock').update({ status: 'Saiu' }).eq('id', item.id);
            if (stockErr) console.error('WmsContext: Outbound stock update error', stockErr);

            // Log Outbound
            const { error: logErr } = await supabase.from('outbound_log').insert({
                tbr_id: item.id,
                driver_name: item.driverName,
                vehicle: item.vehicle,
                operator: item.operator,
                company_id: currentUser.company_id
            });
            if (logErr) console.error('WmsContext: Outbound log insert error', logErr);

            setStockItems(prev => prev.map(stock =>
                stock.id === item.id ? { ...stock, status: 'Saiu' } : stock
            ));
            setPossibleLossItems(prev => prev.filter(loss => loss.id !== item.id));

            // Gamification scan registration
            try {
                const { gamificationService } = await import('../services/gamificationService');
                await gamificationService.registerScan(currentUser!.id, currentUser!.name);
            } catch (gErr) {
                console.error('Outbound Gamification Error:', gErr);
            }

            playAudio('success');
        } catch (e) {
            console.error('WmsContext: Outbound fatal error', e);
            playAudio('error');
        }
    };

    const deleteOutboundItem = async (id: string) => {
        const itemToRemove = outboundItems.find(item => item.id === id);
        if (!itemToRemove) return;

        setOutboundItems(prev => prev.filter(item => item.id !== id));
        // Delete log or just ignore it? Usually we keep logs, but user said "Clear Outbound" or similar before. 
        // For now let's just update stock status back to 'Em Estoque'
        await supabase.from('stock').update({ status: 'Em Estoque' }).eq('id', id);
        // Remove from outbound_log? Logic says yes for a "delete expedition"
        await supabase.from('outbound_log').delete().eq('tbr_id', id);

        setStockItems(prev => prev.map(stock =>
            stock.id === id ? { ...stock, status: 'Em Estoque' } : stock
        ));
        playAudio('success');
    };


    const addDriver = async (driverData: Omit<Driver, 'id' | 'lastActivity'>) => {
        const nowStr = new Date().toLocaleString('pt-BR');
        const { data, error } = await supabase.from('drivers').insert({
            name: driverData.name,
            cpf: driverData.cpf,
            plate: driverData.plate,
            vehicle: driverData.vehicleProfile,
            status: driverData.status,
            company_id: currentUser?.company_id,
            last_activity: nowStr
        }).select().single();

        if (data && !error) {
            setDrivers(prev => [...prev, {
                id: data.id,
                name: data.name,
                cpf: data.cpf,
                plate: data.plate,
                company: data.company_id,
                status: data.status,
                vehicleProfile: data.vehicle,
                lastActivity: data.last_activity
            }]);
            playAudio('success');
        } else {
            console.error('WmsContext: Error adding driver', error);
            playAudio('error');
        }
    };

    const bulkAddDrivers = async (driversList: Omit<Driver, 'id' | 'lastActivity'>[]) => {
        const newDrivers = driversList.map(d => ({
            name: d.name,
            cpf: d.cpf,
            plate: d.plate,
            vehicle: d.vehicleProfile,
            status: d.status,
            company_id: currentUser?.company_id,
            last_activity: new Date().toLocaleString('pt-BR')
        }));

        const { data, error } = await supabase.from('drivers').insert(newDrivers).select();
        if (data && !error) {
            setDrivers(prev => [...prev, ...data.map(d => ({
                id: d.id,
                name: d.name,
                cpf: d.cpf,
                plate: d.plate,
                company: d.company_id,
                status: d.status,
                vehicleProfile: d.vehicle,
                lastActivity: d.last_activity
            }))]);
            playAudio('success');
        } else {
            console.error('WmsContext: Bulk add drivers error', error);
            playAudio('error');
        }
    };

    const updateDriver = async (id: string, updates: Partial<Driver>) => {
        const dbUpdates: any = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.cpf) dbUpdates.cpf = updates.cpf;
        if (updates.plate) dbUpdates.plate = updates.plate;
        if (updates.status) dbUpdates.status = updates.status;
        if (updates.vehicleProfile) dbUpdates.vehicle = updates.vehicleProfile;

        await supabase.from('drivers').update(dbUpdates).eq('id', id);
        setDrivers(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d));
    };

    const deleteDriver = async (id: string) => {
        await supabase.from('drivers').delete().eq('id', id);
        setDrivers(prev => prev.filter(d => d.id !== id));
    };

    const [isInventoryActive, setIsInventoryActive] = useState(false);

    const addInventoryItem = async (item: InventoryItem) => {
        if (inventoryItems.some(i => i.id === item.id)) {
            playAudio('error');
            return;
        }
        setInventoryItems(prev => [item, ...prev]);
        playAudio('success');
    };

    const startInventory = async () => {
        setIsInventoryActive(true);
        setInventoryItems([]);
    };

    const stopInventory = async () => {
        setIsInventoryActive(false);
        const missingItems = stockItems.filter(stock =>
            stock.status === 'Em Estoque' && !inventoryItems.some(inv => inv.id === stock.id)
        );

        const now = new Date().toISOString();
        const activeTreatmentTbrs = treatmentItems
            .filter(t => t.status !== 'Resolvido')
            .map(t => t.tbrId);

        const idsToMark = stockItems
            .filter(stock => (missingItems.some(m => m.id === stock.id) || activeTreatmentTbrs.includes(stock.id)) && stock.status === 'Em Estoque')
            .map(s => s.id);

        if (idsToMark.length > 0) {
            await supabase.from('stock')
                .update({ status: 'Possível Perda', loss_detected_time: now })
                .in('id', idsToMark);
        }

        setStockItems(prev => prev.map(stock => {
            if (idsToMark.includes(stock.id)) {
                return { ...stock, status: 'Possível Perda', loss_detected_time: stock.lossDetectedTime || now };
            }
            return stock;
        }));

        setPossibleLossItems(prev => {
            // Need to calculate based on updated items
            return stockItems.map(stock => {
                if (idsToMark.includes(stock.id)) {
                    return { ...stock, status: 'Possível Perda' as const, loss_detected_time: stock.lossDetectedTime || now };
                }
                return stock;
            }).filter(s => s.status === 'Possível Perda');
        });
    };

    const localizeItem = async (id: string, scannerInput: string) => {
        if (id !== scannerInput) {
            playAudio('error');
            return { success: false, message: 'ID da TBR não confere!' };
        }

        const item = stockItems.find(s => s.id === id);
        if (!item) return { success: false, message: 'Item não encontrado!' };

        if (item.lossDetectedTime) {
            const lossTime = new Date(item.lossDetectedTime).getTime();
            const now = new Date().getTime();
            const hoursElapsed = (now - lossTime) / (1000 * 60 * 60);

            if (hoursElapsed > 72) {
                await supabase.from('stock').update({ status: 'Perda' }).eq('id', id);
                setStockItems(prev => prev.map(s => s.id === id ? { ...s, status: 'Perda' } : s));
                setPossibleLossItems(prev => prev.filter(p => p.id !== id));
                playAudio('error');
                return { success: false, message: 'Tempo limite de 72h excedido. Item marcado como Perda definitiva.' };
            }
        }

        await supabase.from('stock').update({ status: 'Em Estoque', loss_detected_time: null }).eq('id', id);
        setStockItems(prev => prev.map(s => s.id === id ? { ...s, status: 'Em Estoque', lossDetectedTime: undefined } : s));
        setPossibleLossItems(prev => prev.filter(p => p.id !== id));
        playAudio('success');
        return { success: true, message: `TBR ${id} localizada com sucesso!` };
    };

    const verifyStock = async (id: string) => {
        const item = stockItems.find(s => s.id === id.toUpperCase());
        if (!item) {
            return { success: false, message: `TBR ${id} não encontrada no estoque.` };
        }
        if (item.status !== 'Em Estoque') {
            return { success: false, message: `TBR ${id} está com status: ${item.status}.` };
        }
        return { success: true, message: 'Item validado.' };
    };


    const addTreatment = async (itemData: Omit<TreatmentItem, 'id' | 'time' | 'status'>) => {
        const existingActive = treatmentItems.find(t => t.tbrId === itemData.tbrId && t.status !== 'Resolvido');
        if (existingActive) {
            playAudio('error');
            return { success: false, message: `Já existe uma tratativa ativa (${existingActive.id}) para esta TBR.` };
        }

        const trtId = `TRT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const now = new Date().toISOString();

        const { error } = await supabase.from('incidents').insert({
            id: trtId,
            tbr_id: itemData.tbrId,
            type: itemData.type,
            description: itemData.description,
            status: 'Pendente',
            operator: itemData.operator,
            company_id: currentUser?.company_id,
            time: now
        });

        if (error) {
            console.error('WmsContext: Error saving incident', error);
            playAudio('error');
            return { success: false, message: 'Erro ao salvar incidente: ' + error.message };
        }

        const newItem: TreatmentItem = {
            ...itemData,
            id: trtId,
            time: new Date().toLocaleString('pt-BR'),
            status: 'Pendente'
        };
        setTreatmentItems(prev => [newItem, ...prev]);

        if (itemData.type === 'Extravio' || itemData.type === 'Avaria') {
            await supabase.from('stock')
                .update({ status: 'Possível Perda', loss_detected_time: now })
                .eq('id', itemData.tbrId);

            setStockItems(prev => prev.map(s =>
                s.id === itemData.tbrId
                    ? { ...s, status: 'Possível Perda', lossDetectedTime: s.lossDetectedTime || now }
                    : s
            ));
        }

        playAudio('success');
        return { success: true, message: 'Incidente registrado com sucesso.' };
    };

    const updateTreatmentStatus = async (id: string, status: TreatmentItem['status']) => {
        await supabase.from('incidents').update({ status }).eq('id', id);
        setTreatmentItems(prev => prev.map(t => t.id === id ? { ...t, status } : t));
    };

    const updateTreatment = async (id: string, updates: Partial<Pick<TreatmentItem, 'type' | 'description'>>) => {
        await supabase.from('incidents').update(updates).eq('id', id);
        setTreatmentItems(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
        playAudio('success');
    };

    // --- Auth & User Management Logic (Removed redundant state declarations here) ---

    useEffect(() => {
        const loadUsers = async () => {
            if (!currentUser) return;
            const allUsers = await AuthService.getUsers();
            setUsers(allUsers);
        };
        loadUsers();
    }, [currentUser]); // Refresh users when admin logs in

    const login = async (email: string, password: string) => {
        console.log('WmsContext: login attempt for', email);
        const result = await AuthService.login(email, password);
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
        const allUsers = await AuthService.getUsers();
        setUsers(allUsers);
    };

    const updateUserStatus = async (id: string, status: UserStatus, role?: Role | null) => {
        await AuthService.updateUserStatus(id, status, role);
        await refreshUsers();
    };

    const updateUser = async (originalId: string, updates: Partial<User>) => {
        const result = await AuthService.updateUser(originalId, updates);
        await refreshUsers();

        // If the updated user is the current user, update the state to reflect changes (like name or ID)
        if (currentUser && currentUser.id === originalId) {
            const allUsers = await AuthService.getUsers();
            const updated = allUsers.find(u => u.id === (updates.id || originalId));
            if (updated) {
                setCurrentUser(updated);
                // Also update stored session to persist after refresh
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
        // Refresh currentUser state to reflect the change in force_password_reset flag
        if (result.success && currentUser) {
            setCurrentUser({ ...currentUser, force_password_reset: false });
        }
        return result;
    };

    // --- Reset Logic ---
    const resetTransactions = async () => {
        if (!currentUser) return;
        const cid = currentUser.company_id;

        setInboundItems([]);
        setOutboundItems([]);
        setStockItems([]);
        setInventoryItems([]);
        setPossibleLossItems([]);
        setExpectedInboundList([]);

        try {
            // Wipe Supabase tables for THIS company only
            await supabase.from('inbound_log').delete().eq('company_id', cid);
            await supabase.from('outbound_log').delete().eq('company_id', cid);
            await supabase.from('stock').delete().eq('company_id', cid);
            await supabase.from('system_config').delete().eq('key', 'expected_inbound').eq('company_id', cid);
            await supabase.from('incidents').delete().eq('company_id', cid); // Also wipe incidents for safety if resetting all

            playAudio('success');
        } catch (e) {
            console.error('WmsContext: Error resetting transactions', e);
            playAudio('error');
        }
    };

    // --- Stats ---
    const totalInboundToday = new Set(inboundItems.filter(item => !item.error).map(item => item.id)).size;
    const totalOutboundToday = new Set(outboundItems.filter(item => item.status === 'Saiu com Motorista').map(item => item.id)).size;
    const totalReversaToday = new Set(outboundItems.filter(item => item.status === 'Reversa - Saiu com Motorista').map(item => item.id)).size;
    const totalInventoryScanned = inventoryItems.length;
    const totalLossItems = stockItems.filter(s => s.status === 'Perda').length;

    const staleStockItems = stockItems.filter(item => {
        if (item.status !== 'Em Estoque') return false;
        try {
            const now = new Date().getTime();
            // entryTime is now kept as ISO string in the state for robustness
            const entryDate = new Date(item.entryTime).getTime();
            if (isNaN(entryDate)) return false;
            return (now - entryDate) / (1000 * 60 * 60) > 24;
        } catch (e) {
            return false;
        }
    });

    const staleItemsCount = staleStockItems.length;

    return (
        <WmsContext.Provider value={{
            inboundItems, addInboundItem, expectedInboundList, setExpectedInboundList,
            outboundItems, addOutboundItem, deleteOutboundItem,
            inventoryItems, addInventoryItem, isInventoryActive, startInventory, stopInventory, stockItems, possibleLossItems,
            staleStockItems,
            localizeItem,
            treatmentItems, addTreatment, updateTreatmentStatus, updateTreatment,
            users, refreshUsers, updateUserStatus, updateUser, deleteUser,
            drivers, addDriver, bulkAddDrivers, updateDriver, deleteDriver,
            currentUser, login, logout, register,
            currentView, setCurrentView,
            totalInboundToday, totalOutboundToday, totalReversaToday, totalInventoryScanned, totalLossItems, staleItemsCount,
            weeklyStats,
            resetTransactions,
            verifyStock,
            inviteUser, updatePassword,
            playAudio
        }}>
            {children}
        </WmsContext.Provider>
    );
};

export const useWms = () => useContext(WmsContext);
