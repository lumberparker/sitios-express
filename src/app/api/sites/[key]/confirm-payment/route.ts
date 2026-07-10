import { NextResponse } from "next/server";
import { getSiteByKey } from "@/lib/sites";
import { stripeClient } from "@/lib/payments";
import { markSitePaid } from "@/lib/mark-paid";

export const runtime = "nodejs";

/**
 * Confirmación de pago al volver de Stripe (?pago=exitoso&session_id=cs_...).
 * Complementa el webhook: si el webhook falló o tarda, el cliente igual
 * deja el sitio en PAID verificando la sesión con la API de Stripe.
 */
export async function POST(req: Request, { params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Ya pagado
  if (site.status === "PAID") {
    return NextResponse.json({
      status: "PAID",
      paidTotal: site.invoice?.paidTotal ?? site.invoice?.total ?? 0,
    });
  }

  const body = await req.json().catch(() => ({}));
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
  if (!sessionId.startsWith("cs_")) {
    return NextResponse.json({ error: "sessionId inválido" }, { status: 400 });
  }

  const stripe = stripeClient();
  if (!stripe) {
    return NextResponse.json({ error: "Stripe no configurado" }, { status: 503 });
  }

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (err) {
    console.error("[confirm-payment] no se pudo recuperar la sesión:", err);
    return NextResponse.json({ error: "Sesión de pago no encontrada" }, { status: 404 });
  }

  // La sesión debe pertenecer a este sitio
  if (session.metadata?.siteId && session.metadata.siteId !== site.id) {
    return NextResponse.json({ error: "La sesión no corresponde a este sitio" }, { status: 403 });
  }

  if (session.payment_status !== "paid") {
    return NextResponse.json(
      {
        status: site.status,
        paymentStatus: session.payment_status,
        message: "El pago aún no está confirmado en Stripe.",
      },
      { status: 202 }
    );
  }

  // Monto cobrado (centavos → MXN) o total de la factura
  const amountFromStripe =
    typeof session.amount_total === "number" ? Math.round(session.amount_total / 100) : undefined;

  await markSitePaid(site.id, amountFromStripe);

  const updated = await getSiteByKey(params.key);
  return NextResponse.json({
    status: "PAID",
    paidTotal: updated?.invoice?.paidTotal ?? amountFromStripe ?? 0,
  });
}
