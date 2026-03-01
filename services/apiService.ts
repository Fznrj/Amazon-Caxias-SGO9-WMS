import { supabase } from './supabase';
import { InboundItem, OutboundItem, StockItem, TreatmentItem, Driver, ExpeditionItem, User } from '../types';
import { getSaoPauloDate, getSaoPauloIso } from '../utils/dateUtils';

// Result wrapper for standardized error handling
export interface ApiResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export const ApiService = {
    // --- Scoping Helper ---
    applyScope: (query: any, user: User | null, ignoreScope: boolean = false) => {
        if (!user || ignoreScope) return query;
        const role = (user.role || '').toLowerCase();
        if (role === 'superadmin') return query;
        return query.eq('company_id', user.company_id);
    },

    // --- Inbound Operations ---
    logInbound: async (item: InboundItem, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('inbound_log').insert({
            id: item.id,
            status: item.status,
            operator: item.operator,
            time: item.time,
            error: item.error,
            company_id: user.company_id
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    clearInboundManifest: async (user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('system_configs')
            .update({ expected_inbound: [] })
            .eq('company_id', user.company_id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    setExpectedInboundList: async (list: string[], user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('system_configs').upsert({
            company_id: user.company_id,
            expected_inbound: list,
            updated_at: new Date().toISOString()
        }, { onConflict: 'company_id' });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    // --- Outbound Operations ---
    logOutbound: async (item: OutboundItem, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('outbound_log').insert({
            id: item.id,
            driver_name: item.driverName,
            vehicle: item.vehicle,
            time: item.time,
            operator: item.operator,
            status: item.status,
            pallet_id: item.palletId,
            company_id: user.company_id
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    bulkLogOutbound: async (items: OutboundItem[], user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('outbound_log').insert(
            items.map(i => ({
                id: i.id,
                driver_name: i.driverName,
                vehicle: i.vehicle,
                time: i.time,
                operator: i.operator,
                status: i.status,
                pallet_id: i.palletId,
                company_id: user.company_id
            }))
        );
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    deleteOutbound: async (id: string, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('outbound_log')
            .delete()
            .eq('id', id)
            .eq('company_id', user.company_id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    // --- Stock Operations ---
    upsertStockItem: async (id: string, operator: string, status: string, user: User, rackLocation?: string): Promise<ApiResult> => {
        const now = getSaoPauloIso();
        const data: any = {
            id,
            entry_time: now,
            operator,
            status,
            company_id: user.company_id
        };
        if (rackLocation) data.rack_location = rackLocation;

        const { error } = await supabase.from('stock_items').upsert(data);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    updateStockStatus: async (ids: string[], status: string, user: User, extraFields: any = {}): Promise<ApiResult> => {
        const { error } = await supabase.from('stock_items')
            .update({ status, ...extraFields })
            .in('id', ids)
            .eq('company_id', user.company_id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    // --- Driver Operations ---
    saveDriver: async (driver: Driver, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('drivers').upsert({
            id: driver.id,
            name: driver.name,
            cpf: driver.cpf,
            plate: driver.plate,
            company: driver.company,
            status: driver.status,
            vehicle_profile: driver.vehicleProfile,
            company_id: user.company_id,
            last_activity: getSaoPauloIso()
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    deleteDriver: async (id: string, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('drivers')
            .delete()
            .eq('id', id)
            .eq('company_id', user.company_id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    updateDriver: async (id: string, updates: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('drivers')
            .update(updates)
            .eq('id', id)
            .eq('company_id', user.company_id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    bulkAddDrivers: async (drivers: Driver[], user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('drivers').insert(
            drivers.map(d => ({
                id: d.id,
                name: d.name,
                cpf: d.cpf,
                plate: d.plate,
                company: d.company,
                status: d.status,
                vehicle_profile: d.vehicleProfile,
                company_id: user.company_id,
                last_activity: getSaoPauloIso()
            }))
        );
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    // --- RTS & Expeditions ---
    upsertExpedition: async (data: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('expeditions').upsert({
            ...data,
            company_id: user.company_id,
            updated_at: new Date().toISOString()
        }, { onConflict: 'company_id, driver_name, dispatch_date' });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    updateExpedition: async (id: string, updates: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('expeditions')
            .update(updates)
            .eq('id', id)
            .eq('company_id', user.company_id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    logRts: async (item: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('rts_log').insert({
            ...item,
            company_id: user.company_id
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    // --- Treatment / Incidents ---
    saveIncident: async (incident: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('incidents').insert({
            ...incident,
            company_id: user.company_id
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    updateIncident: async (id: string, updates: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('incidents')
            .update(updates)
            .eq('id', id)
            .eq('company_id', user.company_id);
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    uploadAvatar: async (file: File, user: User): Promise<ApiResult<string>> => {
        const fileExt = file.name.split('.').pop();
        const filePath = `${user.id}/${Math.random()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file);

        if (uploadError) return { success: false, error: uploadError.message };

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

        const { error: updateError } = await supabase
            .from('users')
            .update({ avatar_url: publicUrl })
            .eq('id', user.id);

        if (updateError) return { success: false, error: updateError.message };

        return { success: true, data: publicUrl };
    },

    updateConfig: async (updates: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('system_configs')
            .upsert({
                company_id: user.company_id,
                ...updates,
                updated_at: new Date().toISOString()
            }, { onConflict: 'company_id' });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    fetchAppData: async (user: User): Promise<ApiResult<any>> => {
        const companyId = user.company_id;
        const role = (user.role || '').toLowerCase();
        const isSuperAdmin = role === 'superadmin';
        const todayStr = getSaoPauloDate();

        try {
            const results = await Promise.all([
                ApiService.applyScope(supabase.from('drivers').select('*'), user),
                ApiService.applyScope(supabase.from('system_configs').select('*'), user).single(),
                ApiService.applyScope(supabase.from('v_today_inventory_log').select('*'), user),
                ApiService.applyScope(supabase.from('v_today_rts_items').select('*'), user),
                ApiService.applyScope(supabase.from('expeditions').select('*').order('dispatch_date', { ascending: false }), user),
                ApiService.applyScope(supabase.from('v_dashboard_stats').select('*').single(), user),
                ApiService.applyScope(supabase.from('v_weekly_stats').select('*'), user),
                ApiService.applyScope(
                    supabase.from('v_today_inbound_log').select('*')
                        .order('created_at', { ascending: false }).limit(500),
                    user
                ),
                ApiService.applyScope(
                    supabase.from('v_today_outbound_log').select('*')
                        .not('status', 'ilike', '%reversa%')
                        .limit(500),
                    user
                ),
                ApiService.applyScope(
                    supabase.from('v_today_outbound_log').select('*')
                        .ilike('status', '%reversa%')
                        .limit(500),
                    user
                ),
                ApiService.applyScope(supabase.from('stock_items').select('*'), user),
                // incidents are historically mixed, keep a reasonable limit or apply today if required, but user prefers them to stay if +1 day:
                ApiService.applyScope(supabase.from('incidents').select('*').order('created_at', { ascending: false }).limit(150), user),
                ApiService.applyScope(supabase.from('v_today_operator_productivity').select('*'), user),
                ApiService.applyScope(
                    supabase.from('v_today_rts_log').select('*'),
                    user
                )
            ]);

            return { success: true, data: results };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    resetTransactions: async (user: User): Promise<ApiResult> => {
        const companyId = user.company_id;
        const tables = [
            'inbound_log', 'outbound_log', 'stock_items', 'incidents',
            'inventory', 'expeditions', 'rts_log', 'rts_items', 'gamification_profiles'
        ];

        try {
            await Promise.all(tables.map(table =>
                supabase.from(table).delete().eq('company_id', companyId)
            ));
            await supabase.from('system_configs').update({ expected_inbound: [] }).eq('company_id', companyId);
            await supabase.rpc('refresh_weekly_movement');
            return { success: true };
        } catch (error: any) {
            return { success: false, error: error.message };
        }
    },

    fetchProductivityReport: async (start: string, end: string, user: User): Promise<ApiResult<any[]>> => {
        const query = supabase.from('v_operator_productivity')
            .select('*')
            .gte('scan_date', start)
            .lte('scan_date', end);

        const { data, error } = await ApiService.applyScope(query, user);
        if (error) return { success: false, error: error.message };
        return { success: true, data };
    },

    fetchDriverTodayCount: async (driverId: string, user: User): Promise<ApiResult<number>> => {
        const query = supabase.from('v_today_outbound_log')
            .select('id', { count: 'exact', head: true })
            .eq('driver_id', driverId);

        const { count, error } = await ApiService.applyScope(query, user);
        if (error) return { success: false, error: error.message };
        return { success: true, data: count || 0 };
    },

    adminResetPassword: async (userId: string, newPassword: string): Promise<ApiResult> => {
        const { data, error } = await supabase.functions.invoke('admin-reset-password', {
            body: { userId, newPassword }
        });
        if (error) return { success: false, error: error.message };
        return { success: true, data };
    },

    getGamificationProfiles: async (user: User): Promise<ApiResult<any[]>> => {
        const query = supabase.from('gamification_profiles').select('*');
        const { data, error } = await ApiService.applyScope(query, user, true); // Admin/Superadmin sees all if needed
        if (error) return { success: false, error: error.message };
        return { success: true, data };
    },

    saveGamificationProfile: async (profile: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('gamification_profiles').upsert({
            ...profile,
            company_id: user.company_id
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    }
};
