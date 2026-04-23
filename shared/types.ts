export type Role = 'manager' | 'secretary' | 'madar' | 'diver';

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  team_id: number | null;
  diver_id: number | null;
  created_at: string;
}

export interface Diver {
  id: number;
  first_name: string;
  last_name: string;
  id_number: string;
  phone: string;
  email: string;
  medical_status: 'valid' | 'expired' | 'pending';
  medical_expiry_date: string | null;
  medical_last_updated: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface DiverCertification {
  id: number;
  diver_id: number;
  certification_level_id: number;
  level_name: string;
  expiry_date: string | null;
  issued_date: string | null;
  notes: string;
}

export interface DiverWithDetails extends Diver {
  certifications: DiverCertification[];
  certification_names: string;
  teams: { id: number; name: string }[];
  team_names: string;
}

export interface CertificationLevel {
  id: number;
  name: string;
  description: string;
  sort_order: number;
}

export interface Team {
  id: number;
  name: string;
  madar_user_id: number | null;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface ApiError {
  error: string;
}
