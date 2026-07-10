import { prisma } from "@/lib/prisma";
import { sendWhatsApp, wapisimoConfigStatus } from "@/lib/whatsapp/wapisimo";

function appUrl() {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/**
 * Número que recibe los avisos de pedidos.
 * Prioridad: ORDER_NOTIFY_WHATSAPP → SUPPORT_WHATSAPP → 529993912818
 */
function envVal(name: string): string {
  return (process.env[name] ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

export function orderNotifyDigits(): string {
  const raw =
    envVal("ORDER_NOTIFY_WHATSAPP") ||
    envVal("SUPPORT_WHATSAPP") ||
    envVal("NEXT_PUBLIC_SUPPORT_WHATSAPP") ||
    "529993912818";
  return raw.replace(/\D/g, "");
}

type LineItem = {
  label?: string;
  qty?: number;
  unitPrice?: number;
  subtotal?: number;
};

/**
 * Envía por WhatsApp (Wapisimo) el resumen del pedido cuando un sitio se paga.
 * Destino por defecto: +52 999 391 2818
 */
export async function notifyOrderPaid(siteId: string): Promise<void> {
  try {
    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: { invoice: true, template: { select: { name: true } } },
    });
    if (!site?.invoice) return;

    const to = orderNotifyDigits();
    if (!to) {
      console.warn("[notify-order] sin número de destino (ORDER_NOTIFY_WHATSAPP)");
      return;
    }

    const wapi = wapisimoConfigStatus();
    if (!wapi.ok) {
      console.warn(`[notify-order] Wapisimo no listo: ${wapi.reason} — no se envía a ${to}`);
      return;
    }
    console.log(`[notify-order] enviando resumen a ${to} (phoneId=${wapi.phoneId})`);

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

    const contact =
      config.business?.email ||
      config.whatsapp?.number ||
      config.business?.phone ||
      "—";

    const lines = [
      "🧾 *Nuevo pedido pagado*",
      "",
      `*Sitio:* ${name}`,
      `*Template:* ${site.template?.name ?? "—"}`,
      `*Contacto:* ${contact}`,
      `*Total:* $${site.invoice.total} MXN`,
      `*Pagado:* $${site.invoice.paidTotal} MXN`,
      "",
      "*Detalle:*",
      itemsBlock,
      "",
      `Editor: ${editorUrl}`,
      `Vista previa: ${previewUrl}`,
    ];

    if (montaje) {
      const cfg = (montaje.config ?? {}) as { desiredDomain?: string; subdomain?: string };
      lines.push("");
      if (montaje.widgetId === "montaje-con-dominio") {
        const domain = String(cfg.desiredDomain ?? "").trim();
        lines.push("🔧 *Montaje con dominio*");
        lines.push(domain ? `Dominio: ${domain}` : "Dominio: (no indicado)");
      } else {
        const sub = String(cfg.subdomain ?? "").trim();
        lines.push("🔧 *Montaje en línea (Netlify)*");
        lines.push(sub ? `Sitio: ${sub}.netlify.app` : "Subdominio: (no indicado)");
      }
    }

    await sendWhatsApp(to, lines.join("\n"));
    console.log(`[notify-order] resumen enviado a ${to} (sitio ${siteId})`);
  } catch (err) {
    console.error("[notify-order] error:", err);
  }
}

/** @deprecated usar notifyOrderPaid */
export async function notifyMontajePaid(siteId: string): Promise<void> {
  return notifyOrderPaid(siteId);
}
