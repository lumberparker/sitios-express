// Pasarela de pago: Stripe Checkout (página hospedada por Stripe).
//
// Flujo: el cliente pulsa "Pagar"/"Pagar saldo" → POST /api/sites/[key]/checkout
// crea una sesión con el monto pendiente → redirección a Stripe → al pagar,
// Stripe llama a /api/webhooks/stripe y ahí se marca PAID y se desbloquea la
// descarga. Sin STRIPE_SECRET_KEY configurada, el builder usa el flujo
// placeholder (registrar solicitud y cobrar fuera de línea).

import Stripe from "stripe";

export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  return key ? new Stripe(key) : null;
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
    metadata: { siteId: args.siteId },
    success_url: `${appUrl()}/builder/${args.editKey}?pago=exitoso`,
    cancel_url: `${appUrl()}/builder/${args.editKey}?pago=cancelado`,
  });

  return session.url;
}
