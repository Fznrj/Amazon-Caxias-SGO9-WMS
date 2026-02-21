import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Driver, Role, UserStatus, VehicleProfile, View } from '../types';
import { AuthService } from '../services/authService';
import { gamificationService } from '../services/gamificationService';
import { supabase } from '../services/supabase';
import { isSameDay, parseToDate, getDateKey } from '../utils/dateUtils';

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
    isToday: (timeStr: string) => boolean;
    getSystemDate: () => string;

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

    // Force profile refresh from DB to ensure correct company_id and role
    useEffect(() => {
        const refreshProfile = async () => {
            const stored = AuthService.getCurrentUser();
            if (stored) {
                const { data: fresh } = await supabase
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
        if (!currentUser) {
            console.log('WmsContext: Skipping loadInitialData - no currentUser');
            return;
        }

        try {
            const companyId = currentUser.company_id;
            console.log('WmsContext: Batch loading data for company:', `"${companyId}"`);

            const [
                { data: stock, error: se },
                { data: inbound, error: ie },
                { data: outbound, error: oe },
                { data: driversData, error: de },
                { data: incidents, error: incE },
                { data: config, error: confE },
                { data: inventory, error: invE }
            ] = await Promise.all([
                supabase.from('stock_items').select('*').eq('company_id', companyId),
                supabase.from('inbound_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
                supabase.from('outbound_log').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
                supabase.from('drivers').select('*').eq('company_id', companyId),
                supabase.from('incidents').select('*').eq('company_id', companyId).order('created_at', { ascending: false }),
                supabase.from('system_configs').select('expected_inbound').eq('company_id', companyId).maybeSingle(),
                supabase.from('inventory_log').select('*').eq('company_id', companyId)
            ]);

            // Handle Stock
            if (se) console.error('WmsContext: Stock fetch error:', se);
            else if (stock) {
                const mappedStock = stock.map(s => ({
                    id: s.id,
                    entryTime: s.entry_time,
                    operator: s.operator,
                    status: s.status,
                    lossDetectedTime: s.loss_detected_time,
                    localizedBy: s.localized_by,
                    rackLocation: s.rack_location
                }));
                setStockItems(mappedStock);
                setPossibleLossItems(mappedStock.filter(s => s.status === 'Possível Perda'));
            }

            // Handle Inbound
            if (ie) console.error('WmsContext: Inbound fetch error:', ie);
            else if (inbound) setInboundItems(inbound);

            // Handle Outbound
            if (oe) console.error('WmsContext: Outbound fetch error:', oe);
            else if (outbound) {
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

            // Handle Drivers
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

            // Handle Incidents
            if (incE) console.error('WmsContext: Incidents fetch error:', incE);
            else if (incidents) setTreatmentItems(incidents);

            // Handle Config
            if (confE) console.error('WmsContext: Config fetch error:', confE);
            else if (config?.expected_inbound) _setExpectedInboundList(config.expected_inbound);

            // Handle Inventory
            if (invE) console.error('WmsContext: Inventory fetch error:', invE);
            else if (inventory) setInventoryItems(inventory);

            // Initialize Gamification
            await gamificationService.init(companyId);

        } catch (err) {
            console.error('WmsContext: Unexpected error in loadInitialData:', err);
        }
    };

    // --- Realtime Implementation ---
    useEffect(() => {
        if (!currentUser) return;

        const companyId = currentUser.company_id;

        const channels = [
            supabase.channel('wms_realtime_all')
                .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                    console.log('WmsContext: Realtime event received:', payload.table, payload.eventType);
                    // Proactive reload for specific table updates
                    loadInitialData();
                })
                .subscribe((status) => {
                    console.log('WmsContext: Realtime subscription status:', status);
                })
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
            const timestamp = (log as any).created_at || log.time;
            const dateKey = getDateKey(timestamp);
            if (statsMap[dateKey]) statsMap[dateKey].entradas++;
        });

        outboundItems.forEach((log: OutboundItem) => {
            const timestamp = (log as any).created_at || log.time;
            const dateKey = getDateKey(timestamp);
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
        const enrichedItem = { ...item, time: now };

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
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser.company_id);
        }

        // Save to Supabase
        const { error } = await supabase.from('inbound_log').insert({
            ...enrichedItem,
            company_id: currentUser?.company_id
        });

        if (error) {
            console.error('WmsContext: Error adding inbound item:', error);
            playAudio('error');
            return;
        }

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
                ? {
                    entry_time: now,
                    operator: item.operator,
                    status: 'Em Estoque' as const,
                    loss_detected_time: null,
                    company_id: currentUser?.company_id
                }
                : {
                    id: item.id,
                    entry_time: now,
                    operator: item.operator,
                    status: 'Em Estoque' as const,
                    company_id: currentUser?.company_id
                };

            await supabase.from('stock_items').upsert(stockData);

            // Re-fetch will happen via Realtime, but for responsiveness:
            loadInitialData();

            playAudio('success');
        } else {
            playAudio('error');
        }
    };

    const addOutboundItem = async (item: OutboundItem) => {
        const enrichedItem = { ...item, time: new Date().toISOString() };
        if (currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser.company_id);

            const { error: insE } = await supabase.from('outbound_log').insert({
                id: enrichedItem.id,
                driver_name: enrichedItem.driverName,
                vehicle: enrichedItem.vehicle,
                time: enrichedItem.time,
                operator: enrichedItem.operator,
                status: enrichedItem.status,
                company_id: currentUser.company_id
            });

            if (insE) {
                console.error('WmsContext: Error adding outbound item:', insE);
                playAudio('error');
                return;
            }

            const { error: updE } = await supabase.from('stock_items')
                .update({ status: 'Saiu' })
                .eq('id', item.id)
                .eq('company_id', currentUser.company_id);

            if (updE) console.error('WmsContext: Error updating stock on outbound:', updE);
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
        const newDriverId = 'dr-' + Math.random().toString(36).substr(2, 9);
        const now = new Date().toISOString();

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
        playAudio('success');
    };

    const bulkAddDrivers = async (driversList: Omit<Driver, 'id' | 'lastActivity'>[]) => {
        if (!currentUser) return;
        const now = new Date().toISOString();
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
        if (currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser.company_id);
        }

        const { error } = await supabase.from('inventory_log').insert({
            ...item,
            company_id: currentUser.company_id
        });

        if (error) {
            console.error('WmsContext: Error adding inventory item:', error);
            playAudio('error');
            return;
        }

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
                localized_by: item.status === 'Possível Perda' ? (currentUser?.name || 'Sistema') : item.localizedBy,
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
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser.company_id);
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
            id: trtId,
            tbr_id: itemData.tbrId,
            type: itemData.type,
            description: itemData.description,
            operator: itemData.operator,
            time: displayTime,
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

    const getSystemDate = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const isToday = (timeStr: string) => {
        if (!timeStr) return false;
        return isSameDay(timeStr);
    };

    const totalInboundToday = inboundItems.filter(item => {
        if (item.error) return false;
        // Favor created_at if it's in the item (Supabase usually returns it)
        const timestamp = (item as any).created_at || item.time;
        return isToday(timestamp);
    }).length;

    const totalOutboundToday = outboundItems.filter(item => {
        if (item.status !== 'Saiu com Motorista') return false;
        const timestamp = (item as any).created_at || item.time;
        return isToday(timestamp);
    }).length;

    const totalReversaToday = outboundItems.filter(item => {
        if (item.status !== 'Reversa - Saiu com Motorista') return false;
        const timestamp = (item as any).created_at || item.time;
        return isToday(timestamp);
    }).length;

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
            currentUser, login, logout, register,
            currentView, setCurrentView,
            inboundItems, addInboundItem, expectedInboundList, setExpectedInboundList, clearInboundManifest,
            outboundItems, addOutboundItem, deleteOutboundItem,
            inventoryItems, addInventoryItem, isInventoryActive, startInventory, stopInventory,
            stockItems, possibleLossItems, staleStockItems,
            drivers, addDriver, bulkAddDrivers, updateDriver, deleteDriver,
            treatmentItems, addTreatment, updateTreatmentStatus, updateTreatment,
            users, refreshUsers, updateUserStatus, updateUser, deleteUser,
            isToday, getSystemDate,
            totalInboundToday, totalOutboundToday, totalReversaToday, totalInventoryScanned, totalLossItems, staleItemsCount,
            weeklyStats,
            resetTransactions,
            verifyStock,
            inviteUser, updatePassword,
            localizeItem,
            playAudio
        }}>
            {children}
        </WmsContext.Provider>
    );
};

export const useWms = () => useContext(WmsContext);
