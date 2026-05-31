export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  clientId: string;
  appointmentId?: string;
  membershipId?: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  stripePaymentIntentId?: string;
  createdAt: string;
}

export interface PaymentMethod {
  id: string;
  clientId: string;
  stripePaymentMethodId: string;
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
}
