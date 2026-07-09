import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin";

const PatchSchema = z.object({
  status: z.enum(["DRAFT", "COMPLETED", "PAID"]),
});

/** Cambio de estado manual (ej. marcar PAGADO al recibir el pago fuera de línea). */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  const site = await prisma.site.update({
    where: { id: params.id },
    data: {
      status: parsed.data.status,
      invoice: {
        update: {
          status: parsed.data.status === "PAID" ? "PAID" : parsed.data.status === "COMPLETED" ? "ISSUED" : "DRAFT",
        },
      },
    },
  });
  return NextResponse.json({ status: site.status });
}
