export type UserRole = 'client' | 'therapist' | 'owner';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roles: UserRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Client extends User {
  notes?: string;
  preferredTherapistId?: string;
}

export interface Therapist extends User {
  bio?: string;
  specialties?: string[];
  isAcceptingClients: boolean;
}
