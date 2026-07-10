import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/superadmin";
import { normalizeMexicoMobile, sendWhatsApp, wapisimoConfigStatus } from "@/lib/whatsapp/wapisimo";

export const runtime = "nodejs";

const BodySchema = z.object({
  url: z.string().min(4),
});

/**
 * Avisa al cliente por WhatsApp: "Tu sitio está listo en: [URL]"
 * Destino: WhatsApp guardado en el config del sitio (pedido).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  let siteUrl = parsed.data.url.trim();
  if (!/^https?:\/\//i.test(siteUrl)) {
    siteUrl = `https://${siteUrl}`;
  }
  try {
    // Valida que sea una URL razonable
    new URL(siteUrl);
  } catch {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  const site = await prisma.site.findUnique({ where: { id: params.id } });
  if (!site) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  const config = site.config as {
    business?: { name?: string; phone?: string };
    whatsapp?: { number?: string };
  };
  const clientWa = normalizeMexicoMobile(config.whatsapp?.number || config.business?.phone || "");
  if (!clientWa || clientWa.length < 12) {
    return NextResponse.json(
      {
        error:
          "Este sitio no tiene WhatsApp del cliente. Debe haberlo capturado al pagar, o agrégalo en el builder (Negocio).",
      },
      { status: 400 }
    );
  }

  const wapi = wapisimoConfigStatus();
  if (!wapi.ok) {
    return NextResponse.json({ error: wapi.reason ?? "Wapisimo no configurado" }, { status: 503 });
  }

  const name = config.business?.name || site.name;
  const message = [
    `✅ *¡Tu sitio está listo!*`,
    "",
    `Hola, tu sitio *${name}* ya está publicado.`,
    "",
    `Tu sitio está listo en:`,
    siteUrl,
    "",
    "¡Gracias por confiar en Sitios Web Express!",
  ].join("\n");

  try {
    await sendWhatsApp(clientWa, message);
    return NextResponse.json({
      ok: true,
      sentTo: `${clientWa.slice(0, 4)}…${clientWa.slice(-4)}`,
      url: siteUrl,
      message: `Mensaje enviado al cliente (${clientWa.slice(0, 4)}…${clientWa.slice(-4)}).`,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[notify-ready]", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
