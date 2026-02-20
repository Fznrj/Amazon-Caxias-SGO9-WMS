import { supabase } from './supabase';
import { User, Role, UserStatus } from '../types';

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

        return { success: true, message: 'Cadastro realizado! Aguarde aprovação de um administrador.' };
    },

    inviteUser: async (email: string, adminUser: User): Promise<{ success: boolean; message: string }> => {
        const tempPassword = 'Senh@Wms123';
        const { error } = await supabase.auth.signUp({
            email,
            password: tempPassword,
            options: {
                data: {
                    name: email.split('@')[0],
                    company_id: adminUser.company_id,
                    status: 'active',
                    role: 'operator',
                    force_password_reset: true
                }
            }
        });

        if (error) return { success: false, message: error.message };

        return { success: true, message: `Usuário convidado! A senha temporária é ${tempPassword}.` };
    },

    login: async (identifier: string, password: string): Promise<{ success: boolean; user?: User; message: string }> => {
        const cleanIdentifier = identifier.trim();
        const cleanPassword = password.trim();

        // identifier can be email, name or badge. Supabase Auth needs email.
        let email = cleanIdentifier;

        if (!cleanIdentifier.includes('@')) {
            // Try to find email by badge/name in public.users
            const { data: profile, error: findError } = await supabase
                .from('users')
                .select('email')
                .or(`badge.eq.${cleanIdentifier},name.eq.${cleanIdentifier}`)
                .maybeSingle();

            if (profile?.email) {
                email = profile.email;
            } else if (findError) {
                console.error('Error finding user by identifier:', findError);
            }
        }

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: cleanPassword
        });

        if (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Credenciais inválidas ou erro de conexão.' };
        }

        // Small delay to ensure session is registered in the client
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch full profile
        const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', data.user.id)
            .maybeSingle();

        if (profileError) {
            console.error('Profile load error:', profileError);
            return { success: false, message: `Erro ao carregar perfil do usuário: ${profileError.message}` };
        }

        if (!userProfile) {
            console.error('Profile not found for ID:', data.user.id);
            return { success: false, message: 'Perfil do usuário não encontrado no banco de dados. Contate o suporte.' };
        }

        const user = userProfile as User;

        if (user.status === 'blocked') {
            await supabase.auth.signOut();
            return { success: false, message: 'Usuário bloqueado. Contate o administrador.' };
        }

        if (user.status === 'pending') {
            await supabase.auth.signOut();
            return { success: false, message: 'Seu cadastro ainda está em análise.' };
        }

        AuthService.saveSession(user);
        return { success: true, user, message: 'Login realizado com sucesso!' };
    },

    updatePassword: async (newPassword: string): Promise<{ success: boolean; message: string }> => {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) return { success: false, message: error.message };

        // Also update force_password_reset in profile
        const user = AuthService.getCurrentUser();
        if (user) {
            await supabase.from('users').update({ force_password_reset: false }).eq('id', user.id);
            user.force_password_reset = false;
            AuthService.saveSession(user);
        }

        return { success: true, message: 'Senha atualizada com sucesso!' };
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
            return null;
        }
    },

    // --- Admin Actions ---
    updateUserStatus: async (userId: string, status: UserStatus, role?: Role | null): Promise<void> => {
        const updates: any = { status };
        if (role !== undefined) updates.role = role;

        await supabase
            .from('users')
            .update(updates)
            .eq('id', userId);

        // Note: Updating auth metadata for OTHER users requires a Service Role or Edge Function.
        // For now, RLS will fall back to (auth.uid() = id) which is non-recursive.
    },

    updateUser: async (originalId: string, updates: Partial<User>): Promise<{ success: boolean; message: string }> => {
        const { error } = await supabase
            .from('users')
            .update(updates)
            .eq('id', originalId);

        if (error) return { success: false, message: error.message };
        return { success: true, message: 'Usuário atualizado com sucesso.' };
    },

    deleteUser: async (userId: string): Promise<void> => {
        // We delete the profile. Deleting auth user requires service role or Edge Function.
        // For simplicity, we delete the profile and the user will lose access if RLS is tight.
        await supabase
            .from('users')
            .delete()
            .eq('id', userId);
    }
};
