export type MembershipStatus = 'active' | 'paused' | 'cancelled' | 'expired';

export interface MembershipPlan {
  id: string;
  name: string;
  description?: string;
  priceMonthly: number;
  creditsPerMonth: number;
  isActive: boolean;
}

export interface Membership {
  id: string;
  clientId: string;
  planId: string;
  status: MembershipStatus;
  startDate: string;
  endDate?: string;
  creditsRemaining: number;
  stripeSubscriptionId?: string;
  createdAt: string;
  updatedAt: string;
}
