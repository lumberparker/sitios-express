import { NextResponse } from "next/server";
import { getSiteByKey } from "@/lib/sites";
import { createCheckoutSession } from "@/lib/payments";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/** Crea la sesión de pago de Stripe por el monto pendiente del sitio. */
export async function POST(_req: Request, { params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site || !site.invoice) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const pending = site.invoice.total - site.invoice.paidTotal;
  if (pending <= 0) return NextResponse.json({ error: "No hay nada por pagar." }, { status: 400 });

  const description =
    site.invoice.paidTotal > 0
      ? `Saldo pendiente — sitio "${site.name}" (Sitios Web Express)`
      : `Sitio web "${site.name}" — Sitios Web Express`;

  const url = await createCheckoutSession({
    siteId: site.id,
    editKey: site.editKey,
    description,
    amountMxn: pending,
  });

  if (!url) {
    // Stripe no configurado: el builder cae al flujo placeholder
    return NextResponse.json({ error: "Pagos en línea no disponibles todavía." }, { status: 503 });
  }

  // El pedido queda registrado desde que intenta pagar
  await prisma.invoice.update({ where: { siteId: site.id }, data: { status: "ISSUED" } });
  if (site.status === "DRAFT") {
    await prisma.site.update({ where: { id: site.id }, data: { status: "COMPLETED" } });
  }

  return NextResponse.json({ url });
}
