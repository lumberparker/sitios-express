// Cliente de wapisimo.dev (https://api.wapisimo.dev/v1)
// Auth: Bearer WAPISIMO_API_KEY · Envío: POST /v1/{phone_id}/send { to, message }
// Webhook entrante: { from: "521...@s.whatsapp.net", message, timestamp, fromMe }
// Límite: 10 mensajes/min — suficiente para el bot de onboarding.

const BASE = "https://api.wapisimo.dev/v1";

/** "5215512345678@s.whatsapp.net" → "+5215512345678" */
export function normalizePhone(from: string): string {
  const digits = from.split("@")[0].replace(/\D/g, "");
  return `+${digits}`;
}

export function isConfigured(): boolean {
  return Boolean(process.env.WAPISIMO_API_KEY && process.env.WAPISIMO_PHONE_ID);
}

/**
 * Envía un mensaje de WhatsApp. Sin credenciales configuradas (dev) hace
 * log y no falla, para poder probar el bot con curl contra el webhook.
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  if (!isConfigured()) {
    console.log(`[wapisimo:dev] → ${to}: ${message}`);
    return;
  }
  const res = await fetch(`${BASE}/${process.env.WAPISIMO_PHONE_ID}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WAPISIMO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to, message }),
  });
  if (!res.ok) {
    console.error(`[wapisimo] fallo al enviar (${res.status}):`, await res.text().catch(() => ""));
  }
}
