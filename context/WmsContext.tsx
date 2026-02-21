import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Driver, Role, UserStatus, VehicleProfile, View } from '../types';
import { AuthService } from '../services/authService';
import { gamificationService } from '../services/gamificationService';
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

// UserItem is now just User from types.ts
// Removed legacy UserItem interface

interface WmsContextData {
    // Inbound
    inboundItems: InboundItem[];
    addInboundItem: (item: InboundItem) => Promise<void>;
    expectedInboundList: string[];
    setExpectedInboundList: (list: string[]) => Promise<void>;
    clearInboundManifest: () => Promise<void>;

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
    weeklyStats: { name: string; entradas: number; saidas: number }[];
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

    // Offline mode: Trust AuthService for session
    useEffect(() => {
        const user = AuthService.getCurrentUser();
        if (user) {
            setCurrentUser(user);
        } else {
            _setCurrentView(View.LOGIN);
        }
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

    // --- Local Storage Keys ---
    const STORAGE_KEYS = {
        STOCK: 'wms_stock',
        INBOUND_LOG: 'wms_inbound_log',
        OUTBOUND_LOG: 'wms_outbound_log',
        DRIVERS: 'wms_drivers',
        INCIDENTS: 'wms_incidents',
        CONFIG: 'wms_system_config',
        INVENTORY_LOG: 'wms_inventory_log'
    };

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
        if (!currentUser) return;

        try {
            const companyId = currentUser.company_id;

            // 1. Stock & Possible Loss
            const { data: stock } = await supabase
                .from('stock_items')
                .select('*')
                .eq('company_id', companyId);

            if (stock) {
                const mappedStock = stock.map(s => ({
                    id: s.id,
                    entryTime: s.entry_time, // Supabase returns ISO usually or we can cast
                    operator: s.operator,
                    status: s.status,
                    lossDetectedTime: s.loss_detected_time,
                    localizedBy: s.localized_by,
                    rackLocation: s.rack_location
                }));
                setStockItems(mappedStock);
                setPossibleLossItems(mappedStock.filter(s => s.status === 'Possível Perda'));
            }

            // 2. Inbound Log
            const { data: inbound } = await supabase
                .from('inbound_log')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (inbound) setInboundItems(inbound);

            // 3. Outbound Log
            const { data: outbound } = await supabase
                .from('outbound_log')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (outbound) {
                const mappedOutbound = outbound.map(o => ({
                    id: o.id,
                    driverName: o.driver_name,
                    vehicle: o.vehicle,
                    time: o.time,
                    operator: o.operator,
                    status: o.status
                }));
                setOutboundItems(mappedOutbound);
            }

            // 4. Drivers
            const { data: driversData } = await supabase
                .from('drivers')
                .select('*')
                .eq('company_id', companyId);
            if (driversData) {
                const mappedDrivers = driversData.map(d => ({
                    id: d.id,
                    name: d.name,
                    badge: d.badge,
                    vehicle_type: d.vehicle_type,
                    lastActivity: d.last_activity
                }));
                setDrivers(mappedDrivers);
            }

            // 5. Incidents
            const { data: incidents } = await supabase
                .from('incidents')
                .select('*')
                .eq('company_id', companyId)
                .order('created_at', { ascending: false });
            if (incidents) setTreatmentItems(incidents);

            // 6. Config
            const { data: config } = await supabase
                .from('system_configs')
                .select('expected_inbound')
                .eq('company_id', companyId)
                .maybeSingle();
            if (config?.expected_inbound) _setExpectedInboundList(config.expected_inbound);

            // 7. Inventory
            const { data: inventory } = await supabase
                .from('inventory_log')
                .select('*')
                .eq('company_id', companyId);
            if (inventory) setInventoryItems(inventory);

        } catch (err) {
            console.error('WmsContext: Error loading Supabase data:', err);
        }
    };

    // --- Realtime Implementation ---
    useEffect(() => {
        if (!currentUser) return;

        const companyId = currentUser.company_id;

        const channels = [
            supabase.channel('stock_realtime')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_items', filter: `company_id=eq.${companyId}` },
                    () => loadInitialData())
                .subscribe(),

            supabase.channel('logs_realtime')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'inbound_log', filter: `company_id=eq.${companyId}` },
                    () => loadInitialData())
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'outbound_log', filter: `company_id=eq.${companyId}` },
                    () => loadInitialData())
                .subscribe()
        ];

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel));
        };
    }, [currentUser]);

    const weeklyStats = React.useMemo(() => {
        const statsMap: Record<string, { name: string, entradas: number, saidas: number }> = {};
        const today = new Date();

        for (let i = 6; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const label = d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
            const dateKey = d.toLocaleDateString('pt-BR');
            statsMap[dateKey] = {
                name: label.charAt(0).toUpperCase() + label.slice(1),
                entradas: 0,
                saidas: 0
            };
        }

        inboundItems.forEach((log: InboundItem) => {
            if (log.error) return;
            const dateKey = log.time.split(', ')[0];
            if (statsMap[dateKey]) statsMap[dateKey].entradas++;
        });

        outboundItems.forEach((log: OutboundItem) => {
            const dateKey = log.time.split(', ')[0];
            if (statsMap[dateKey]) statsMap[dateKey].saidas++;
        });

        return Object.values(statsMap);
    }, [inboundItems, outboundItems]);

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
        const now = new Date().toISOString();
        const displayTime = new Date().toLocaleString('pt-BR');
        const enrichedItem = { ...item, time: displayTime };

        // 72h rule check (simplified for offline)
        const stockItem = stockItems.find(s => s.id === item.id);
        if (stockItem?.status === 'Possível Perda' && stockItem.lossDetectedTime) {
            const lossTime = new Date(stockItem.lossDetectedTime).getTime();
            const hoursElapsed = (Date.now() - lossTime) / (1000 * 60 * 60);

            if (hoursElapsed > 72) {
                const errorLog: InboundItem = { ...enrichedItem, status: 'Perda Definitiva', error: true };
                setInboundItems(prev => [errorLog, ...prev]);
                saveLocal(STORAGE_KEYS.INBOUND_LOG, [errorLog, ...inboundItems]);

                setStockItems(prev => prev.map(s => s.id === item.id ? { ...s, status: 'Perda' } : s));
                saveLocal(STORAGE_KEYS.STOCK, stockItems.map(s => s.id === item.id ? { ...s, status: 'Perda' } : s));

                playAudio('error');
                return;
            }
        }

        if (item.status === 'Sucesso' && currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name);
        }

        // Save to Supabase
        await supabase.from('inbound_log').insert({
            ...enrichedItem,
            company_id: currentUser?.company_id
        });

        // Optimistic update
        setInboundItems(prev => [enrichedItem, ...prev]);

        if (!item.error) {
            // 1. Resolve treatments
            const updatedTreatments = treatmentItems.map(t =>
                (t.tbrId === item.id && t.status !== 'Resolvido') ? { ...t, status: 'Resolvido' as const } : t
            );
            setTreatmentItems(updatedTreatments);

            if (currentUser) {
                await supabase.from('incidents')
                    .update({ status: 'Resolvido' })
                    .eq('tbr_id', item.id)
                    .eq('company_id', currentUser.company_id);
            }

            // 2. Update Stock in Supabase
            const exists = stockItems.find(s => s.id === item.id);
            const stockData = exists
                ? { entryTime: now, operator: item.operator, status: 'Em Estoque' as const, loss_detected_time: null, company_id: currentUser?.company_id }
                : { id: item.id, entryTime: now, operator: item.operator, status: 'Em Estoque' as const, company_id: currentUser?.company_id };

            await supabase.from('stock_items').upsert(stockData);

            // Re-fetch will happen via Realtime, but for responsiveness:
            loadInitialData();

            playAudio('success');
        } else {
            playAudio('error');
        }
    };

    const addOutboundItem = async (item: OutboundItem) => {
        const enrichedItem = { ...item, time: new Date().toLocaleString('pt-BR') };
        if (currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name);

            await supabase.from('outbound_log').insert({
                ...enrichedItem,
                company_id: currentUser.company_id
            });

            await supabase.from('stock_items')
                .update({ status: 'Saiu' })
                .eq('id', item.id)
                .eq('company_id', currentUser.company_id);
        }

        // Realtime will handle the update
        playAudio('success');
    };

    const deleteOutboundItem = async (id: string) => {
        setOutboundItems(prev => {
            const updated = prev.filter(item => item.id !== id);
            saveLocal(STORAGE_KEYS.OUTBOUND_LOG, updated);
            return updated;
        });
        setStockItems(prev => {
            const updated = prev.map(s => s.id === id ? { ...s, status: 'Em Estoque' as const } : s);
            saveLocal(STORAGE_KEYS.STOCK, updated);
            return updated;
        });
        playAudio('success');
    };


    const addDriver = async (driverData: Omit<Driver, 'id' | 'lastActivity'>) => {
        if (!currentUser) return;
        const newDriver: Driver = {
            ...driverData,
            id: 'dr-' + Math.random().toString(36).substr(2, 9),
            lastActivity: new Date().toLocaleString('pt-BR')
        };
        await supabase.from('drivers').insert({ ...newDriver, company_id: currentUser.company_id });
        playAudio('success');
    };

    const bulkAddDrivers = async (driversList: Omit<Driver, 'id' | 'lastActivity'>[]) => {
        if (!currentUser) return;
        const now = new Date().toLocaleString('pt-BR');
        const newOnes = driversList.map(d => ({
            ...d,
            id: 'dr-' + Math.random().toString(36).substr(2, 9),
            lastActivity: now,
            company_id: currentUser.company_id
        }));
        await supabase.from('drivers').insert(newOnes);
        playAudio('success');
    };

    const updateDriver = async (id: string, updates: Partial<Driver>) => {
        if (!currentUser) return;
        await supabase.from('drivers')
            .update(updates)
            .eq('id', id)
            .eq('company_id', currentUser.company_id);
    };

    const deleteDriver = async (id: string) => {
        if (!currentUser) return;
        await supabase.from('drivers')
            .delete()
            .eq('id', id)
            .eq('company_id', currentUser.company_id);
    };

    const [isInventoryActive, setIsInventoryActive] = useState(false);

    const addInventoryItem = async (item: InventoryItem) => {
        if (!currentUser) return;
        if (inventoryItems.some(i => i.id === item.id)) {
            playAudio('error');
            return;
        }
        await gamificationService.registerScan(currentUser.id, currentUser.name);

        await supabase.from('inventory_log').insert({
            ...item,
            company_id: currentUser.company_id
        });

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
            .filter(s => s.status === 'Em Estoque' && !inventoryItems.some(inv => inv.id === s.id))
            .map(s => s.id);

        const now = new Date().toISOString();

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
        if (id !== scannerInput) {
            playAudio('error');
            return { success: false, message: 'ID da TBR não confere!' };
        }

        const item = stockItems.find(s => s.id === id);
        if (!item) return { success: false, message: 'Item não encontrado!' };

        if (item.lossDetectedTime) {
            const hoursElapsed = (Date.now() - new Date(item.lossDetectedTime).getTime()) / (1000 * 60 * 60);
            if (hoursElapsed > 72) {
                const updated = stockItems.map(s => s.id === id ? { ...s, status: 'Perda' as const } : s);
                setStockItems(updated);
                saveLocal(STORAGE_KEYS.STOCK, updated);
                setPossibleLossItems(updated.filter(p => p.status === 'Possível Perda'));
                playAudio('error');
                return { success: false, message: 'Tempo limite de 72h excedido. Item marcado como Perda definitiva.' };
            }
        }

        // Check if the item is already in stock and if the scannerInput is a valid rack location
        // For now, we assume scannerInput is the rack location if it's not the item ID itself.
        // If scannerInput is the item ID, it means we are just confirming its presence.
        if (item && item.status === 'Em Estoque' && id !== scannerInput) {
            // If the item is already in stock and the scanner input is different,
            // it means we are re-allocating it to a new rack.
            const updated = stockItems.map(s => s.id === id ? { ...s, rackLocation: scannerInput } : s);
            setStockItems(updated);
            saveLocal(STORAGE_KEYS.STOCK, updated);
            playAudio('success');
            return { success: true, message: `Item ${id} realocado para o rack ${scannerInput}.` };
        }

        // If the item is not in stock or is a possible loss, we are localizing it.
        if (item) {
            // Se o item estava como "Possível Perda", atualizamos para "Em Estoque" e logamos quem achou
            const updates = {
                status: 'Em Estoque' as const,
                entry_time: new Date().toISOString(),
                operator: currentUser?.name || 'Sistema',
                loss_detected_time: null,
                localized_by: item.status === 'Possível Perda' ? (currentUser?.name || 'Sistema') : item.localized_by,
                rack_location: scannerInput
            };

            await supabase.from('stock_items')
                .update(updates)
                .eq('id', id)
                .eq('company_id', currentUser.company_id);

            playAudio('success');
            return { success: true, message: `Item ${id} localizado e re-alocado no rack ${scannerInput}.` };
        }


        if (currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name);
        }

        const updated = stockItems.map(s => s.id === id ? { ...s, status: 'Em Estoque' as const, lossDetectedTime: undefined } : s);
        setStockItems(updated);
        saveLocal(STORAGE_KEYS.STOCK, updated);
        setPossibleLossItems(updated.filter(p => p.status === 'Possível Perda'));
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
        if (!currentUser) return { success: false, message: 'Não logado' };
        const existingActive = treatmentItems.find(t => t.tbrId === itemData.tbrId && t.status !== 'Resolvido');
        if (existingActive) {
            playAudio('error');
            return { success: false, message: `Já existe uma tratativa ativa (${existingActive.id}) para esta TBR.` };
        }

        const trtId = `TRT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const now = new Date().toISOString();
        const displayTime = new Date().toLocaleString('pt-BR');

        const newItem = {
            ...itemData,
            id: trtId,
            time: displayTime,
            status: 'Pendente',
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

        playAudio('success');
        return { success: true, message: 'Incidente registrado com sucesso.' };
    };

    const updateTreatmentStatus = async (id: string, status: TreatmentItem['status']) => {
        if (!currentUser) return;
        await supabase.from('incidents')
            .update({ status })
            .eq('id', id)
            .eq('company_id', currentUser.company_id);
    };

    const updateTreatment = async (id: string, updates: Partial<Pick<TreatmentItem, 'type' | 'description'>>) => {
        if (!currentUser) return;
        await supabase.from('incidents')
            .update(updates)
            .eq('id', id)
            .eq('company_id', currentUser.company_id);
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
        const companyId = currentUser.company_id;

        await supabase.from('inbound_log').delete().eq('company_id', companyId);
        await supabase.from('outbound_log').delete().eq('company_id', companyId);
        await supabase.from('stock_items').delete().eq('company_id', companyId);
        await supabase.from('incidents').delete().eq('company_id', companyId);
        await supabase.from('inventory_log').delete().eq('company_id', companyId);
        await supabase.from('system_configs').update({ expected_inbound: [] }).eq('company_id', companyId);

        loadInitialData();
        playAudio('success');
    };

    // --- Stats ---
    const getTodayRange = () => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return { start, end };
    };

    const isToday = (timeStr: string) => {
        if (!timeStr) return false;
        try {
            // Robust check: compare date parts directly from locale string
            const todayStr = new Date().toLocaleDateString('pt-BR');
            const itemDateStr = timeStr.split(', ')[0];
            return todayStr === itemDateStr;
        } catch (e) {
            return false;
        }
    };

    const totalInboundToday = inboundItems.filter(item => !item.error && isToday(item.time)).length;

    const totalOutboundToday = outboundItems.filter(item =>
        item.status === 'Saiu com Motorista' && isToday(item.time)
    ).length;

    const totalReversaToday = outboundItems.filter(item =>
        item.status === 'Reversa - Saiu com Motorista' && isToday(item.time)
    ).length;

    const totalInventoryScanned = inventoryItems.length;
    const totalLossItems = stockItems.filter(s => s.status === 'Perda').length;

    const staleStockItems = stockItems.filter(item => {
        if (item.status !== 'Em Estoque') return false;
        try {
            const now = new Date().getTime();
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
            inboundItems, addInboundItem, expectedInboundList, setExpectedInboundList, clearInboundManifest,
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
