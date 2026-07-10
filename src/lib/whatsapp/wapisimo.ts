// Cliente de wapisimo.dev — https://app.wapisimo.dev/docs
// Base: https://api.wapisimo.dev/v1
// Auth: Bearer WAPISIMO_API_KEY
// Phone id (UUID de la instancia), ej:
//   https://api.wapisimo.dev/v1/0cea982a-4cd8-4fc6-bf1b-b5d7d9bddf90
// Envío (docs): POST /v1/{phone_id}/send  { to, message }
// Webhook: POST /v1/{phone_id}/webhook  { url }
// Cola: ~1 mensaje/segundo en su lado

const BASE = "https://api.wapisimo.dev/v1";

/** "5215512345678@s.whatsapp.net" o "+52 999..." → dígitos con código de país */
export function toDigits(phone: string): string {
  return phone.split("@")[0].replace(/\D/g, "");
}

/** "521...@s.whatsapp.net" → "+521..." */
export function normalizePhone(from: string): string {
  const digits = toDigits(from);
  return digits ? `+${digits}` : "";
}

export function isConfigured(): boolean {
  return Boolean(
    process.env.WAPISIMO_API_KEY?.trim() && process.env.WAPISIMO_PHONE_ID?.trim()
  );
}

/**
 * Envía un mensaje de WhatsApp vía Wapisimo.
 * `to`: número con código de país (con o sin + / espacios).
 * Sin credenciales (dev) solo hace log y no falla.
 *
 * Endpoint: POST https://api.wapisimo.dev/v1/{phone_id}/send
 * @see https://app.wapisimo.dev/docs
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  const digits = toDigits(to);
  if (!digits) {
    console.error("[wapisimo] destinatario inválido:", to);
    return;
  }

  if (!isConfigured()) {
    console.log(`[wapisimo:dev] → ${digits}:\n${message}`);
    return;
  }

  const phoneId = process.env.WAPISIMO_PHONE_ID!.trim();
  const apiKey = process.env.WAPISIMO_API_KEY!.trim();
  const payload = JSON.stringify({ to: digits, message });
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  // Docs: .../v1/{id}/send — algunos paneles muestran solo .../v1/{id}
  const urls = [`${BASE}/${phoneId}/send`, `${BASE}/${phoneId}`];
  let lastStatus = 0;
  let lastBody = "";

  for (const url of urls) {
    const res = await fetch(url, { method: "POST", headers, body: payload });
    if (res.ok) return;
    lastStatus = res.status;
    lastBody = await res.text().catch(() => "");
    // Si no es 404, no tiene sentido probar la otra ruta
    if (res.status !== 404) break;
  }

  console.error(`[wapisimo] fallo al enviar (${lastStatus}):`, lastBody);
  throw new Error(`Wapisimo ${lastStatus}: ${lastBody.slice(0, 200)}`);
}

/**
 * Registra la URL del webhook entrante en Wapisimo (opcional, setup).
 * POST https://api.wapisimo.dev/v1/{phone_id}/webhook  { url }
 */
export async function registerWebhook(publicUrl: string): Promise<boolean> {
  if (!isConfigured()) {
    console.log("[wapisimo:dev] registerWebhook omitido:", publicUrl);
    return false;
  }
  const phoneId = process.env.WAPISIMO_PHONE_ID!.trim();
  const apiKey = process.env.WAPISIMO_API_KEY!.trim();
  const res = await fetch(`${BASE}/${phoneId}/webhook`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: publicUrl }),
  });
  if (!res.ok) {
    console.error(`[wapisimo] webhook register (${res.status}):`, await res.text().catch(() => ""));
    return false;
  }
  return true;
}
