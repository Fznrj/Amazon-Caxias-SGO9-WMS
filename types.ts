
export enum View {
  LOGIN = 'LOGIN',
  DASHBOARD = 'DASHBOARD',
  INBOUND = 'INBOUND',
  OUTBOUND = 'OUTBOUND',
  INVENTORY = 'INVENTORY',
  TREATMENTS = 'TREATMENTS',
  PRODUCTIVITY = 'PRODUCTIVITY',
  REPORTS = 'REPORTS',
  USERS = 'USERS',
  DRIVERS = 'DRIVERS',
  REVERSA = 'REVERSA', // Added Reversa view
  GAMIFICATION = 'GAMIFICATION',
  SETTINGS = 'SETTINGS'
}

export interface TBRUnit {
  id: string;
  sku: string;
  model: string;
  type: string;
  status: 'Processado' | 'Em Triagem' | 'Possível Perda' | 'Dano Crítico';
  timestamp: string;
  operator: string;
  location: string;
}

export type Role = 'operator' | 'coordinator' | 'supervisor' | 'leader' | 'admin' | 'superadmin';
export type UserStatus = 'pending' | 'active' | 'blocked';

export interface User {
  id: string; // uuid
  name: string;
  email: string; // unique
  password_hash: string;
  role: Role | null; // null for pending
  status: UserStatus;
  company_id: string;
  created_at: string;
  last_login?: string;
  badge?: string; // keeping badge for legacy compatibility with UI
  force_password_reset?: boolean;
  avatar_url?: string;
}

export type VehicleProfile = 'Moto' | 'Passeio' | 'Utilitário' | 'Van' | 'Vuc' | 'Carreta';

// Keeping Driver interface as is
export interface Driver {
  id: string;
  name: string;
  cpf: string;
  plate: string;
  company: string;
  status: 'Ativo' | 'Inativo' | 'Pendente' | 'Bloqueado';
  vehicleProfile: VehicleProfile;
  lastActivity: string;
}

export interface LoginViewProps {
  onLoginSuccess: () => void;
  onNavigateRegister: () => void;
}
