import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin";
import { TemplateConfigSchema } from "@/lib/site-config";

const PatchSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  basePrice: z.number().int().min(0).optional(),
  config: TemplateConfigSchema.optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const template = await prisma.template.update({ where: { id: params.id }, data: parsed.data });
  return NextResponse.json(template);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const inUse = await prisma.site.count({ where: { templateId: params.id } });
  if (inUse > 0) {
    return NextResponse.json({ error: `Hay ${inUse} sitio(s) usando este template. Desactívalo en su lugar.` }, { status: 409 });
  }
  await prisma.template.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
