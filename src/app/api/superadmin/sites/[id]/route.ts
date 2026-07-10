import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin";
import { markSitePaid } from "@/lib/mark-paid";

const PatchSchema = z.object({
  status: z.enum(["DRAFT", "COMPLETED", "PAID"]),
});

/** Cambio de estado manual (ej. marcar PAGADO al recibir el pago fuera de línea). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const current = await prisma.site.findUnique({ where: { id: params.id }, include: { invoice: true } });
  if (!current) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // Marcar pagado: misma ruta que Stripe (notifica montaje por WhatsApp si aplica)
  if (parsed.data.status === "PAID") {
    await markSitePaid(params.id, current.invoice?.total);
    return NextResponse.json({ status: "PAID" });
  }

  const site = await prisma.site.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status,
      invoice: {
        update: {
          status: parsed.data.status === "COMPLETED" ? "ISSUED" : "DRAFT",
          paidTotal: 0,
        },
      },
    },
  });
  return NextResponse.json({ status: site.status });
}
