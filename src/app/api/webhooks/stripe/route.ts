import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * Webhook de Stripe. Registrar en el dashboard:
 *   URL: https://<dominio>/api/webhooks/stripe
 *   Eventos: checkout.session.completed, checkout.session.async_payment_succeeded
 * El signing secret (whsec_...) va en STRIPE_WEBHOOK_SECRET.
 *
 * checkout.session.async_payment_succeeded cubre OXXO/SPEI, que confirman
 * horas después del checkout.
 */
export async function POST(req: Request) {
  const stripe = stripeClient();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });

  const payload = await req.text();
  const signature = req.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (err) {
    console.error("[stripe webhook] firma inválida:", err);
    return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    const siteId = session.metadata?.siteId;

    if (session.payment_status === "paid" && siteId) {
      const site = await prisma.site.findUnique({ where: { id: siteId }, include: { invoice: true } });
      if (site?.invoice) {
        await prisma.site.update({
          where: { id: siteId },
          data: {
            status: "PAID",
            invoice: { update: { status: "PAID", paidTotal: site.invoice.total } },
          },
        });
        console.log(`[stripe webhook] sitio ${siteId} pagado (${site.invoice.total} MXN)`);
      }
    }
  }

  return NextResponse.json({ received: true });
}
