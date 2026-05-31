export interface Service {
  id: string;
  name: string;
  description?: string;
  durationMinutes: number;
  price: number;
  isActive: boolean;
}

export interface MassageBed {
  id: string;
  name: string;
  isActive: boolean;
}

export interface BusinessHours {
  id: string;
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}
