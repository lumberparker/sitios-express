import { NextResponse } from "next/server";
import { z } from "zod";
import { createOnboardedSite } from "@/lib/sites";

const CreateSiteSchema = z.object({
  templateId: z.string(),
  businessName: z.string().min(1),
  tagline: z.string().optional(),
  logoUrl: z.string().optional(),
  faviconUrl: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  whatsappNumber: z.string().optional(),
  whatsappMessage: z.string().optional(),
});

// Público: crear un sitio no requiere cuenta. La editKey devuelta es la
// llave de acceso del dueño (se muestra una sola vez tras el onboarding).
export async function POST(req: Request) {
  const parsed = CreateSiteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });

  try {
    const site = await createOnboardedSite(parsed.data);
    return NextResponse.json({ editKey: site.editKey }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Template no disponible" }, { status: 400 });
  }
}
