import { Preferences } from '@capacitor/preferences';

/**
 * StorageService: Adaptador assíncrono para persistência de dados.
 * No Android/iOS, utiliza o armazenamento nativo persistente.
 */
export const StorageService = {
    async setItem(key: string, value: string): Promise<void> {
        try {
            await Preferences.set({ key, value });
        } catch (err) {
            console.error(`StorageService: Error setting key "${key}"`, err);
            throw err;
        }
    },

    async getItem(key: string): Promise<string | null> {
        try {
            const { value } = await Preferences.get({ key });
            return value;
        } catch (err) {
            console.error(`StorageService: Error getting key "${key}"`, err);
            return null;
        }
    },

    async removeItem(key: string): Promise<void> {
        try {
            await Preferences.remove({ key });
        } catch (err) {
            console.error(`StorageService: Error removing key "${key}"`, err);
        }
    },

    async clear(): Promise<void> {
        try {
            await Preferences.clear();
        } catch (err) {
            console.error('StorageService: Error clearing preferences', err);
        }
    },

    // Adaptador para o Supabase Auth (Suporta Async no v2)
    supabaseAdapter: {
        getItem: async (key: string): Promise<string | null> => {
            try {
                const { value } = await Preferences.get({ key });
                return value;
            } catch (err) {
                console.error(`SupabaseAdapter: Error getting "${key}"`, err);
                return null;
            }
        },
        setItem: async (key: string, value: string): Promise<void> => {
            try {
                await Preferences.set({ key, value });
            } catch (err) {
                console.error(`SupabaseAdapter: Error setting "${key}"`, err);
            }
        },
        removeItem: async (key: string): Promise<void> => {
            try {
                await Preferences.remove({ key });
            } catch (err) {
                console.error(`SupabaseAdapter: Error removing "${key}"`, err);
            }
        }
    }
};
