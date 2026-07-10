import { prisma } from "@/lib/prisma";

/**
 * Marca un sitio como pagado (status PAID + invoice PAID).
 * Idempotente: si ya está PAID, solo asegura paidTotal.
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
  return true;
}
