export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show';

export interface Appointment {
  id: string;
  clientId: string;
  therapistId: string;
  serviceId: string;
  bedId?: string;
  status: AppointmentStatus;
  scheduledAt: string;
  durationMinutes: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Availability {
  id: string;
  therapistId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
}
