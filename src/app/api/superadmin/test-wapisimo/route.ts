import { NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/superadmin";
import { sendWhatsApp, wapisimoConfigStatus, isConfigured } from "@/lib/whatsapp/wapisimo";
import { orderNotifyDigits } from "@/lib/whatsapp/notify-order";

export const runtime = "nodejs";

/**
 * GET  — diagnostica si Wapisimo está configurado en este deploy (sin revelar la key).
 * POST — envía un mensaje de prueba al número ORDER_NOTIFY_WHATSAPP.
 * Solo super admin.
 */
export async function GET() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const status = wapisimoConfigStatus();
  const to = orderNotifyDigits();
  return NextResponse.json({
    configured: isConfigured(),
    ...status,
    notifyTo: to ? `${to.slice(0, 4)}…${to.slice(-4)}` : null,
    note: "Si hasApiKey=false, agrega WAPISIMO_API_KEY en Vercel → Production y haz Redeploy.",
  });
}

export async function POST() {
  const auth = await requireSuperAdmin();
  if ("error" in auth) return auth.error;

  const status = wapisimoConfigStatus();
  if (!status.ok) {
    return NextResponse.json({ ok: false, error: status.reason }, { status: 503 });
  }

  const to = orderNotifyDigits();
  if (!to) {
    return NextResponse.json({ ok: false, error: "Falta ORDER_NOTIFY_WHATSAPP" }, { status: 400 });
  }

  try {
    await sendWhatsApp(
      to,
      "🧪 Prueba Sitios Web Express (Vercel)\n\nSi ves esto, Wapisimo está bien configurado en producción."
    );
    return NextResponse.json({
      ok: true,
      sentTo: `${to.slice(0, 4)}…${to.slice(-4)}`,
      message: "Mensaje enviado. Revisa WhatsApp.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[test-wapisimo]", msg);
    return NextResponse.json({ ok: false, error: msg }, { status: 502 });
  }
}
