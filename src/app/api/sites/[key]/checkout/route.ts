import { NextResponse } from "next/server";
import { getSiteByKey } from "@/lib/sites";
import { createCheckoutSession } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import { SiteConfigSchema } from "@/lib/site-config";
import { computeInvoice } from "@/lib/pricing";

export const runtime = "nodejs";

/** Crea la sesión de pago de Stripe por el monto pendiente del sitio. */
export async function POST(_req: Request, { params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Recalcular factura desde el config guardado (por si el cliente guardó justo antes)
  const catalog = await prisma.widget.findMany({ where: { active: true } });
  let config;
  try {
    config = SiteConfigSchema.parse(site.config);
  } catch {
    return NextResponse.json({ error: "Config del sitio inválido." }, { status: 400 });
  }
  const invoiceData = computeInvoice(config, site.template, catalog);
  const paidTotal = site.invoice?.paidTotal ?? 0;
  const pending = Math.max(0, invoiceData.total - paidTotal);

  if (pending <= 0) {
    return NextResponse.json({ error: "No hay nada por pagar." }, { status: 400 });
  }

  // Stripe MXN: mínimo práctico ~$10
  if (pending < 10) {
    return NextResponse.json(
      { error: "El monto mínimo de pago en línea es $10 MXN." },
      { status: 400 }
    );
  }

  // Persistir totales al día antes de cobrar
  await prisma.invoice.upsert({
    where: { siteId: site.id },
    create: {
      siteId: site.id,
      lineItems: invoiceData.lineItems,
      total: invoiceData.total,
      paidTotal,
      status: "ISSUED",
    },
    update: {
      lineItems: invoiceData.lineItems,
      total: invoiceData.total,
      status: "ISSUED",
    },
  });

  const description =
    paidTotal > 0
      ? `Saldo pendiente — sitio "${site.name}" (Sitios Web Express)`
      : `Sitio web "${site.name}" — Sitios Web Express`;

  const url = await createCheckoutSession({
    siteId: site.id,
    editKey: site.editKey,
    description,
    amountMxn: pending,
  });

  if (!url) {
    return NextResponse.json(
      {
        error:
          "Stripe no está configurado. En el servidor (archivo .env o variables de Vercel) define STRIPE_SECRET_KEY=sk_test_… (Dashboard Stripe → API keys). Luego reinicia el servidor.",
      },
      { status: 503 }
    );
  }

  if (site.status === "DRAFT") {
    await prisma.site.update({ where: { id: site.id }, data: { status: "COMPLETED" } });
  }

  return NextResponse.json({ url, amount: pending });
}
