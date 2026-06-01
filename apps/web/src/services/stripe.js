import { loadStripe } from '@stripe/stripe-js';

let stripePromise = null;

export const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

export function getStripePromise() {
  if (!stripePublishableKey) return null;
  if (!stripePromise) stripePromise = loadStripe(stripePublishableKey);
  return stripePromise;
}
