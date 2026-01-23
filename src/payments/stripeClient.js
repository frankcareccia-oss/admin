import { loadStripe } from "@stripe/stripe-js";

export const stripePk = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
export const backendBaseUrl = (import.meta.env.VITE_BACKEND_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

if (!stripePk) {
  console.error("[stripeClient] Missing VITE_STRIPE_PUBLISHABLE_KEY (check admin/.env and restart dev server)");
}
if (!import.meta.env.VITE_BACKEND_BASE_URL) {
  console.warn("[stripeClient] VITE_BACKEND_BASE_URL not set; defaulting to http://localhost:3001");
}

export const stripePromise = loadStripe(stripePk);
