import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Driver, Role, UserStatus, VehicleProfile, View } from '../types';
import { AuthService } from '../services/authService';
import { gamificationService } from '../services/gamificationService';
// import { supabase } from '../services/supabase'; // Mocked but unused in Context now

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

    const loadInitialData = () => {
        try {
            const config = loadLocal(STORAGE_KEYS.CONFIG, {});
            if (config.expected_inbound) _setExpectedInboundList(config.expected_inbound);
            setDrivers(loadLocal(STORAGE_KEYS.DRIVERS));
            setTreatmentItems(loadLocal(STORAGE_KEYS.INCIDENTS));
            const stock = loadLocal(STORAGE_KEYS.STOCK);
            setStockItems(stock);
            setPossibleLossItems(stock.filter((s: StockItem) => s.status === 'Possível Perda'));
            setInboundItems(loadLocal(STORAGE_KEYS.INBOUND_LOG));
            setOutboundItems(loadLocal(STORAGE_KEYS.OUTBOUND_LOG));
            setInventoryItems(loadLocal(STORAGE_KEYS.INVENTORY_LOG));

        } catch (err) {
            console.error('WmsContext: Error loading local data:', err);
        }
    };

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
        _setExpectedInboundList([]);
        const config = loadLocal(STORAGE_KEYS.CONFIG, {});
        saveLocal(STORAGE_KEYS.CONFIG, { ...config, expected_inbound: [] });
    };

    const setExpectedInboundList = async (list: string[]) => {
        _setExpectedInboundList(list);
        const config = loadLocal(STORAGE_KEYS.CONFIG, {});
        saveLocal(STORAGE_KEYS.CONFIG, { ...config, expected_inbound: list });
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

        setInboundItems(prev => {
            const updated = [enrichedItem, ...prev];
            saveLocal(STORAGE_KEYS.INBOUND_LOG, updated);
            return updated;
        });

        if (!item.error) {
            // 1. Resolve treatments
            const updatedTreatments = treatmentItems.map(t =>
                (t.tbrId === item.id && t.status !== 'Resolvido') ? { ...t, status: 'Resolvido' as const } : t
            );
            setTreatmentItems(updatedTreatments);
            saveLocal(STORAGE_KEYS.INCIDENTS, updatedTreatments);

            // 2. Update Stock
            setStockItems(prev => {
                const exists = prev.find(s => s.id === item.id);
                const updated = exists
                    ? prev.map(s => s.id === item.id ? { ...s, entryTime: now, operator: item.operator, status: 'Em Estoque' as const, lossDetectedTime: undefined } : s)
                    : [...prev, { id: item.id, entryTime: now, operator: item.operator, status: 'Em Estoque' as const }];
                saveLocal(STORAGE_KEYS.STOCK, updated);

                // 3. Update Possible Loss list synchronized with the new stock update
                setPossibleLossItems(updated.filter(p => p.status === 'Possível Perda'));

                return updated;
            });

            playAudio('success');
        } else {
            playAudio('error');
        }
    };

    const addOutboundItem = async (item: OutboundItem) => {
        const enrichedItem = { ...item, time: new Date().toLocaleString('pt-BR') };
        if (currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name);
        }

        setOutboundItems(prev => {
            const updated = [enrichedItem, ...prev];
            saveLocal(STORAGE_KEYS.OUTBOUND_LOG, updated);
            return updated;
        });

        setStockItems(prev => {
            const updated = prev.map(s => s.id === item.id ? { ...s, status: 'Saiu' as const } : s);
            saveLocal(STORAGE_KEYS.STOCK, updated);
            return updated;
        });
        setPossibleLossItems(prev => prev.filter(loss => loss.id !== item.id));

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
        const newDriver: Driver = {
            ...driverData,
            id: 'dr-' + Math.random().toString(36).substr(2, 9),
            lastActivity: new Date().toLocaleString('pt-BR')
        };
        const updated = [...drivers, newDriver];
        setDrivers(updated);
        saveLocal(STORAGE_KEYS.DRIVERS, updated);
        playAudio('success');
    };

    const bulkAddDrivers = async (driversList: Omit<Driver, 'id' | 'lastActivity'>[]) => {
        const now = new Date().toLocaleString('pt-BR');
        const newOnes = driversList.map(d => ({
            ...d,
            id: 'dr-' + Math.random().toString(36).substr(2, 9),
            lastActivity: now
        }));
        const updated = [...drivers, ...newOnes];
        setDrivers(updated);
        saveLocal(STORAGE_KEYS.DRIVERS, updated);
        playAudio('success');
    };

    const updateDriver = async (id: string, updates: Partial<Driver>) => {
        const updated = drivers.map(d => d.id === id ? { ...d, ...updates } : d);
        setDrivers(updated);
        saveLocal(STORAGE_KEYS.DRIVERS, updated);
    };

    const deleteDriver = async (id: string) => {
        const updated = drivers.filter(d => d.id !== id);
        setDrivers(updated);
        saveLocal(STORAGE_KEYS.DRIVERS, updated);
    };

    const [isInventoryActive, setIsInventoryActive] = useState(false);

    const addInventoryItem = async (item: InventoryItem) => {
        if (inventoryItems.some(i => i.id === item.id)) {
            playAudio('error');
            return;
        }
        if (currentUser) {
            await gamificationService.registerScan(currentUser.id, currentUser.name);
        }

        setInventoryItems(prev => {
            const updated = [item, ...prev];
            saveLocal(STORAGE_KEYS.INVENTORY_LOG, updated);
            return updated;
        });
        playAudio('success');
    };

    const startInventory = async () => {
        setIsInventoryActive(true);
        setInventoryItems([]);
        localStorage.removeItem(STORAGE_KEYS.INVENTORY_LOG);
    };

    const stopInventory = async () => {
        setIsInventoryActive(false);
        const missingIds = stockItems
            .filter(s => s.status === 'Em Estoque' && !inventoryItems.some(inv => inv.id === s.id))
            .map(s => s.id);

        const now = new Date().toISOString();
        const updatedStock = stockItems.map(s => {
            if (missingIds.includes(s.id)) {
                return { ...s, status: 'Possível Perda' as const, lossDetectedTime: s.lossDetectedTime || now };
            }
            return s;
        });

        setStockItems(updatedStock);
        saveLocal(STORAGE_KEYS.STOCK, updatedStock);
        setPossibleLossItems(updatedStock.filter(s => s.status === 'Possível Perda'));
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
        const existingActive = treatmentItems.find(t => t.tbrId === itemData.tbrId && t.status !== 'Resolvido');
        if (existingActive) {
            playAudio('error');
            return { success: false, message: `Já existe uma tratativa ativa (${existingActive.id}) para esta TBR.` };
        }

        const trtId = `TRT-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        const now = new Date().toISOString();
        const displayTime = new Date().toLocaleString('pt-BR');

        const newItem: TreatmentItem = {
            ...itemData,
            id: trtId,
            time: displayTime,
            status: 'Pendente'
        };

        const updatedTreatments = [newItem, ...treatmentItems];
        setTreatmentItems(updatedTreatments);
        saveLocal(STORAGE_KEYS.INCIDENTS, updatedTreatments);

        if (itemData.type === 'Extravio' || itemData.type === 'Avaria') {
            const updatedStock = stockItems.map(s =>
                s.id === itemData.tbrId ? { ...s, status: 'Possível Perda' as const, lossDetectedTime: s.lossDetectedTime || now } : s
            );
            setStockItems(updatedStock);
            saveLocal(STORAGE_KEYS.STOCK, updatedStock);
        }

        playAudio('success');
        return { success: true, message: 'Incidente registrado com sucesso.' };
    };

    const updateTreatmentStatus = async (id: string, status: TreatmentItem['status']) => {
        const updated = treatmentItems.map(t => t.id === id ? { ...t, status } : t);
        setTreatmentItems(updated);
        saveLocal(STORAGE_KEYS.INCIDENTS, updated);
    };

    const updateTreatment = async (id: string, updates: Partial<Pick<TreatmentItem, 'type' | 'description'>>) => {
        const updated = treatmentItems.map(t => t.id === id ? { ...t, ...updates } : t);
        setTreatmentItems(updated);
        saveLocal(STORAGE_KEYS.INCIDENTS, updated);
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
        setInboundItems([]);
        setOutboundItems([]);
        setStockItems([]);
        setInventoryItems([]);
        setPossibleLossItems([]);
        setExpectedInboundList([]);
        setTreatmentItems([]);

        localStorage.removeItem(STORAGE_KEYS.INBOUND_LOG);
        localStorage.removeItem(STORAGE_KEYS.OUTBOUND_LOG);
        localStorage.removeItem(STORAGE_KEYS.STOCK);
        localStorage.removeItem(STORAGE_KEYS.CONFIG);
        localStorage.removeItem(STORAGE_KEYS.INCIDENTS);
        localStorage.removeItem(STORAGE_KEYS.INVENTORY_LOG);

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
