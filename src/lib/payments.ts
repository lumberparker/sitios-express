// Pasarela de pago — PREPARADA, NO IMPLEMENTADA (fase 8 del plan).
//
// Cuando se integre Stripe:
// 1. npm i stripe
// 2. Definir STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET en .env
// 3. Implementar createCheckoutSession con line_items desde Invoice.lineItems
// 4. Crear /api/webhooks/stripe para marcar Invoice.status = PAID y
//    Site.status = PAID al recibir checkout.session.completed

export type CheckoutSession = { url: string };

export async function createCheckoutSession(_args: {
  siteId: string;
  lineItems: { label: string; qty: number; unitPrice: number }[];
  total: number;
}): Promise<CheckoutSession> {
  // TODO(stripe): reemplazar por stripe.checkout.sessions.create(...)
  throw new Error("Pasarela de pago aún no integrada. Ver src/lib/payments.ts");
}
