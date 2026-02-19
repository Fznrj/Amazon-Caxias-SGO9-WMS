import { User, Role, UserStatus } from '../types';
import { supabase } from './supabase';

const CURRENT_USER_KEY = 'wms_current_user';

export const AuthService = {
    // --- Data Management ---
    getUsers: async (): Promise<User[]> => {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching users:', error);
            return [];
        }
        return data as User[];
    },

    // --- Auth Actions ---
    register: async (name: string, email: string, password: string, companyId: string, customId?: string): Promise<{ success: boolean; message: string }> => {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name,
                    company_id: companyId,
                    badge: customId
                }
            }
        });

        if (error) {
            return { success: false, message: error.message };
        }

        return { success: true, message: 'Cadastro realizado! Aguarde aprovação.' };
    },

    login: async (identifier: string, password: string): Promise<{ success: boolean; user?: User; message: string }> => {
        let email = identifier;

        // If identifier is not an email, try to find user by name or badge
        if (!identifier.includes('@')) {
            const { data: userData, error: findError } = await supabase
                .from('users')
                .select('email')
                .or(`name.eq."${identifier}",badge.eq."${identifier}"`)
                .single();

            if (userData?.email) {
                email = userData.email;
            } else {
                return { success: false, message: 'Usuário não encontrado pelo Nome ou ID.' };
            }
        }

        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            return { success: false, message: 'Credenciais inválidas ou erro no servidor.' };
        }

        if (authData?.user) {
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (userError || !userData) {
                return { success: false, message: 'Perfil do usuário não encontrado.' };
            }

            const user = userData as User;

            if (user.status === 'blocked') {
                await supabase.auth.signOut();
                return { success: false, message: 'Usuário bloqueado. Contate o admin.' };
            }

            if (user.status === 'pending') {
                await supabase.auth.signOut();
                return { success: false, message: 'Cadastro em análise.' };
            }

            AuthService.saveSession(user);
            return { success: true, user, message: 'Login realizado com sucesso!' };
        }

        return { success: false, message: 'Falha na autenticação.' };
    },

    logout: async () => {
        await supabase.auth.signOut();
        localStorage.removeItem(CURRENT_USER_KEY);
    },

    // --- Session Management ---
    saveSession: (user: User) => {
        localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    },

    getCurrentUser: (): User | null => {
        try {
            const data = localStorage.getItem(CURRENT_USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Error parsing session data:', e);
            localStorage.removeItem(CURRENT_USER_KEY);
            return null;
        }
    },

    // --- Admin Actions ---
    updateUserStatus: async (userId: string, status: UserStatus, role?: Role | null): Promise<void> => {
        const updates: any = { status };
        if (role !== undefined) updates.role = role;

        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);

        if (error) console.error('Error updating user status:', error);
    },

    updateUser: async (originalId: string, updates: Partial<User>): Promise<{ success: boolean; message: string }> => {
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', originalId);

        if (error) {
            return { success: false, message: error.message };
        }
        return { success: true, message: 'Usuário atualizado com sucesso.' };
    },

    deleteUser: async (userId: string): Promise<void> => {
        const { error } = await supabase
            .from('users')
            .delete()
            .eq('id', userId);

        if (error) console.error('Error deleting user:', error);
    }
};
