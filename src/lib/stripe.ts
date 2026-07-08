import { loadStripe, type Stripe } from "@stripe/stripe-js";

const publishableKey =
  typeof import.meta !== "undefined" ? import.meta.env?.VITE_STRIPE_PUBLISHABLE_KEY : undefined;

/**
 * A single shared Stripe.js instance (loadStripe caches internally, but we keep
 * one promise so components don't re-trigger the loader). Resolves to null if the
 * publishable key is not configured.
 */
export const stripePromise: Promise<Stripe | null> = publishableKey
  ? loadStripe(publishableKey)
  : Promise.resolve(null);

export const isStripeConfigured = Boolean(publishableKey);
