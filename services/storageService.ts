import { Preferences } from '@capacitor/preferences';

/**
 * StorageService: Adaptador assíncrono para persistência de dados.
 * No Android/iOS, utiliza o armazenamento nativo persistente.
 * No Desktop/Web, utiliza o motor do Capacitor que mapeia para localStorage (ou motor disponível).
 */
export const StorageService = {
    async setItem(key: string, value: string): Promise<void> {
        await Preferences.set({
            key,
            value
        });
    },

    async getItem(key: string): Promise<string | null> {
        const { value } = await Preferences.get({ key });
        return value;
    },

    async removeItem(key: string): Promise<void> {
        await Preferences.remove({ key });
    },

    async clear(): Promise<void> {
        await Preferences.clear();
    },

    // Bridge para o Supabase Auth (que espera uma interface Sync ou específica)
    // O Supabase JS v2 aceita Storage personalizado.
    supabaseAdapter: {
        getItem: (key: string) => {
            // Nota: O Supabase v2 pode lidar com Promises se configurado corretamente,
            // ou podemos usar um cache síncrono inicializado no boot.
            // Para maior robustez no Capacitor, configuraremos o Supabase com suporte a Async.
            return Preferences.get({ key }).then(res => res.value);
        },
        setItem: (key: string, value: string) => {
            return Preferences.set({ key, value });
        },
        removeItem: (key: string) => {
            return Preferences.remove({ key });
        }
    }
};
