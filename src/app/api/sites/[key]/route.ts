import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSiteByKey } from "@/lib/sites";
import { SiteConfigSchema } from "@/lib/site-config";
import { computeInvoice } from "@/lib/pricing";

// La editKey en la URL es la autorización: es una clave aleatoria de 192
// bits que solo conoce el dueño del sitio.

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  return NextResponse.json(site);
}

export async function PATCH(req: Request, { params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const body = await req.json().catch(() => null);

  // Placeholder de pago: registra el pedido (DRAFT → COMPLETED)
  if (body?.action === "complete") {
    const updated = await prisma.site.update({
      where: { id: site.id },
      data: { status: "COMPLETED", invoice: { update: { status: "ISSUED" } } },
    });
    return NextResponse.json({ status: updated.status });
  }

  const parsed = SiteConfigSchema.safeParse(body?.config);
  if (!parsed.success) {
    return NextResponse.json({ error: "Config inválido", issues: parsed.error.issues }, { status: 400 });
  }

  const catalog = await prisma.widget.findMany({ where: { active: true } });
  const invoice = computeInvoice(parsed.data, site.template, catalog);

  // Si el sitio ya estaba pagado y el nuevo total supera lo cobrado
  // (agregó módulos), el pedido vuelve a pendiente: se bloquea la descarga
  // hasta pagar el saldo. Si el total no sube, sigue pagado.
  const paidTotal = site.invoice?.paidTotal ?? 0;
  const outgrewPayment = site.status === "PAID" && invoice.total > paidTotal;

  const updated = await prisma.site.update({
    where: { id: site.id },
    data: {
      name: parsed.data.business.name,
      config: parsed.data,
      ...(outgrewPayment ? { status: "COMPLETED" } : {}),
      versions: { create: { config: parsed.data } },
      invoice: {
        upsert: {
          create: { lineItems: invoice.lineItems, total: invoice.total },
          update: {
            lineItems: invoice.lineItems,
            total: invoice.total,
            ...(outgrewPayment ? { status: "ISSUED" } : {}),
          },
        },
      },
    },
    include: { invoice: true },
  });

  return NextResponse.json({ ok: true, status: updated.status, invoice: updated.invoice });
}

export async function DELETE(_req: Request, { params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  await prisma.site.delete({ where: { id: site.id } });
  return NextResponse.json({ ok: true });
}
