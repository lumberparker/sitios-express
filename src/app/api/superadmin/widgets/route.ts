import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin";

const WidgetSchema = z.object({
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2),
  description: z.string().default(""),
  sectionType: z.string().nullable().optional(),
  icon: z.string().default("puzzle"),
  price: z.number().int().min(0),
  active: z.boolean().default(true),
});

export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  return NextResponse.json(await prisma.widget.findMany({ orderBy: { createdAt: "asc" } }));
}

export async function POST(req: Request) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;
  const parsed = WidgetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  const widget = await prisma.widget.create({ data: { ...parsed.data, sectionType: parsed.data.sectionType ?? null } });
  return NextResponse.json(widget, { status: 201 });
}
