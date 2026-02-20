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

    inviteUser: async (email: string, adminUser: User): Promise<{ success: boolean; message: string }> => {
        const tempPassword = 'Senh@Wms123';
        const { data, error } = await supabase.auth.signUp({
            email,
            password: tempPassword,
            options: {
                data: {
                    name: email.split('@')[0],
                    company_id: adminUser.company_id,
                    force_password_reset: true,
                    status: 'active'
                }
            }
        });

        if (error) {
            // Restore admin session even on failure
            AuthService.saveSession(adminUser);
            return { success: false, message: error.message };
        }

        // Restore admin session immediately to avoid hijacking
        AuthService.saveSession(adminUser);

        // Trigger an official invitation email via Supabase Password Reset flow
        await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin
        });

        // Final session restoration check
        AuthService.saveSession(adminUser);

        return { success: true, message: 'Usuário convidado! Um link de acesso foi enviado para o email: ' + email };
    },

    login: async (identifier: string, password: string): Promise<{ success: boolean; user?: User; message: string }> => {
        let email = identifier;

        // If identifier is not an email, try to find user by name or badge using secure RPC
        if (!identifier.includes('@')) {
            console.log('AuthService: resolving identifier:', identifier);
            try {
                const { data: resolvedEmail, error: rpcError } = await supabase
                    .rpc('get_user_email_by_identifier', { p_identifier: String(identifier).trim() });

                if (rpcError) {
                    console.error('AuthService: RPC resolution error:', rpcError);
                    // If RPC fails (e.g. 406), attempt a direct query if RLS allows (fallback)
                    console.log('AuthService: Attempting fallback query for identifier');
                    const { data: user } = await supabase.from('users')
                        .select('email')
                        .or(`name.eq."${identifier}",badge.eq."${identifier}"`)
                        .maybeSingle();

                    if (user?.email) {
                        email = user.email;
                    } else {
                        return { success: false, message: 'Identificador não reconhecido ou erro de conexão.' };
                    }
                } else if (resolvedEmail) {
                    console.log('AuthService: identifier resolved to:', resolvedEmail);
                    email = resolvedEmail;
                } else {
                    return { success: false, message: 'Usuário não encontrado pelo Nome ou ID.' };
                }
            } catch (err) {
                console.error('AuthService: Critical error in identifier resolution:', err);
                return { success: false, message: 'Falha crítica ao validar usuário.' };
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

    updatePassword: async (newPassword: string): Promise<{ success: boolean; message: string }> => {
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        if (error) {
            return { success: false, message: error.message };
        }

        // Update public.users table to clear reset flag
        const currentUser = AuthService.getCurrentUser();
        if (currentUser) {
            await supabase
                .from('users')
                .update({ force_password_reset: false })
                .eq('id', currentUser.id);

            // Update local session
            AuthService.saveSession({ ...currentUser, force_password_reset: false });
        }

        return { success: true, message: 'Senha atualizada com sucesso!' };
    },

    logout: async () => {
        try {
            await supabase.auth.signOut();
        } catch (e) {
            console.error('Logout error:', e);
        } finally {
            localStorage.removeItem(CURRENT_USER_KEY);
        }
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
