import { User, Role, UserStatus } from '../types';

const CURRENT_USER_KEY = 'wms_current_user';
const ALL_USERS_KEY = 'wms_all_users';

// Initialize Master User in Offline mode
const seedMasterUser = () => {
    const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');
    const masterEmail = 'fernando10frango@gmail.com';
    const hasMaster = users.some((u: User) => u.email === masterEmail);

    if (!hasMaster) {
        const masterUser: User = {
            id: 'master-user-id-' + Math.random().toString(36).substr(2, 9),
            name: 'Fernando Souza',
            email: masterEmail,
            password_hash: '142536Fernando*', // For local dev, storing plain/hash is same
            role: 'superadmin',
            status: 'active',
            company_id: 'DeLuna Amazon Caxias SGO9',
            created_at: new Date().toISOString()
        };
        users.push(masterUser);
        localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
    }
};

seedMasterUser();

export const AuthService = {
    // --- Data Management ---
    getUsers: async (): Promise<User[]> => {
        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');
        return users.sort((a: User, b: User) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },

    // --- Auth Actions ---
    register: async (name: string, email: string, password: string, companyId: string, customId?: string): Promise<{ success: boolean; message: string }> => {
        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');

        if (users.some((u: User) => u.email === email)) {
            return { success: false, message: 'Email já cadastrado.' };
        }

        const newUser: User = {
            id: 'user-' + Math.random().toString(36).substr(2, 9),
            name,
            email,
            password_hash: password,
            role: null,
            status: 'pending',
            company_id: companyId,
            badge: customId,
            created_at: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));

        return { success: true, message: 'Cadastro realizado! Aguarde aprovação.' };
    },

    inviteUser: async (email: string, adminUser: User): Promise<{ success: boolean; message: string }> => {
        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');

        if (users.some((u: User) => u.email === email)) {
            return { success: false, message: 'Usuário já existe.' };
        }

        const newUser: User = {
            id: 'user-' + Math.random().toString(36).substr(2, 9),
            name: email.split('@')[0],
            email,
            password_hash: 'Senh@Wms123',
            role: 'operator',
            status: 'active',
            company_id: adminUser.company_id,
            force_password_reset: true,
            created_at: new Date().toISOString()
        };

        users.push(newUser);
        localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));

        return { success: true, message: 'Usuário convidado! A senha temporária é Senh@Wms123' };
    },

    login: async (identifier: string, password: string): Promise<{ success: boolean; user?: User; message: string }> => {
        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');

        const user = users.find((u: User) =>
            (u.email === identifier || u.name === identifier || u.badge === identifier) &&
            u.password_hash === password
        );

        if (!user) {
            return { success: false, message: 'Credenciais inválidas.' };
        }

        if (user.status === 'blocked') {
            return { success: false, message: 'Usuário bloqueado. Contate o admin.' };
        }

        if (user.status === 'pending') {
            return { success: false, message: 'Cadastro em análise.' };
        }

        AuthService.saveSession(user);
        return { success: true, user, message: 'Login realizado com sucesso!' };
    },

    updatePassword: async (newPassword: string): Promise<{ success: boolean; message: string }> => {
        const currentUser = AuthService.getCurrentUser();
        if (!currentUser) return { success: false, message: 'Não autenticado.' };

        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');
        const userIdx = users.findIndex((u: User) => u.id === currentUser.id);

        if (userIdx >= 0) {
            users[userIdx].password_hash = newPassword;
            users[userIdx].force_password_reset = false;
            localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));

            AuthService.saveSession({ ...users[userIdx] });
            return { success: true, message: 'Senha atualizada com sucesso!' };
        }

        return { success: false, message: 'Usuário não encontrado.' };
    },

    logout: async () => {
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
        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');
        const userIdx = users.findIndex((u: User) => u.id === userId);

        if (userIdx >= 0) {
            users[userIdx].status = status;
            if (role !== undefined) users[userIdx].role = role;
            localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
        }
    },

    updateUser: async (originalId: string, updates: Partial<User>): Promise<{ success: boolean; message: string }> => {
        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');
        const userIdx = users.findIndex((u: User) => u.id === originalId);

        if (userIdx >= 0) {
            users[userIdx] = { ...users[userIdx], ...updates };
            localStorage.setItem(ALL_USERS_KEY, JSON.stringify(users));
            return { success: true, message: 'Usuário atualizado com sucesso.' };
        }
        return { success: false, message: 'Usuário não encontrado.' };
    },

    deleteUser: async (userId: string): Promise<void> => {
        const users = JSON.parse(localStorage.getItem(ALL_USERS_KEY) || '[]');
        const filtered = users.filter((u: User) => u.id !== userId);
        localStorage.setItem(ALL_USERS_KEY, JSON.stringify(filtered));
    }
};
