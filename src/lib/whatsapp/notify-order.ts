import { prisma } from "@/lib/prisma";
import { normalizeMexicoMobile, sendWhatsApp, wapisimoConfigStatus } from "@/lib/whatsapp/wapisimo";

function appUrl() {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function envVal(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

/** Número del equipo que recibe avisos de pedidos. */
export function orderNotifyDigits(): string {
  const raw =
    envVal("ORDER_NOTIFY_WHATSAPP") ||
    envVal("SUPPORT_WHATSAPP") ||
    envVal("NEXT_PUBLIC_SUPPORT_WHATSAPP") ||
    "529993912818";
  return normalizeMexicoMobile(raw);
}

type LineItem = {
  label?: string;
  qty?: number;
  unitPrice?: number;
  subtotal?: number;
};

function formatDisplayPhone(digits: string): string {
  const d = normalizeMexicoMobile(digits);
  if (d.length === 12 && d.startsWith("52")) {
    return `+52 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  }
  return d ? `+${d}` : "—";
}

/**
 * Envía por WhatsApp:
 * 1) Resumen al equipo (con WhatsApp del cliente para contactarlo)
 * 2) Confirmación al cliente (si dejó su número)
 */
export async function notifyOrderPaid(siteId: string): Promise<void> {
  try {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { invoice: true, template: { select: { name: true } } },
    });
    if (!site?.invoice) return;

    const wapi = wapisimoConfigStatus();
    if (!wapi.ok) {
      console.warn(`[notify-order] Wapisimo no listo: ${wapi.reason}`);
      return;
    }

    const config = site.config as {
      business?: { name?: string; email?: string; phone?: string };
      whatsapp?: { number?: string };
      widgets?: { widgetId?: string; config?: Record<string, unknown> }[];
    };

    const name = config.business?.name || site.name;
    const editorUrl = `${appUrl()}/builder/${site.editKey}`;
    const previewUrl = `${appUrl()}/preview/${site.editKey}`;
    const widgets = Array.isArray(config?.widgets) ? config.widgets : [];
    const montaje = widgets.find(
      (w) => w.widgetId === "montaje-con-dominio" || w.widgetId === "montaje-sin-dominio"
    );

    const clientWa = normalizeMexicoMobile(
      config.whatsapp?.number || config.business?.phone || ""
    );
    const clientWaDisplay = clientWa ? formatDisplayPhone(clientWa) : "— (no indicado)";

    const lineItems = (Array.isArray(site.invoice.lineItems) ? site.invoice.lineItems : []) as LineItem[];
    const itemsBlock =
      lineItems.length > 0
        ? lineItems
            .map((item) => {
              const qty = item.qty && item.qty > 1 ? ` ×${item.qty}` : "";
              const sub = typeof item.subtotal === "number" ? `$${item.subtotal}` : "";
              return `• ${item.label ?? "Ítem"}${qty}  ${sub}`;
            })
            .join("\n")
        : "• (sin desglose)";

    const email = config.business?.email?.trim() || "—";

    // —— Mensaje al equipo ——
    const adminLines = [
      "🧾 *Nuevo pedido pagado*",
      "",
      `*Sitio:* ${name}`,
      `*Template:* ${site.template?.name ?? "—"}`,
      `*WhatsApp del cliente:* ${clientWaDisplay}`,
      clientWa ? `https://wa.me/${clientWa}` : "",
      `*Email:* ${email}`,
      `*Total:* $${site.invoice.total} MXN`,
      `*Pagado:* $${site.invoice.paidTotal} MXN`,
      "",
      "*Detalle:*",
      itemsBlock,
      "",
      `Editor: ${editorUrl}`,
      `Vista previa: ${previewUrl}`,
    ].filter(Boolean);

    if (montaje) {
      const cfg = (montaje.config ?? {}) as { desiredDomain?: string; subdomain?: string };
      adminLines.push("");
      if (montaje.widgetId === "montaje-con-dominio") {
        const domain = String(cfg.desiredDomain ?? "").trim();
        adminLines.push("🔧 *Montaje con dominio*");
        adminLines.push(domain ? `Dominio: ${domain}` : "Dominio: (no indicado)");
      } else {
        const sub = String(cfg.subdomain ?? "").trim();
        adminLines.push("🔧 *Montaje en línea (Netlify)*");
        adminLines.push(sub ? `Sitio: ${sub}.netlify.app` : "Subdominio: (no indicado)");
      }
    }

    const teamTo = orderNotifyDigits();
    if (teamTo) {
      console.log(`[notify-order] enviando al equipo ${teamTo}`);
      await sendWhatsApp(teamTo, adminLines.join("\n"));
      console.log(`[notify-order] OK equipo ${teamTo}`);
    }

    // —— Confirmación al cliente (1 s de espera: cola de Wapisimo ~1 msg/s) ——
    if (clientWa && clientWa !== teamTo) {
      await new Promise((r) => setTimeout(r, 1100));
      const clientLines = [
        `✅ *¡Pago confirmado!*`,
        "",
        `Hola, recibimos el pago de tu sitio *${name}*.`,
        "",
        `*Total pagado:* $${site.invoice.paidTotal || site.invoice.total} MXN`,
        "",
        "*Tu pedido:*",
        itemsBlock,
        "",
        `Puedes seguir editando y descargar tu sitio aquí:`,
        editorUrl,
        "",
        `Vista previa: ${previewUrl}`,
        "",
        "Si pediste *montaje*, el equipo se pondrá en contacto contigo pronto.",
        "¡Gracias por confiar en Sitios Web Express!",
      ];
      console.log(`[notify-order] enviando confirmación al cliente ${clientWa}`);
      await sendWhatsApp(clientWa, clientLines.join("\n"));
      console.log(`[notify-order] OK cliente ${clientWa}`);
    } else if (!clientWa) {
      console.warn("[notify-order] cliente sin WhatsApp guardado — solo se avisó al equipo");
    }
  } catch (err) {
    console.error("[notify-order] error:", err);
  }
}

/** @deprecated usar notifyOrderPaid */
export async function notifyMontajePaid(siteId: string): Promise<void> {
  return notifyOrderPaid(siteId);
}
