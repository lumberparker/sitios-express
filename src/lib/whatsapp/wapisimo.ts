// Cliente de wapisimo.dev — https://app.wapisimo.dev/docs
// Base: https://api.wapisimo.dev/v1
// Auth: Bearer WAPISIMO_API_KEY
// Phone id (UUID): WAPISIMO_PHONE_ID
// Envío (docs): POST /v1/{phone_id}/send  { to, message }

const BASE = "https://api.wapisimo.dev/v1";

/** Limpia valores de env (Vercel a veces deja comillas o espacios). */
function env(name: string): string {
  return (process.env[name] ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
}

/** "529993912818@s.whatsapp.net" o "+52 999..." → dígitos con código de país */
export function toDigits(phone: string): string {
  return phone.split("@")[0].replace(/\D/g, "");
}

/** "52...@s.whatsapp.net" → "+52..." */
export function normalizePhone(from: string): string {
  const digits = normalizeMexicoMobile(from);
  return digits ? `+${digits}` : "";
}

/**
 * Normaliza destino: solo dígitos.
 * México: código de país 52 + 10 dígitos locales (ej. 529993912818).
 * No se inserta el "1" extra (521…).
 */
export function normalizeMexicoMobile(digits: string): string {
  const d = toDigits(digits);
  // 10 dígitos locales MX → anteponer 52
  if (d.length === 10) return `52${d}`;
  // Si alguien pasó 521 + 10 dígitos (13), quitar el 1 de más → 52 + 10
  if (d.length === 13 && d.startsWith("521")) return `52${d.slice(3)}`;
  return d;
}

export function isConfigured(): boolean {
  const key = env("WAPISIMO_API_KEY");
  const phoneId = env("WAPISIMO_PHONE_ID");
  if (!key || !phoneId) return false;
  if (key.includes("REEMPLAZA") || key.includes("...")) return false;
  return true;
}

export function wapisimoConfigStatus(): {
  ok: boolean;
  reason?: string;
  phoneId?: string;
  hasApiKey?: boolean;
} {
  const key = env("WAPISIMO_API_KEY");
  const phoneId = env("WAPISIMO_PHONE_ID");
  if (!phoneId) return { ok: false, reason: "Falta WAPISIMO_PHONE_ID en Vercel", hasApiKey: Boolean(key) };
  if (!key) {
    return {
      ok: false,
      reason: "Falta WAPISIMO_API_KEY en Vercel (Environment Variables → Production + redeploy)",
      phoneId,
      hasApiKey: false,
    };
  }
  return { ok: true, phoneId, hasApiKey: true };
}

/**
 * Envía un mensaje de WhatsApp vía Wapisimo.
 * @see https://app.wapisimo.dev/docs
 */
export async function sendWhatsApp(to: string, message: string): Promise<void> {
  let digits = normalizeMexicoMobile(to);
  if (!digits) {
    console.error("[wapisimo] destinatario inválido:", to);
    return;
  }

  const status = wapisimoConfigStatus();
  if (!status.ok) {
    console.warn(`[wapisimo] no configurado: ${status.reason}`);
    console.log(`[wapisimo:dev] → ${digits}:\n${message}`);
    return;
  }

  const phoneId = env("WAPISIMO_PHONE_ID");
  const apiKey = env("WAPISIMO_API_KEY");
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Variantes de endpoint y payload que se ven en la docs / paneles
  const urls = [`${BASE}/${phoneId}/send`, `${BASE}/${phoneId}`];
  const bodies = [
    { to: digits, message },
    { to: `+${digits}`, message },
    { number: digits, message },
    { phone: digits, text: message },
  ];

  let lastStatus = 0;
  let lastBody = "";
  let lastUrl = "";

  for (const url of urls) {
    for (const body of bodies) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        lastStatus = res.status;
        lastBody = await res.text().catch(() => "");
        lastUrl = url;
        if (res.ok) {
          console.log(`[wapisimo] OK → ${digits} via ${url}`);
          return;
        }
        // 401/403: API key incorrecta — no seguir probando
        if (res.status === 401 || res.status === 403) {
          console.error(`[wapisimo] auth fallida (${res.status}) en ${url}:`, lastBody);
          throw new Error(`Wapisimo auth ${res.status}: revisa WAPISIMO_API_KEY`);
        }
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("Wapisimo auth")) throw err;
        console.error("[wapisimo] error de red:", err);
      }
    }
  }

  console.error(`[wapisimo] fallo al enviar (${lastStatus}) ${lastUrl}:`, lastBody);
  throw new Error(`Wapisimo ${lastStatus}: ${lastBody.slice(0, 300)}`);
}

/**
 * Registra la URL del webhook entrante en Wapisimo (opcional, setup).
 */
export async function registerWebhook(publicUrl: string): Promise<boolean> {
  if (!isConfigured()) {
    console.log("[wapisimo:dev] registerWebhook omitido:", publicUrl);
    return false;
  }
  const phoneId = env("WAPISIMO_PHONE_ID");
  const apiKey = env("WAPISIMO_API_KEY");
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
