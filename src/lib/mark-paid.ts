import { prisma } from "@/lib/prisma";
import { notifyOrderPaid } from "@/lib/whatsapp/notify-order";

/**
 * Marca un sitio como pagado (status PAID + invoice PAID).
 * Idempotente: si ya estaba PAID, no vuelve a notificar.
 */
export async function markSitePaid(siteId: string, paidAmountMxn?: number): Promise<boolean> {
  const site = await prisma.site.findUnique({
    where: { id: siteId },
    include: { invoice: true },
  });
  if (!site?.invoice) {
    console.error(`[markSitePaid] sitio ${siteId} sin factura`);
    return false;
  }

  const alreadyPaid = site.status === "PAID" && site.invoice.status === "PAID";

  const paidTotal = Math.max(
    paidAmountMxn ?? site.invoice.total,
    site.invoice.paidTotal,
    site.invoice.total
  );

  await prisma.site.update({
    where: { id: siteId },
    data: {
      status: "PAID",
      invoice: {
        update: {
          status: "PAID",
          paidTotal,
        },
      },
    },
  });

  console.log(`[markSitePaid] sitio ${siteId} → PAID (paidTotal=${paidTotal})`);

  // Resumen del pedido por WhatsApp (solo la primera vez que queda pagado).
  // IMPORTANTE: await — en Vercel un fire-and-forget se corta al terminar el request.
  if (!alreadyPaid) {
    try {
      await notifyOrderPaid(siteId);
    } catch (err) {
      console.error("[markSitePaid] fallo al notificar WhatsApp (el pago SÍ quedó registrado):", err);
    }
  }

  return true;
}
