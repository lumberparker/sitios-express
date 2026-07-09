import { NextResponse } from "next/server";
import { z } from "zod";
import { handleIncomingMessage } from "@/lib/whatsapp/onboarding-bot";
import { normalizePhone, sendWhatsApp, isConfigured } from "@/lib/whatsapp/wapisimo";

export const runtime = "nodejs";

// Payload de wapisimo.dev para mensajes entrantes
const EventSchema = z.object({
  from: z.string(),
  message: z.string(),
  timestamp: z.number().optional(),
  fromMe: z.boolean().optional(),
});

/**
 * Webhook de wapisimo. Registrar con:
 *   POST https://api.wapisimo.dev/v1/{phone_id}/webhook
 *   { "url": "https://<tu-dominio>/api/webhooks/wapisimo?secret=<WAPISIMO_WEBHOOK_SECRET>" }
 *
 * wapisimo no firma los eventos, así que la URL lleva un secreto compartido.
 */
export async function POST(req: Request) {
  const secret = process.env.WAPISIMO_WEBHOOK_SECRET;
  if (secret && new URL(req.url).searchParams.get("secret") !== secret) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const parsed = EventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Payload inválido" }, { status: 400 });

  const event = parsed.data;
  // Ignorar ecos de mensajes propios y mensajes vacíos
  if (event.fromMe || !event.message.trim()) return NextResponse.json({ ok: true, ignored: true });

  const phone = normalizePhone(event.from);

  let reply: string;
  try {
    reply = await handleIncomingMessage(phone, event.message);
  } catch (err) {
    console.error("[wapisimo webhook] error del bot:", err);
    reply = "Ups, algo salió mal de nuestro lado 😅 Escribe *reiniciar* para intentarlo de nuevo.";
  }

  await sendWhatsApp(phone, reply);

  // En dev (sin API key) se devuelve la respuesta para poder probar con curl
  return NextResponse.json(isConfigured() ? { ok: true } : { ok: true, dev: true, reply });
}
