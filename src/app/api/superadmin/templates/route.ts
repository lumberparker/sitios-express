import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin";
import { TemplateConfigSchema } from "@/lib/site-config";

const TemplateSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().default(""),
  basePrice: z.number().int().min(0),
  config: TemplateConfigSchema,
  active: z.boolean().default(true),
});

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  return NextResponse.json(await prisma.template.findMany({ orderBy: { createdAt: "asc" } }));
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const parsed = TemplateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos", issues: parsed.error.issues }, { status: 400 });
  const template = await prisma.template.create({ data: parsed.data });
  return NextResponse.json(template, { status: 201 });
}
