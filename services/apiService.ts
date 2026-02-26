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
    applyScope: (query: any, user: User | null) => {
        if (!user) return query;
        const role = (user.role || '').toLowerCase();
        if (role === 'superadmin') return query;
        return query.eq('company_id', user.company_id);
    },

    // --- Inbound Operations ---
    logInbound: async (item: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('inbound_log').insert({
            ...item,
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
    logOutbound: async (item: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('outbound_log').insert({
            ...item,
            company_id: user.company_id
        });
        if (error) return { success: false, error: error.message };
        return { success: true };
    },

    bulkLogOutbound: async (items: any[], user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('outbound_log').insert(
            items.map(i => ({ ...i, company_id: user.company_id }))
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
    saveDriver: async (driver: any, user: User): Promise<ApiResult> => {
        const { error } = await supabase.from('drivers').upsert({
            ...driver,
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
    }
};
