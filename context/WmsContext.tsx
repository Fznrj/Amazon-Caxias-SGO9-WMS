/**
 * WmsContext.tsx — Lean Orchestrator
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: "fachada" (facade) para as Views.
 *  - Navigation state
 *  - Audio feedback
 *  - CRUD functions (mutations)
 *  - Optimistic UI via setters do WmsDataContext
 *
 * Auth vem do AuthContext (useAuth).
 * Dados brutos vêm do WmsDataContext (useWmsData).
 * KPIs vêm do KpiContext (useKpi).
 *
 * PROIBIDO:
 *  - useState de dados / Realtime / produtividade / gamificação
 * ─────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef, ReactNode } from 'react';
import { User, Driver, Role, UserStatus, View, InboundItem, OutboundItem, StockItem, TreatmentItem, InventoryItem, ExpeditionItem } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storageService';
import { gamificationService } from '../services/gamificationService';
import { supabase } from '../services/supabase';
import { ApiService } from '../services/apiService';
import { isSameDay, getSaoPauloDate, getSaoPauloIso } from '../utils/dateUtils';
import { isValidTbr } from '../utils/validation';
import { useAuth } from './AuthContext';
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
    // Stats (from KpiContext)
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

export type { OperatorProductivity };

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export const WmsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {

    // ═══════════════════════════════════════════════════════
    // CONSUME CONTEXTS
    // ═══════════════════════════════════════════════════════

    const {
        currentUser, setCurrentUser, loading,
        login: authLogin, logout: authLogout, register: authRegister,
        refreshProfile, updatePassword
    } = useAuth();

    const {
        inboundItems, outboundItems, inventoryItems, rtsLogs,
        stockItems, possibleLossItems, drivers, treatmentItems,
        expeditions, rtsItems, users, expectedInboundList,
        dashboardStats, weeklyStatsFromView, todayReversaCount,
        setInboundItems, setOutboundItems, setInventoryItems, setRtsLogs,
        setStockItems, setPossibleLossItems, setDrivers, setTreatmentItems,
        setExpeditions, setRtsItems, setUsers, setExpectedInboundList: _setExpectedInboundList,
        setDashboardStats, setWeeklyStatsFromView, setTodayReversaCount,
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
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            if (type === 'success') {
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.1, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start(); osc.stop(ctx.currentTime + 0.15);
            } else {
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(150, ctx.currentTime);
                osc.frequency.linearRampToValueAtTime(100, ctx.currentTime + 0.2);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
                osc.start(); osc.stop(ctx.currentTime + 0.25);
            }
        } catch (e) { console.error("Audio failed", e); }
    };

    // ═══════════════════════════════════════════════════════
    // NAVIGATION (local only)
    // ═══════════════════════════════════════════════════════

    const [currentView, _setCurrentView] = useState<View>(View.DASHBOARD);
    const [isInventoryActive, setIsInventoryActive] = useState(false);
    const STORAGE_KEYS = { INVENTORY_LOG: 'wms_inventory_log' };

    useEffect(() => {
        const loadView = async () => {
            const saved = await StorageService.getItem('wms_active_view') as View;
            if (saved && saved !== View.LOGIN && Object.values(View).includes(saved)) {
                _setCurrentView(saved);
            }
        };
        loadView();
    }, []);

    const setCurrentView = async (view: View) => {
        _setCurrentView(view);
        if (view !== View.LOGIN) await StorageService.setItem('wms_active_view', view);
    };

    // ═══════════════════════════════════════════════════════
    // AUTH WRAPPERS (delegate to AuthContext, add side effects)
    // ═══════════════════════════════════════════════════════

    const login = async (identifier: string, password: string) => {
        const result = await authLogin(identifier, password);
        if (result.success) _setCurrentView(View.DASHBOARD);
        return result;
    };

    const logout = async () => {
        await authLogout();
        setInboundItems([]);
        setOutboundItems([]);
        setStockItems([]);
        setInventoryItems([]);
        setDrivers([]);
        setTreatmentItems([]);
        setUsers([]);
        _setCurrentView(View.LOGIN);
    };

    const register = async (name: string, email: string, password: string, companyId: string, customId?: string) => {
        const result = await authRegister(name, email, password, companyId, customId);
        await refreshUsers();
        return result;
    };

    // ═══════════════════════════════════════════════════════
    // USER MANAGEMENT (CRUD)
    // ═══════════════════════════════════════════════════════

    const refreshUsers = async () => {
        if (!currentUser) return;
        const role = (currentUser.role || '').toLowerCase();
        const isSuperAdmin = role === 'superadmin';
        let query = supabase.from('users').select('*').order('name', { ascending: true });
        if (!isSuperAdmin) query = query.eq('company_id', currentUser.company_id);
        let { data, error } = await query;
        if (!error && (!data || data.length === 0) && (isSuperAdmin || role === 'admin')) {
            const { data: fb } = await supabase.from('users').select('*').limit(100);
            if (fb) data = fb;
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
            const all = await AuthService.getUsers();
            const upd = all.find(u => u.id === (updates.id || originalId));
            if (upd) { setCurrentUser(upd); AuthService.saveSession(upd); }
        }
        return result;
    };

    const deleteUser = async (id: string) => { await AuthService.deleteUser(id); await refreshUsers(); };

    const inviteUser = async (email: string) => {
        if (!currentUser) return { success: false, message: 'Admin não logado.' };
        const result = await AuthService.inviteUser(email, currentUser);
        await refreshUsers();
        return result;
    };

    const adminResetPassword = async (userId: string, newPassword: string) => {
        if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'superadmin'))
            return { success: false, message: 'Não autorizado' };
        const result = await ApiService.adminResetPassword(userId, newPassword);
        playAudio(result.success ? 'success' : 'error');
        return result.success ? { success: true, message: 'Senha redefinida' } : { success: false, message: result.error };
    };

    const uploadUserAvatar = async (file: File) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const result = await ApiService.uploadAvatar(file, currentUser);
        if (result.success) { await refreshProfile(); playAudio('success'); return { success: true, message: 'Avatar atualizado!' }; }
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
        const enriched = { ...item, time: now };

        // Log to database even if it is an error (so KPIs and Gamification can track it)
        const result = await ApiService.logInbound(enriched, currentUser);
        if (!result.success) { playAudio('error'); return; }

        if (item.error) {
            playAudio('error');
            // Do not update stock or trigger success scan for errors
            return;
        }

        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        await ApiService.upsertStockItem(item.id, item.operator, 'Em Estoque', currentUser);
        playAudio('success');
    };

    // ═══════════════════════════════════════════════════════
    // OUTBOUND CRUD
    // ═══════════════════════════════════════════════════════

    const syncExpedition = async (driverName: string, plate: string, count: number) => {
        if (!currentUser) return;
        const today = getSaoPauloDate();

        // Fetch existing expedition for this driver+date to INCREMENT instead of overwriting
        const { data: existing } = await supabase
            .from('expeditions')
            .select('total_packages')
            .eq('company_id', currentUser.company_id)
            .eq('driver_name', driverName)
            .eq('dispatch_date', today)
            .maybeSingle();

        const currentTotal = Number(existing?.total_packages || 0);

        await ApiService.upsertExpedition({
            driver_name: driverName, plate, dispatch_date: today,
            total_packages: currentTotal + count, status: 'EM_ROTA'
        }, currentUser);
    };

    const addOutboundItem = async (item: OutboundItem) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const now = getSaoPauloIso();
        const enriched = { ...item, time: now, pallet_id: (item as any).palletId };
        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        const result = await ApiService.logOutbound(enriched, currentUser);
        if (!result.success) { playAudio('error'); return { success: false, message: result.error }; }
        await ApiService.updateStockStatus([item.id], 'Saiu', currentUser);
        loadInitialData(); playAudio('success');
        await syncExpedition(enriched.driverName, enriched.vehicle, 1);
        return { success: true };
    };

    const bulkAddOutboundItems = async (items: OutboundItem[]) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const result = await ApiService.bulkLogOutbound(items, currentUser);
        if (!result.success) { playAudio('error'); return { success: false, message: result.error }; }
        await ApiService.updateStockStatus(items.map(i => i.id), 'Saiu', currentUser, { pallet_id: (items[0] as any).palletId });
        for (const _ of items) await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        loadInitialData(); playAudio('success');
        if (items.length > 0) await syncExpedition(items[0].driverName, items[0].vehicle, items.length);
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
        const currentId = item.id.trim().toUpperCase();

        let isError = false;
        if (inventoryItems.some(i => i.id === currentId)) {
            isError = true;
            playAudio('error');
            // Continue below to log the error, then exit early
        }

        const enriched = { ...item, id: currentId, time: getSaoPauloIso(), operator: currentUser.name, error: isError };

        const { error } = await supabase.from('inventory_log').insert({ ...enriched, company_id: currentUser.company_id });
        if (error) { playAudio('error'); return; }

        if (isError) return; // Stop here if it was a duplicate

        setInventoryItems(prev => [enriched, ...prev]); // Optimistic
        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        playAudio('success');
    };

    const startInventory = async () => {
        if (!currentUser) return;
        setIsInventoryActive(true); setInventoryItems([]); localStorage.removeItem(STORAGE_KEYS.INVENTORY_LOG);
        await supabase.from('inventory_log').delete().eq('company_id', currentUser.company_id);
    };

    const stopInventory = async () => {
        if (!currentUser) return;
        setIsInventoryActive(false);
        const missing = stockItems.filter(s => s.status?.toLowerCase() === 'em estoque' && !inventoryItems.some(inv => inv.id === s.id)).map(s => s.id);
        if (missing.length > 0) {
            await supabase.from('stock_items').update({ status: 'Possível Perda', loss_detected_time: getSaoPauloIso() }).in('id', missing).eq('company_id', currentUser.company_id);
        }
        await loadInitialData(); playAudio('success');
    };

    const localizeItem = async (id: string, scannerInput: string) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const result = await ApiService.updateStockStatus([id], 'Em Estoque', currentUser, { rack_location: scannerInput, localized_by: currentUser.name });
        playAudio(result.success ? 'success' : 'error');
        return result.success ? { success: true, message: 'Localizado!' } : { success: false, message: result.error || 'Erro' };
    };

    const verifyStock = async (id: string) => {
        const v = isValidTbr(id);
        if (!v.isValid) return { success: false, message: v.message! };
        const cid = id.trim().toUpperCase();

        const active = treatmentItems.find(t => t.tbrId === cid && t.status !== 'Resolvido');
        if (active) {
            // Log as outbound error so gamification penalizes
            if (currentUser) {
                await ApiService.logOutbound({ id: cid, driverName: 'ERRO_BIPE', operator: currentUser.name, time: getSaoPauloIso(), error: true } as any, currentUser);
            }
            return { success: false, message: `BLOQUEADO: tratativa ativa (${active.id}).` };
        }

        const item = stockItems.find(s => s.id === cid);
        if (!item || item.status?.toLowerCase() !== 'em estoque') {
            if (currentUser) {
                await ApiService.logOutbound({ id: cid, driverName: 'ERRO_BIPE', operator: currentUser.name, time: getSaoPauloIso(), error: true } as any, currentUser);
            }
            if (!item) return { success: false, message: `TBR ${cid} não encontrada.` };
            return { success: false, message: `Status: ${item.status}.` };
        }

        return { success: true, message: 'Validado.' };
    };

    // ═══════════════════════════════════════════════════════
    // TREATMENT CRUD
    // ═══════════════════════════════════════════════════════

    const addTreatment = async (itemData: Omit<TreatmentItem, 'id' | 'time' | 'status'>) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        if (treatmentItems.find(t => t.tbrId === itemData.tbrId && t.status?.toLowerCase() !== 'resolvido')) {
            playAudio('error'); return { success: false, message: 'Já existe tratativa ativa.' };
        }
        const now = getSaoPauloIso();
        const id = 'inc-' + Math.random().toString(36).substr(2, 9);
        const result = await ApiService.saveIncident({ id, tbr_id: itemData.tbrId, type: itemData.type, description: itemData.description, operator: itemData.operator, time: now, status: 'Pendente' }, currentUser);
        if (result.success) {
            if (itemData.type === 'Extravio') await ApiService.updateStockStatus([itemData.tbrId], 'Possível Perda', currentUser, { loss_detected_time: now });
            playAudio('success'); return { success: true, message: 'Registrada!' };
        }
        playAudio('error'); return { success: false, message: result.error || 'Erro' };
    };

    const updateTreatmentStatus = async (id: string, status: TreatmentItem['status']) => {
        if (!currentUser) return;
        await ApiService.updateIncident(id, { status }, currentUser); playAudio('success');
    };

    const updateTreatment = async (id: string, updates: Partial<Pick<TreatmentItem, 'type' | 'description'>>) => {
        if (!currentUser) return;
        await supabase.from('incidents').update(updates).eq('id', id).eq('company_id', currentUser.company_id); playAudio('success');
    };

    // ═══════════════════════════════════════════════════════
    // DRIVER CRUD
    // ═══════════════════════════════════════════════════════

    const addDriver = async (d: Omit<Driver, 'id' | 'lastActivity'>) => {
        if (!currentUser) return;
        const result = await ApiService.saveDriver({ id: 'dr-' + Math.random().toString(36).substr(2, 9), ...d, lastActivity: getSaoPauloIso() }, currentUser);
        playAudio(result.success ? 'success' : 'error');
    };

    const bulkAddDrivers = async (list: Omit<Driver, 'id' | 'lastActivity'>[]) => {
        if (!currentUser) return;
        const now = getSaoPauloIso();
        await ApiService.bulkAddDrivers(list.map(d => ({ id: 'dr-' + Math.random().toString(36).substr(2, 9), ...d, lastActivity: now })), currentUser);
        playAudio('success');
    };

    const updateDriver = async (id: string, updates: Partial<Driver>) => {
        if (!currentUser) return;
        const db: any = { ...updates };
        if (updates.vehicleProfile) { db.vehicle_profile = updates.vehicleProfile; delete db.vehicleProfile; }
        if (updates.lastActivity) { db.last_activity = updates.lastActivity; delete db.lastActivity; }
        const result = await ApiService.updateDriver(id, db, currentUser);
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
        const exp = expeditions.find(e => e.id === id);
        const old = exp?.delivered_count || 0;
        setExpeditions(prev => prev.map(e => e.id === id ? { ...e, delivered_count: delivered } : e));
        const result = await ApiService.updateExpedition(id, { delivered_count: delivered }, currentUser);
        if (!result.success) { loadInitialData(); playAudio('error'); }
        else if (delivered > old) {
            for (let i = 0; i < delivered - old; i++) {
                await ApiService.logRts({ id: `MANUAL_${id}_${Date.now()}_${i}`, operator: currentUser.name, time: getSaoPauloIso(), type: 'DELIVERED_MANUAL' }, currentUser);
                await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
            }
        }
    };

    const verifyReturn = async (tbrId: string, driverName: string) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const q = supabase.from('outbound_log').select('*').eq('id', tbrId).eq('driver_name', driverName).order('time', { ascending: false }).limit(1);
        const { data: ob } = await ApiService.applyScope(q, currentUser).maybeSingle();
        if (!ob) return { success: false, message: 'TBR não encontrada na saída deste motorista.' };
        const today = getSaoPauloDate();
        const eq = supabase.from('expeditions').select('*').eq('driver_name', driverName).eq('dispatch_date', today);
        const { data: ex } = await ApiService.applyScope(eq, currentUser).maybeSingle();
        if (ex) await ApiService.updateExpedition(ex.id, { returned_count: (ex.returned_count || 0) + 1 }, currentUser);
        await ApiService.updateStockStatus([tbrId], 'Em Estoque', currentUser);
        await ApiService.logRts({ id: tbrId, operator: currentUser.name, time: getSaoPauloIso() }, currentUser);
        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        playAudio('success');
        return { success: true, message: 'Retorno verificado!' };
    };

    const addRtsPendingItem = async (tbrId: string, driverName: string) => {
        if (!currentUser) return { success: false, message: 'Não logado' };
        const result = await ApiService.logRts({ id: tbrId.trim().toUpperCase(), operator: currentUser.name, time: getSaoPauloIso(), type: 'PENDING_SCAN', driver_name: driverName }, currentUser);
        if (!result.success) return { success: false, message: 'Erro.' };
        await gamificationService.registerScan(currentUser.id, currentUser.name, currentUser);
        playAudio('success'); return { success: true, message: 'Pendência registrada.' };
    };

    // ═══════════════════════════════════════════════════════
    // MISC & SLA ENFORCER
    // ═══════════════════════════════════════════════════════

    const lastSlaRunRef = useRef<number>(0);

    const enforceSlaTimeouts = useCallback(async () => {
        if (!currentUser || stockItems.length === 0) return;
        const nowMs = Date.now();
        // Run max once per minute to avoid re-render loops on Dashboard
        if (nowMs - lastSlaRunRef.current < 60000) return;
        lastSlaRunRef.current = nowMs;

        try {
            const threshold72h = new Date(nowMs - (72 * 60 * 60 * 1000));

            // Regra 1: Parado -> Possível Perda
            // Item 'Em Estoque' cuja última movimentação foi antes de threshold72h
            const toPossibleLoss = stockItems.filter(item => {
                if (item.status?.toLowerCase() !== 'em estoque') return false;
                const dateStr = item.entryTime || (item as any).time || (item as any).created_at;
                if (!dateStr) return false;
                return new Date(dateStr) < threshold72h;
            });

            if (toPossibleLoss.length > 0) {
                const ids = toPossibleLoss.map(i => i.id);
                await supabase.from('stock_items')
                    .update({ status: 'Possível Perda', loss_detected_time: getSaoPauloIso() })
                    .in('id', ids)
                    .eq('company_id', currentUser.company_id);
            }

            // Regra 2: Possível Perda -> Perda Definitiva!
            // Item 'Possível Perda' cujo registro do limite foi estourado há mais de 72h
            const toLoss = stockItems.filter(item => {
                if (item.status?.toLowerCase() !== 'possível perda') return false;
                if (!item.lossDetectedTime) return false;
                return new Date(item.lossDetectedTime) < threshold72h;
            });

            if (toLoss.length > 0) {
                const ids = toLoss.map(i => i.id);
                await supabase.from('stock_items')
                    .update({ status: 'Perda' })
                    .in('id', ids)
                    .eq('company_id', currentUser.company_id);
            }

            if (toPossibleLoss.length > 0 || toLoss.length > 0) {
                console.log(`[SLA Enforcer] Movidos: ${toPossibleLoss.length} para Possível Perda | ${toLoss.length} para Perda.`);
                broadcastRefresh(); // Force realtime UI update globally
            }
        } catch (err) {
            console.error('Error enforcing SLA timeouts:', err);
        }
    }, [currentUser, stockItems, broadcastRefresh]);

    useEffect(() => {
        if (currentUser && currentView === View.DASHBOARD) {
            enforceSlaTimeouts();
        }
    }, [currentUser, currentView, stockItems, enforceSlaTimeouts]);

    const resetTransactions = async () => {
        if (!currentUser) return;
        const result = await ApiService.resetTransactions(currentUser);
        if (result.success) {
            setDashboardStats(null); setWeeklyStatsFromView([]); setInboundItems([]); setOutboundItems([]); setInventoryItems([]); setExpeditions([]); setRtsItems([]); setTreatmentItems([]);
            await loadInitialData(); playAudio('success');
        } else playAudio('error');
    };

    const fetchDriverTodayCount = useCallback(async (driverId: string) => {
        if (!currentUser) return 0;
        const r = await ApiService.fetchDriverTodayCount(driverId, currentUser);
        return r.success ? r.data || 0 : 0;
    }, [currentUser]);

    const fetchProductivityReport = useCallback((s: string, e: string) => kpiFetchReport(s, e), [kpiFetchReport]);

    const syncDetailedLogs = async () => { await loadInitialData(); };

    // ═══════════════════════════════════════════════════════
    // DERIVED (lightweight useMemo, from WmsDataContext)
    // ═══════════════════════════════════════════════════════

    const staleStockItems = useMemo(() => stockItems.filter(i => i.status?.toLowerCase() === 'em estoque' && i.entryTime && !isSameDay(i.entryTime)), [stockItems]);
    const todayInboundList = useMemo(() => inboundItems.filter(i => isSameDay(i.time || (i as any).created_at)), [inboundItems]);
    const todayOutboundList = useMemo(() => outboundItems.filter(i => isSameDay(i.time || (i as any).createdAt || (i as any).created_at)), [outboundItems]);

    const inboundReconciliation = useMemo(() => {
        const scans = Array.from(new Set(todayInboundList.filter(i => !i.error).map(i => i.id)));
        const matches = expectedInboundList.filter(id => scans.includes(id));
        const missing = expectedInboundList.filter(id => !scans.includes(id));
        const unexpected = scans.filter(id => !expectedInboundList.includes(id));
        const pct = expectedInboundList.length > 0 ? Math.round((matches.length / expectedInboundList.length) * 100) : 0;
        return { matches, missing, unexpected, progressPercent: pct, successfulScansToday: scans };
    }, [todayInboundList, expectedInboundList]);

    const activeDriversCount = useMemo(() => drivers.filter(d => d.status === 'Ativo').length, [drivers]);
    const availableStockCount = useMemo(() => stockItems.filter(i => i.status?.toLowerCase() === 'em estoque').length, [stockItems]);

    // ═══════════════════════════════════════════════════════
    // PROVIDER VALUE
    // ═══════════════════════════════════════════════════════

    return (
        <WmsContext.Provider value={{
            currentUser, logout, login, register, updatePassword, adminResetPassword,
            users, inviteUser, refreshUsers, updateUserStatus, updateUser, deleteUser,
            currentView, setCurrentView,
            stockItems, possibleLossItems, staleStockItems,
            inboundItems, outboundItems, inventoryItems,
            drivers, treatmentItems, expeditions, rtsItems, rtsLogs, expectedInboundList,
            addInboundItem, setExpectedInboundList, clearInboundManifest,
            addOutboundItem, bulkAddOutboundItems, deleteOutboundItem,
            addInventoryItem, isInventoryActive, setIsInventoryActive, startInventory, stopInventory, localizeItem,
            addTreatment, updateTreatmentStatus, updateTreatment,
            addDriver, bulkAddDrivers, updateDriver, deleteDriver,
            updateExpeditionDelivered, verifyReturn, addRtsPendingItem,
            totalInboundToday: statsSummary.totalInboundToday,
            totalOutboundToday: statsSummary.totalOutboundToday,
            totalReversaToday: statsSummary.totalReversaToday,
            totalLossItems: statsSummary.totalLossItems,
            staleItemsCount: statsSummary.staleItemsCount,
            totalPossibleLosses: statsSummary.totalPossibleLosses,
            weeklyStats: statsSummary.weeklyStats,
            todayInboundList, todayOutboundList, inboundReconciliation,
            activeDriversCount, availableStockCount,
            totalInventoryScanned: inventoryItems.length,
            totalExpected: availableStockCount,
            todayReversaCount, operatorProductivity,
            refreshData: loadInitialData, broadcastRefresh, resetTransactions,
            fetchProductivityReport, fetchDriverTodayCount,
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
