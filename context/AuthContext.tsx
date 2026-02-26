/**
 * AuthContext.tsx
 * ─────────────────────────────────────────────────────────────
 * Responsabilidade ÚNICA: gerenciar autenticação e sessão.
 *  - currentUser, login, logout, register, refreshProfile
 *  - App initialization (splash screen)
 *
 * Este contexto é o mais EXTERNO da árvore, sem dependências
 * de nenhum outro provider de dados.
 * ─────────────────────────────────────────────────────────────
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Role, UserStatus, View } from '../types';
import { AuthService } from '../services/authService';
import { StorageService } from '../services/storageService';
import { supabase } from '../services/supabase';

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface AuthContextValue {
    currentUser: User | null;
    setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
    loading: boolean;
    login: (identifier: string, password: string) => Promise<{ success: boolean; message: string }>;
    logout: () => Promise<void>;
    register: (name: string, email: string, password: string, companyId: string, customId?: string) => Promise<{ success: boolean; message: string }>;
    refreshProfile: () => Promise<void>;
    updatePassword: (newPassword: string) => Promise<{ success: boolean; message: string }>;
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export const useAuth = () => useContext(AuthContext);

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

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
                    console.error('AuthContext: Profile refresh error', error);
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

            // No user found
            setCurrentUser(null);
        } catch (err) {
            console.error('AuthContext: Profile refresh failed', err);
            setCurrentUser(null);
        }
    };

    // App initialization
    useEffect(() => {
        const initializeApp = async () => {
            const timeout = setTimeout(() => {
                setLoading(false);
            }, 5000);

            try {
                await refreshProfile();
            } catch (err) {
                console.error('AuthContext: Initialization failed', err);
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
                await StorageService.setItem('wms_active_view', View.DASHBOARD);
            }
            return { success: result.success, message: result.message };
        } catch (err: any) {
            return { success: false, message: `Erro crítico: ${err.message || 'Erro desconhecido'}` };
        }
    };

    const logout = async () => {
        try {
            await AuthService.logout();
        } finally {
            setCurrentUser(null);
            localStorage.removeItem('wms_active_view');
        }
    };

    const register = async (name: string, email: string, password: string, companyId: string, customId?: string) => {
        return AuthService.register(name, email, password, companyId, customId);
    };

    const updatePassword = async (newPassword: string) => {
        const result = await AuthService.updatePassword(newPassword);
        if (result.success && currentUser) {
            setCurrentUser({ ...currentUser, force_password_reset: false });
        }
        return result;
    };

    return (
        <AuthContext.Provider value={{
            currentUser, setCurrentUser, loading,
            login, logout, register, refreshProfile, updatePassword
        }}>
            {children}
        </AuthContext.Provider>
    );
};
