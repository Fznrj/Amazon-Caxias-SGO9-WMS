import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, Driver, Role, UserStatus, VehicleProfile } from '../../types';
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
    status: 'Saiu com Motorista';
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
    register: (name: string, email: string, password: string, companyId: string, customId?: string) => Promise<{ success: boolean; message: string }>;

    // Admin User Management
    users: User[]; // List of all users for admin
    refreshUsers: () => Promise<void>; // Reload users from service
    updateUserStatus: (id: string, status: UserStatus, role?: Role | null) => Promise<void>;
    updateUser: (originalId: string, updates: Partial<User>) => Promise<{ success: boolean; message: string }>;
    deleteUser: (id: string) => Promise<void>;

    // Driver Management
    drivers: Driver[];
    addDriver: (driver: Omit<Driver, 'id' | 'lastActivity'>) => Promise<void>;
    bulkAddDrivers: (drivers: Omit<Driver, 'id' | 'lastActivity'>[]) => Promise<void>;
    updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
    deleteDriver: (id: string) => Promise<void>;

    // Stats
    totalInboundToday: number;
    totalOutboundToday: number;
    totalInventoryScanned: number;
    totalLossItems: number;
    resetTransactions: () => Promise<void>;

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

    // --- Auth & User Management State (Moved to top) ---
    const [currentUser, setCurrentUser] = useState<User | null>(AuthService.getCurrentUser());
    const [users, setUsers] = useState<User[]>([]);

    // --- Stock State ---
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
    // --- Initial Sync ---
    useEffect(() => {
        const fetchInitialData = async () => {
            if (!currentUser) return;

            // 1. Fetch Expected List
            const { data: config } = await supabase.from('system_config').select('value').eq('key', 'expected_inbound').single();
            if (config) _setExpectedInboundList(config.value as string[]);

            // 2. Fetch Drivers
            const { data: driversData } = await supabase.from('drivers').select('*');
            if (driversData) setDrivers(driversData as Driver[]);

            // 3. Fetch Treatments
            const { data: treatmentsData } = await supabase.from('incidents').select('*');
            if (treatmentsData) setTreatmentItems(treatmentsData.map(t => ({
                id: t.id,
                tbrId: t.tbr_id,
                type: t.type,
                description: t.description,
                status: t.status,
                operator: t.operator,
                time: new Date(t.time).toLocaleString('pt-BR')
            })));

            // 4. Fetch Stock
            const { data: stockData } = await supabase.from('stock').select('*');
            if (stockData) {
                const mappedStock = stockData.map(s => ({
                    id: s.id,
                    entryTime: new Date(s.entry_time).toLocaleString('pt-BR'),
                    operator: s.operator,
                    status: s.status as StockItem['status'],
                    lossDetectedTime: s.loss_detected_time
                }));
                setStockItems(mappedStock);
                setPossibleLossItems(mappedStock.filter(s => s.status === 'Possível Perda'));
            }

            // 5. Fetch logs (limiting to recent)
            const { data: inboundLogs } = await supabase.from('inbound_log').select('*').order('time', { ascending: false }).limit(200);
            if (inboundLogs) setInboundItems(inboundLogs.map(l => ({
                id: l.tbr_id,
                status: l.status as InboundItem['status'],
                operator: l.operator,
                time: new Date(l.time).toLocaleString('pt-BR'),
                error: l.error
            })));

            const { data: outboundLogs } = await supabase.from('outbound_log').select('*').order('time', { ascending: false }).limit(200);
            if (outboundLogs) setOutboundItems(outboundLogs.map(l => ({
                id: l.tbr_id,
                driverName: l.driver_name,
                vehicle: l.vehicle,
                time: new Date(l.time).toLocaleString('pt-BR'),
                operator: l.operator,
                status: 'Saiu com Motorista'
            })));
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
        await supabase.from('inbound_log').insert({
            tbr_id: item.id,
            status: item.status,
            operator: item.operator,
            error: item.error,
            company_id: currentUser?.company_id
        });

        if (!item.error) {
            // Auto-resolve any active treatment for this TBR
            setTreatmentItems(prev => prev.map(t =>
                (t.tbrId === item.id && t.status !== 'Resolvido')
                    ? { ...t, status: 'Resolvido' }
                    : t
            ));
            await supabase.from('incidents').update({ status: 'Resolvido' }).eq('tbr_id', item.id);

            const now = new Date().toISOString();
            const { data: existing } = await supabase.from('stock').select('id').eq('id', item.id).single();

            if (existing) {
                await supabase.from('stock').update({
                    entry_time: now,
                    operator: item.operator,
                    status: 'Em Estoque',
                    loss_detected_time: null
                }).eq('id', item.id);
            } else {
                await supabase.from('stock').insert({
                    id: item.id,
                    entry_time: now,
                    operator: item.operator,
                    status: 'Em Estoque',
                    company_id: currentUser?.company_id
                });
            }

            setStockItems(prev => {
                const exists = prev.find(s => s.id === item.id);
                if (exists) {
                    return prev.map(s => s.id === item.id ? {
                        ...s,
                        entryTime: item.time,
                        operator: item.operator,
                        status: 'Em Estoque'
                    } : s);
                } else {
                    return [...prev, {
                        id: item.id,
                        entryTime: item.time,
                        operator: item.operator,
                        status: 'Em Estoque'
                    }];
                }
            });
            setPossibleLossItems(prev => prev.filter(p => p.id !== item.id));
            playAudio('success');
        } else {
            playAudio('error');
        }
    };


    const addOutboundItem = async (item: OutboundItem) => {
        setOutboundItems(prev => [item, ...prev]);

        // Update Stock
        await supabase.from('stock').update({ status: 'Saiu' }).eq('id', item.id);
        // Log Outbound
        await supabase.from('outbound_log').insert({
            tbr_id: item.id,
            driver_name: item.driverName,
            vehicle: item.vehicle,
            operator: item.operator,
            company_id: currentUser?.company_id
        });

        setStockItems(prev => prev.map(stock =>
            stock.id === item.id ? { ...stock, status: 'Saiu' } : stock
        ));
        setPossibleLossItems(prev => prev.filter(loss => loss.id !== item.id));
        playAudio('success');
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
        const { data, error } = await supabase.from('drivers').insert({
            name: driverData.name,
            cpf: driverData.cpf,
            plate: driverData.plate,
            vehicle: driverData.vehicleProfile,
            status: driverData.status,
            company_id: currentUser?.company_id,
            last_activity: new Date().toLocaleString('pt-BR')
        }).select().single();

        if (data) {
            setDrivers(prev => [...prev, data as any as Driver]);
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

        const { data } = await supabase.from('drivers').insert(newDrivers).select();
        if (data) {
            setDrivers(prev => [...prev, ...data as any as Driver[]]);
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
            company_id: currentUser?.company_id
        });

        if (error) {
            playAudio('error');
            return { success: false, message: 'Erro ao salvar incidente.' };
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
        // Initial load of users for admin view
        setUsers(AuthService.getUsers());
    }, []);

    const login = async (email: string, password: string) => {
        const result = await AuthService.login(email, password);
        if (result.success && result.user) {
            setCurrentUser(result.user);
        }
        return { success: result.success, message: result.message };
    };

    const logout = async () => {
        await AuthService.logout();
        setCurrentUser(null);
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

    // --- Reset Logic ---
    const resetTransactions = async () => {
        setInboundItems([]);
        setOutboundItems([]);
        setStockItems([]);
        setInventoryItems([]);
        setPossibleLossItems([]);
        setExpectedInboundList([]);

        // Wipe Supabase tables
        await supabase.from('inbound_log').delete().neq('tbr_id', '');
        await supabase.from('outbound_log').delete().neq('tbr_id', '');
        await supabase.from('stock').delete().neq('id', '');
        await supabase.from('system_config').delete().eq('key', 'expected_inbound');

        playAudio('success');
    };

    // --- Stats ---
    const totalInboundToday = new Set(inboundItems.filter(item => !item.error).map(item => item.id)).size;
    const totalOutboundToday = new Set(outboundItems.map(item => item.id)).size;
    const totalInventoryScanned = inventoryItems.length;
    const totalLossItems = stockItems.filter(s => s.status === 'Perda').length;

    return (
        <WmsContext.Provider value={{
            inboundItems, addInboundItem, expectedInboundList, setExpectedInboundList,
            outboundItems, addOutboundItem, deleteOutboundItem,
            inventoryItems, addInventoryItem, isInventoryActive, startInventory, stopInventory, stockItems, possibleLossItems,
            localizeItem,
            treatmentItems, addTreatment, updateTreatmentStatus, updateTreatment,
            users, refreshUsers, updateUserStatus, updateUser, deleteUser,
            drivers, addDriver, bulkAddDrivers, updateDriver, deleteDriver,
            currentUser, login, logout, register,
            totalInboundToday, totalOutboundToday, totalInventoryScanned, totalLossItems,
            resetTransactions,
            playAudio
        }}>
            {children}
        </WmsContext.Provider>
    );
};

export const useWms = () => useContext(WmsContext);
