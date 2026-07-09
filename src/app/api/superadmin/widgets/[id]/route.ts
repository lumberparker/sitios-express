import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin";

const PatchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  sectionType: z.string().nullable().optional(),
  icon: z.string().optional(),
  price: z.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const widget = await prisma.widget.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(widget);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  await prisma.widget.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
