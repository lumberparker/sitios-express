// Pasarela de pago: Stripe Checkout (página hospedada por Stripe).
//
// Flujo: el cliente pulsa "Pagar"/"Pagar saldo" → POST /api/sites/[key]/checkout
// crea una sesión con el monto pendiente → redirección a Stripe → al pagar,
// Stripe llama a /api/webhooks/stripe y ahí se marca PAID y se desbloquea la
// descarga.
//
// Requiere en .env (o variables de Vercel):
//   STRIPE_SECRET_KEY=sk_test_... o sk_live_...
//   STRIPE_WEBHOOK_SECRET=whsec_...  (para confirmar el pago)
//   NEXTAUTH_URL=https://tu-dominio.com  (URLs de éxito/cancelación)

import Stripe from "stripe";

/** true si hay una secret key real de Stripe (no vacía ni placeholder). */
export function isStripeConfigured(): boolean {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) return false;
  // Placeholders del .env.example
  if (key.includes("...") || key.includes("sk_test_o_sk_live")) return false;
  return key.startsWith("sk_test_") || key.startsWith("sk_live_");
}

export function stripeClient(): Stripe | null {
  if (!isStripeConfigured()) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY!.trim());
}

function appUrl() {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Crea la sesión de Checkout por el monto pendiente (en MXN).
 * Devuelve la URL de pago, o null si Stripe no está configurado.
 */
export async function createCheckoutSession(args: {
  siteId: string;
  editKey: string;
  description: string;
  amountMxn: number;
}): Promise<string | null> {
  const stripe = stripeClient();
  if (!stripe) return null;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "mxn",
          unit_amount: Math.round(args.amountMxn * 100),
          product_data: { name: args.description },
        },
      },
    ],
    // Los métodos de pago (tarjeta, OXXO, SPEI…) se controlan desde el
    // dashboard de Stripe, no aquí.
    metadata: {
      siteId: args.siteId,
      editKey: args.editKey,
    },
    // {CHECKOUT_SESSION_ID} lo sustituye Stripe; el builder confirma el pago
    // con esa sesión aunque el webhook falle o se demore.
    success_url: `${appUrl()}/builder/${args.editKey}?pago=exitoso&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl()}/builder/${args.editKey}?pago=cancelado`,
  });

  return session.url;
}
