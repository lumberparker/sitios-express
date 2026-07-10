import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/payments";
import { markSitePaid } from "@/lib/mark-paid";

export const runtime = "nodejs";

/**
 * Webhook de Stripe. Registrar en el dashboard:
 *   URL: https://<dominio>/api/webhooks/stripe
 *   Eventos: checkout.session.completed, checkout.session.async_payment_succeeded
 * El signing secret (whsec_...) va en STRIPE_WEBHOOK_SECRET.
 *
 * checkout.session.async_payment_succeeded cubre OXXO/SPEI, que confirman
 * horas después del checkout.
 *
 * Nota: el builder también confirma el pago al volver con session_id
 * (POST /api/sites/[key]/confirm-payment) por si este webhook no llega.
 */
export async function POST(req: Request) {
  const stripe = stripeClient();
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!stripe || !secret || secret.includes("REEMPLAZA") || secret.includes("...")) {
    console.error("[stripe webhook] STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET no configurados");
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[stripe webhook] firma inválida:", err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const siteId = session.metadata?.siteId;

    console.log(
      `[stripe webhook] ${event.type} siteId=${siteId ?? "?"} payment_status=${session.payment_status}`
    );

    if (!siteId) {
      console.error("[stripe webhook] sesión sin metadata.siteId", session.id);
      return NextResponse.json({ received: true, warned: "missing siteId" });
    }

    // Tarjeta: payment_status === "paid" al completar.
    // Métodos async: a veces completed llega con "unpaid" y luego async_payment_succeeded.
    if (session.payment_status === "paid") {
      const amountMxn =
        typeof session.amount_total === "number"
          ? Math.round(session.amount_total / 100)
          : undefined;
      await markSitePaid(siteId, amountMxn);
    } else {
      console.log(
        `[stripe webhook] sesión ${session.id} aún no paid (${session.payment_status}); se espera async_payment_succeeded si aplica`
      );
    }
  }

  return NextResponse.json({ received: true });
}
