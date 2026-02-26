/**
 * WmsContext.tsx — Lean Orchestrator
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: "fachada" (facade) para as Views.
 *  - Auth & navigation
 *  - Audio feedback
 *  - CRUD functions (mutations)
 *  - Optimistic UI via setters do WmsDataContext
 *
 * PROIBIDO:
 *  - useState de dados (estado vive no WmsDataContext)
 *  - Realtime listeners (estão no WmsDataContext)
 *  - Cálculos de produtividade (estão no KpiContext)
 *  - Gamificação (está no GamificationContext)
 * ─────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { User, Driver, Role, UserStatus, View, InboundItem, OutboundItem, StockItem, TreatmentItem, InventoryItem, ExpeditionItem } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storageService';
import { gamificationService } from '../services/gamificationService';
import { supabase } from '../services/supabase';
import { ApiService } from '../services/apiService';
import { isSameDay, getSaoPauloDate, getTodayDate, getSaoPauloIso } from '../utils/dateUtils';
import { isValidTbr } from '../utils/validation';
import { useWmsData } from './WmsDataContext';
import { useKpi, OperatorProductivity } from './KpiContext';

// ─────────────────────────────────────────────────────────────
// Context Interface — Backward-compatible facade
// ─────────────────────────────────────────────────────────────

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
    staleStockItems: StockItem[];
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
    users: User[];
    refreshUsers: () => Promise<void>;
    updateUserStatus: (id: string, status: UserStatus, role?: Role | null) => Promise<void>;
    updateUser: (originalId: string, updates: Partial<User>) => Promise<{ success: boolean; message: string }>;
    deleteUser: (id: string) => Promise<void>;
    inviteUser: (email: string) => Promise<{ success: boolean; message: string }>;
    updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
    adminResetPassword: (userId: string, newPassword: string) => Promise<{ success: boolean; message: string }>;
    // Navigation
    currentView: View;
    setCurrentView: (view: View) => void;
    // Drivers
    drivers: Driver[];
    addDriver: (driver: Omit<Driver, 'id' | 'lastActivity'>) => Promise<void>;
    bulkAddDrivers: (drivers: Omit<Driver, 'id' | 'lastActivity'>[]) => Promise<void>;
    updateDriver: (id: string, updates: Partial<Driver>) => Promise<void>;
    deleteDriver: (id: string) => Promise<void>;
    // RTS
    expeditions: ExpeditionItem[];
    updateExpeditionDelivered: (id: string, delivered: number) => Promise<void>;
    verifyReturn: (tbrId: string, driverName: string) => Promise<{ success: boolean; message: string }>;
    addRtsPendingItem: (tbrId: string, driverName: string) => Promise<{ success: boolean; message: string }>;
    fetchDriverTodayCount: (driverId: string) => Promise<number>;
    fetchProductivityReport: (startDate: string, endDate: string) => Promise<OperatorProductivity[]>;
    rtsItems: any[];
    rtsLogs: any[];
    // Stats (delegated to KpiContext)
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
    staleItemsCount: number;
    totalExpected: number;
    totalPossibleLosses: number;
    weeklyStats: { name: string; entradas: number; saidas: number; entregues: number; rts: number }[];
    resetTransactions: () => Promise<void>;
    todayReversaCount: number;
    operatorProductivity: OperatorProductivity[];
    // Helpers
    verifyStock: (id: string) => Promise<{ success: boolean; message: string }>;
    isValidTbr: (id: string) => { isValid: boolean; message?: string };
    isSameDay: (dateStr: string) => boolean;
    getLocalDateIso: () => string;
    // Audio & Actions
    playAudio: (type: 'success' | 'error') => void;
    refreshProfile: () => Promise<void>;
    uploadUserAvatar: (file: File) => Promise<{ success: boolean; message: string }>;
    syncDetailedLogs: (module: 'stock' | 'inbound' | 'outbound' | 'treatments') => Promise<void>;
    refreshData: () => Promise<void>;
    broadcastRefresh: () => Promise<void>;
    loading: boolean;
}

const WmsContext = createContext<WmsContextData>({} as WmsContextData);

// Re-export OperatorProductivity for backward compat
export type { OperatorProductivity };

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export const WmsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

    // ═══════════════════════════════════════════════════════
    // CONSUME SUB-CONTEXTS
    // ═══════════════════════════════════════════════════════

    const {
        inboundItems, outboundItems, inventoryItems, rtsLogs,
        stockItems, possibleLossItems, drivers, treatmentItems,
        expeditions, rtsItems, users, expectedInboundList,
        dashboardStats, weeklyStatsFromView, todayReversaCount,
        // Setters for optimistic UI
        setInboundItems, setOutboundItems, setInventoryItems, setRtsLogs,
        setStockItems, setPossibleLossItems, setDrivers, setTreatmentItems,
        setExpeditions, setRtsItems, setUsers, setExpectedInboundList: _setExpectedInboundList,
        setDashboardStats, setWeeklyStatsFromView, setTodayReversaCount,
        // Actions
        loadInitialData, broadcastRefresh
    } = useWmsData();

    const {
        operatorProductivity,
        statsSummary,
        fetchProductivityReport: kpiFetchReport
    } = useKpi();

    // ═══════════════════════════════════════════════════════
    // AUDIO SYSTEM
    // ═══════════════════════════════════════════════════════

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

    // ═══════════════════════════════════════════════════════
    // NAVIGATION & AUTH STATE (local to orchestrator)
    // ═══════════════════════════════════════════════════════

    const [currentView, _setCurrentView] = useState<View>(View.DASHBOARD);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isInventoryActive, setIsInventoryActive] = useState(false);

    const STORAGE_KEYS = {
        INVENTORY_LOG: 'wms_inventory_log'
    };

    const setCurrentView = async (view: View) => {
        _setCurrentView(view);
        if (view !== View.LOGIN) {
            await StorageService.setItem('wms_active_view', view);
        }
    };

    // ═══════════════════════════════════════════════════════
    // AUTH: Profile, Login, Logout, Registration
    // ═══════════════════════════════════════════════════════

    const refreshProfile = async () => {
        try {
            const stored = await AuthService.getCurrentUser();
            if (stored) {
                const { data: fresh, error } = await supabase
                    .from('users').select('*').eq('id', stored.id).maybeSingle();

                if (fresh) {
                    const user = fresh as User;
                    setCurrentUser(user);
                    await AuthService.saveSession(user);
                    return;
                } else if (error) {
                    console.error('WmsContext: Profile refresh error', error);
                    setCurrentUser(stored);
                    return;
                }
            }

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (session?.user && !sessionError) {
                const { data: profile } = await supabase.from('users').select('*').eq('id', session.user.id).maybeSingle();
                if (profile) {
                    const user = profile as User;
                    setCurrentUser(user);
                    await AuthService.saveSession(user);
                    return;
                }
            }

            _setCurrentView(View.LOGIN);
        } catch (err) {
            console.error('WmsContext: Profile refresh failed', err);
            _setCurrentView(View.LOGIN);
        }
    };

    // App initialization
    useEffect(() => {
        const initializeApp = async () => {
            const timeout = setTimeout(() => {
                if (loading) {
                    console.warn('WmsContext: Initialization timeout');
                    setLoading(false);
                }
            }, 5000);

            try {
                const savedView = await StorageService.getItem('wms_active_view') as View;
                if (savedView && savedView !== View.LOGIN && Object.values(View).includes(savedView)) {
                    _setCurrentView(savedView);
                }
                await refreshProfile();
            } catch (err) {
                console.error('WmsContext: Initialization failed', err);
                _setCurrentView(View.LOGIN);
            } finally {
                clearTimeout(timeout);
                setLoading(false);
            }
        };

        initializeApp();
    }, []);

    const login = async (identifier: string, password: string) => {
        try {
            const result = await AuthService.login(identifier, password);
            if (result.success && result.user) {
                setCurrentUser(result.user);
                _setCurrentView(View.DASHBOARD);
                await StorageService.setItem('wms_active_view', View.DASHBOARD);
            }
            return { success: result.success, message: result.message };
        } catch (err: any) {
            return { success: false, message: `Erro crítico na autenticação: ${err.message || 'Erro desconhecido'}` };
        }
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

    // ═══════════════════════════════════════════════════════
    // USER MANAGEMENT (CRUD)
    // ═══════════════════════════════════════════════════════

    const refreshUsers = async () => {
        if (!currentUser) return;
        const userRole = (currentUser.role || '').toLowerCase();
        const isSuperAdmin = userRole === 'superadmin';
        const isAdmin = isSuperAdmin || userRole === 'admin';

        let query = supabase.from('users').select('*').order('name', { ascending: true });
        if (!isSuperAdmin) query = query.eq('company_id', currentUser.company_id);

        let { data, error } = await query;
        if (!error && (!data || data.length === 0) && isAdmin) {
            const { data: fallback } = await supabase.from('users').select('*').limit(100);
            if (fallback) data = fallback;
        }
        if (!error && data) setUsers(data as User[]);
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

    const adminResetPassword = async (userId: string, newPassword: string) => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin')) {
            return { success: false, message: 'Não autorizado' };
        }
        const result = await ApiService.adminResetPassword(userId, newPassword);
        if (!result.success) {
            playAudio('error');
            return { success: false, message: result.error };
        }
        playAudio('success');
        return { success: true, message: 'Senha redefinida com sucesso' };
    };

    const uploadUserAvatar = async (file: File) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const result = await ApiService.uploadAvatar(file, currentUser);
        if (result.success) {
            await refreshProfile();
            playAudio('success');
            return { success: true, message: 'Avatar atualizado!' };
        }
        playAudio('error');
        return { success: false, message: result.error || 'Erro no upload' };
    };

    // ═══════════════════════════════════════════════════════
    // INBOUND CRUD
    // ═══════════════════════════════════════════════════════

    const clearInboundManifest = async () => {
        if (!currentUser) return;
        _setExpectedInboundList([]);
        await ApiService.clearInboundManifest(currentUser);
    };

    const setExpectedInboundList = async (list: string[]) => {
        if (!currentUser) return;
        _setExpectedInboundList(list);
        await ApiService.updateConfig({ expected_inbound: list }, currentUser);
    };

    const addInboundItem = async (item: InboundItem) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        const enrichedItem = { ...item, time: now };

        if (item.status === 'Sucesso') {
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        }

        const result = await ApiService.logInbound(enrichedItem, currentUser);
        if (!result.success) {
            console.error('WmsContext: Error adding inbound item:', result.error);
            playAudio('error');
            return;
        }

        await ApiService.upsertStockItem(item.id, item.operator, 'Em Estoque', currentUser);
        playAudio('success');
    };

    // ═══════════════════════════════════════════════════════
    // OUTBOUND CRUD
    // ═══════════════════════════════════════════════════════

    const syncExpedition = async (driverName: string, plate: string, count: number) => {
        if (!currentUser) return;
        const today = getSaoPauloDate();
        await ApiService.upsertExpedition({
            driver_name: driverName, plate, dispatch_date: today,
            total_packages: count, status: 'EM_ROTA'
        }, currentUser);
    };

    const addOutboundItem = async (item: OutboundItem) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const now = getSaoPauloIso();
        const enrichedItem = { ...item, time: now, pallet_id: (item as any).palletId };

        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);

        const result = await ApiService.logOutbound(enrichedItem, currentUser);
        if (!result.success) {
            playAudio('error');
            return { success: false, message: result.error };
        }

        await ApiService.updateStockStatus([item.id], 'Saiu', currentUser);
        loadInitialData();
        playAudio('success');

        await syncExpedition(enrichedItem.driverName, enrichedItem.vehicle, 1);
        return { success: true };
    };

    const bulkAddOutboundItems = async (items: OutboundItem[]) => {
        if (!currentUser) return { success: false, message: 'Não logado' };

        const result = await ApiService.bulkLogOutbound(items, currentUser);
        if (!result.success) {
            playAudio('error');
            return { success: false, message: `Erro ao salvar logs: ${result.error}` };
        }

        const ids = items.map(i => i.id);
        const batchPalletId = (items[0] as any).palletId;
        await ApiService.updateStockStatus(ids, 'Saiu', currentUser, { pallet_id: batchPalletId });

        for (const item of items) {
            await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        }

        loadInitialData();
        playAudio('success');

        if (items.length > 0) {
            await syncExpedition(items[0].driverName, items[0].vehicle, items.length);
        }
        return { success: true };
    };

    const deleteOutboundItem = async (id: string) => {
        if (!currentUser) return;
        const result = await ApiService.deleteOutbound(id, currentUser);
        if (!result.success) { playAudio('error'); return; }
        await ApiService.updateStockStatus([id], 'Em Estoque', currentUser);
        playAudio('success');
    };

    // ═══════════════════════════════════════════════════════
    // INVENTORY CRUD
    // ═══════════════════════════════════════════════════════

    const addInventoryItem = async (item: InventoryItem) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        const currentId = item.id.trim().toUpperCase();

        // Prevent duplicates
        if (inventoryItems.some(i => i.id === currentId)) {
            playAudio('error');
            return;
        }

        // Optimistic update
        const enrichedItem = { ...item, id: currentId, time: now, operator: currentUser.name };
        setInventoryItems(prev => [enrichedItem, ...prev]);

        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);

        const { error } = await supabase.from('inventory_log').insert({
            ...enrichedItem, company_id: currentUser.company_id
        });

        if (error) {
            console.error('WmsContext: Error adding inventory item:', error);
            setInventoryItems(prev => prev.filter(i => i.id !== currentId));
            playAudio('error');
            return;
        }
        playAudio('success');
    };

    const startInventory = async () => {
        if (!currentUser) return;
        setIsInventoryActive(true);
        setInventoryItems([]);
        localStorage.removeItem(STORAGE_KEYS.INVENTORY_LOG);

        const { error } = await supabase.from('inventory_log')
            .delete().eq('company_id', currentUser.company_id);
        if (error) console.error('WmsContext: Error clearing inventory_log:', error);
    };

    const stopInventory = async () => {
        if (!currentUser) return;
        setIsInventoryActive(false);

        const missingIds = stockItems
            .filter(s => s.status?.toLowerCase() === 'em estoque' && !inventoryItems.some(inv => inv.id === s.id))
            .map(s => s.id);

        if (missingIds.length > 0) {
            const now = getSaoPauloIso();
            const { error } = await supabase.from('stock_items')
                .update({ status: 'Possível Perda' as const, loss_detected_time: now })
                .in('id', missingIds).eq('company_id', currentUser.company_id);
            if (error) playAudio('error');
        }

        await loadInitialData();
        playAudio('success');
    };

    const localizeItem = async (id: string, scannerInput: string) => {
        if (!currentUser) return { success: false, message: 'Usuário não logado' };
        const result = await ApiService.updateStockStatus([id], 'Em Estoque', currentUser, {
            rack_location: scannerInput, localized_by: currentUser.name
        });
        playAudio(result.success ? 'success' : 'error');
        return result.success
            ? { success: true, message: 'Item localizado com sucesso!' }
            : { success: false, message: `Erro: ${result.error}` };
    };

    const verifyStock = async (id: string) => {
        const validation = isValidTbr(id);
        if (!validation.isValid) return { success: false, message: validation.message! };

        const currentId = id.trim().toUpperCase();
        const activeIncident = treatmentItems.find(t => t.tbrId === currentId && t.status !== 'Resolvido');
        if (activeIncident) {
            return { success: false, message: `BLOQUEADO: TBR ${currentId} possui uma tratativa ativa (${activeIncident.id}).` };
        }
        const item = stockItems.find(s => s.id === currentId);
        if (!item) return { success: false, message: `TBR ${currentId} não encontrada no estoque.` };
        if (item.status?.toLowerCase() !== 'em estoque') return { success: false, message: `TBR ${currentId} está com status: ${item.status}.` };
        return { success: true, message: 'Item validado.' };
    };

    // ═══════════════════════════════════════════════════════
    // TREATMENT CRUD
    // ═══════════════════════════════════════════════════════

    const addTreatment = async (itemData: Omit<TreatmentItem, 'id' | 'time' | 'status'>) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const existingActive = treatmentItems.find(t => t.tbrId === itemData.tbrId && t.status?.toLowerCase() !== 'resolvido');
        if (existingActive) {
            playAudio('error');
            return { success: false, message: `Já existe uma tratativa ativa (${existingActive.id}) para esta TBR.` };
        }

        const now = getSaoPauloIso();
        const id = 'inc-' + Math.random().toString(36).substr(2, 9);

        const result = await ApiService.saveIncident({
            id, tbr_id: itemData.tbrId, type: itemData.type,
            description: itemData.description, operator: itemData.operator,
            time: now, status: 'Pendente'
        }, currentUser);

        if (result.success) {
            if (itemData.type === 'Extravio') {
                await ApiService.updateStockStatus([itemData.tbrId], 'Possível Perda', currentUser, { loss_detected_time: now });
            }
            playAudio('success');
            return { success: true, message: 'Tratativa registrada!' };
        }
        playAudio('error');
        return { success: false, message: result.error || 'Erro desconhecido' };
    };

    const updateTreatmentStatus = async (id: string, status: TreatmentItem['status']) => {
        if (!currentUser) return;
        await ApiService.updateIncident(id, { status }, currentUser);
        playAudio('success');
    };

    const updateTreatment = async (id: string, updates: Partial<Pick<TreatmentItem, 'type' | 'description'>>) => {
        if (!currentUser) return;
        await supabase.from('incidents').update(updates).eq('id', id).eq('company_id', currentUser.company_id);
        playAudio('success');
    };

    // ═══════════════════════════════════════════════════════
    // DRIVER CRUD
    // ═══════════════════════════════════════════════════════

    const addDriver = async (driverData: Omit<Driver, 'id' | 'lastActivity'>) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        const newDriverId = 'dr-' + Math.random().toString(36).substr(2, 9);
        const result = await ApiService.saveDriver({
            id: newDriverId, ...driverData, lastActivity: now
        }, currentUser);
        playAudio(result.success ? 'success' : 'error');
    };

    const bulkAddDrivers = async (driversList: Omit<Driver, 'id' | 'lastActivity'>[]) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        const newOnes = driversList.map(d => ({
            id: 'dr-' + Math.random().toString(36).substr(2, 9), ...d, lastActivity: now
        }));
        await ApiService.bulkAddDrivers(newOnes, currentUser);
        playAudio('success');
    };

    const updateDriver = async (id: string, updates: Partial<Driver>) => {
        if (!currentUser) return;
        const dbUpdates: any = { ...updates };
        if (updates.vehicleProfile) { dbUpdates.vehicle_profile = updates.vehicleProfile; delete dbUpdates.vehicleProfile; }
        if (updates.lastActivity) { dbUpdates.last_activity = updates.lastActivity; delete dbUpdates.lastActivity; }

        const result = await ApiService.updateDriver(id, dbUpdates, currentUser);
        playAudio(result.success ? 'success' : 'error');
    };

    const deleteDriver = async (id: string) => {
        if (!currentUser) return;
        const result = await ApiService.deleteDriver(id, currentUser);
        playAudio(result.success ? 'success' : 'error');
    };

    // ═══════════════════════════════════════════════════════
    // RTS CRUD
    // ═══════════════════════════════════════════════════════

    const updateExpeditionDelivered = async (id: string, delivered: number) => {
        if (!currentUser) return;
        const expedition = expeditions.find(e => e.id === id);
        const oldDelivered = expedition?.delivered_count || 0;

        // Optimistic update
        setExpeditions(prev => prev.map(e => e.id === id ? { ...e, delivered_count: delivered } : e));

        const result = await ApiService.updateExpedition(id, { delivered_count: delivered }, currentUser);
        if (!result.success) {
            loadInitialData();
            playAudio('error');
        } else if (delivered > oldDelivered) {
            const diff = delivered - oldDelivered;
            for (let i = 0; i < diff; i++) {
                await ApiService.logRts({
                    id: `MANUAL_${id}_${Date.now()}_${i}`,
                    operator: currentUser.name,
                    time: getSaoPauloIso(),
                    type: 'DELIVERED_MANUAL'
                }, currentUser);
                await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
            }
        }
    };

    const verifyReturn = async (tbrId: string, driverName: string) => {
        if (!currentUser) return { success: false, message: 'Não logado' };

        const query = supabase.from('outbound_log').select('*')
            .eq('id', tbrId).eq('driver_name', driverName).order('time', { ascending: false }).limit(1);
        const { data: outbound } = await ApiService.applyScope(query, currentUser).maybeSingle();
        if (!outbound) return { success: false, message: `TBR não encontrada na saída deste motorista.` };

        const today = getSaoPauloDate();
        const expQuery = supabase.from('expeditions').select('*').eq('driver_name', driverName).eq('dispatch_date', today);
        const { data: exp } = await ApiService.applyScope(expQuery, currentUser).maybeSingle();
        if (exp) await ApiService.updateExpedition(exp.id, { returned_count: (exp.returned_count || 0) + 1 }, currentUser);

        await ApiService.updateStockStatus([tbrId], 'Em Estoque', currentUser);
        await ApiService.logRts({ id: tbrId, operator: currentUser.name, time: getSaoPauloIso() }, currentUser);
        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);

        playAudio('success');
        return { success: true, message: 'Retorno verificado com sucesso.' };
    };

    const addRtsPendingItem = async (tbrId: string, driverName: string) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const cleanTbr = tbrId.trim().toUpperCase();

        const result = await ApiService.logRts({
            id: cleanTbr, operator: currentUser.name,
            time: getSaoPauloIso(), type: 'PENDING_SCAN', driver_name: driverName
        }, currentUser);

        if (!result.success) return { success: false, message: 'Erro ao salvar pendência.' };

        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        playAudio('success');
        return { success: true, message: 'Pendência registrada.' };
    };

    // ═══════════════════════════════════════════════════════
    // MISC ACTIONS
    // ═══════════════════════════════════════════════════════

    const resetTransactions = async () => {
        if (!currentUser) return;
        const result = await ApiService.resetTransactions(currentUser);
        if (result.success) {
            setDashboardStats(null);
            setWeeklyStatsFromView([]);
            setInboundItems([]);
            setOutboundItems([]);
            setInventoryItems([]);
            setExpeditions([]);
            setRtsItems([]);
            setTreatmentItems([]);
            await loadInitialData();
            playAudio('success');
        } else {
            playAudio('error');
        }
    };

    const fetchDriverTodayCount = useCallback(async (driverId: string): Promise<number> => {
        if (!currentUser) return 0;
        const result = await ApiService.fetchDriverTodayCount(driverId, currentUser);
        return result.success ? result.data || 0 : 0;
    }, [currentUser]);

    const fetchProductivityReport = useCallback(async (start: string, end: string) => {
        return kpiFetchReport(start, end);
    }, [kpiFetchReport]);

    const syncDetailedLogs = async (_module: 'stock' | 'inbound' | 'outbound' | 'treatments') => {
        await loadInitialData();
    };

    // ═══════════════════════════════════════════════════════
    // DERIVED VALUES (lightweight, from KpiContext + WmsDataContext)
    // ═══════════════════════════════════════════════════════

    const staleStockItems = useMemo(() => stockItems.filter(item => {
        if (item.status?.toLowerCase() !== 'em estoque' || !item.entryTime) return false;
        return !isSameDay(item.entryTime);
    }), [stockItems]);

    const todayInboundList = useMemo(() =>
        inboundItems.filter(item => isSameDay(item.time || (item as any).created_at)),
        [inboundItems]);

    const todayOutboundList = useMemo(() =>
        outboundItems.filter(item => isSameDay(item.time || (item as any).createdAt || (item as any).created_at)),
        [outboundItems]);

    const inboundReconciliation = useMemo(() => {
        const successfulScansToday = Array.from(new Set(
            todayInboundList.filter(item => !item.error).map(item => item.id)
        ));
        const matches = expectedInboundList.filter(id => successfulScansToday.includes(id));
        const missing = expectedInboundList.filter(id => !successfulScansToday.includes(id));
        const unexpected = successfulScansToday.filter(id => !expectedInboundList.includes(id));
        const progressPercent = expectedInboundList.length > 0
            ? Math.round((matches.length / expectedInboundList.length) * 100) : 0;
        return { matches, missing, unexpected, progressPercent, successfulScansToday };
    }, [todayInboundList, expectedInboundList]);

    const activeDriversCount = useMemo(() => drivers.filter(d => d.status === 'Ativo').length, [drivers]);
    const availableStockCount = useMemo(() => stockItems.filter(item => item.status?.toLowerCase() === 'em estoque').length, [stockItems]);

    // ═══════════════════════════════════════════════════════
    // PROVIDER VALUE — Backward-compatible facade
    // ═══════════════════════════════════════════════════════

    return (
        <WmsContext.Provider value={{
            // Auth & State
            currentUser, logout, login, register, updatePassword, adminResetPassword,
            users, inviteUser, refreshUsers, updateUserStatus, updateUser, deleteUser,
            currentView, setCurrentView,

            // Data (passthrough from WmsDataContext)
            stockItems, possibleLossItems, staleStockItems,
            inboundItems, outboundItems, inventoryItems,
            drivers, treatmentItems, expeditions, rtsItems, rtsLogs,
            expectedInboundList,

            // CRUD
            addInboundItem, setExpectedInboundList, clearInboundManifest,
            addOutboundItem, bulkAddOutboundItems, deleteOutboundItem,
            addInventoryItem, isInventoryActive, setIsInventoryActive, startInventory, stopInventory, localizeItem,
            addTreatment, updateTreatmentStatus, updateTreatment,
            addDriver, bulkAddDrivers, updateDriver, deleteDriver,
            updateExpeditionDelivered, verifyReturn, addRtsPendingItem,

            // Stats (from KpiContext)
            totalInboundToday: statsSummary.totalInboundToday,
            totalOutboundToday: statsSummary.totalOutboundToday,
            totalReversaToday: statsSummary.totalReversaToday,
            totalLossItems: statsSummary.totalLossItems,
            staleItemsCount: statsSummary.staleItemsCount,
            totalPossibleLosses: statsSummary.totalPossibleLosses,
            weeklyStats: statsSummary.weeklyStats,

            // Derived
            todayInboundList, todayOutboundList, inboundReconciliation,
            activeDriversCount, availableStockCount,
            totalInventoryScanned: inventoryItems.length,
            totalExpected: availableStockCount,
            todayReversaCount,
            operatorProductivity,

            // Actions
            refreshData: loadInitialData,
            broadcastRefresh,
            resetTransactions,
            fetchProductivityReport,
            fetchDriverTodayCount,

            // Helpers
            verifyStock, isValidTbr, isSameDay,
            getLocalDateIso: () => getSaoPauloDate(),
            playAudio, refreshProfile, uploadUserAvatar, syncDetailedLogs,
            loading
        }}>
            {children}
        </WmsContext.Provider>
    );
};

export const useWms = () => useContext(WmsContext);
