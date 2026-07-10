import type { Template, Widget } from "@prisma/client";
import type { SiteConfig } from "@/lib/site-config";

export type LineItem = {
  label: string;
  qty: number;
  unitPrice: number;
  subtotal: number;
};

export type InvoiceData = { lineItems: LineItem[]; total: number };

// Secciones incluidas en el precio base del template (no facturan aparte).
export const BASE_SECTIONS = new Set(["hero", "about", "products"]);

/**
 * Calcula la factura a partir del config del sitio. Regla de negocio:
 * - Precio base del template (incluye header, hero, about, productos,
 *   footer, favicon y botón de WhatsApp).
 * - Cada widget agregado factura su precio de catálogo.
 * - Secciones extra sin widget asociado (agregadas manualmente) facturan
 *   con el widget genérico "seccion-extra" si existe en el catálogo.
 */
export function computeInvoice(
  config: SiteConfig,
  template: Pick<Template, "name" | "basePrice">,
  catalog: Pick<Widget, "slug" | "name" | "price" | "sectionType">[]
): InvoiceData {
  const items: LineItem[] = [
    { label: `Sitio base — template “${template.name}”`, qty: 1, unitPrice: template.basePrice, subtotal: template.basePrice },
  ];

  const bySlug = new Map(catalog.map((w) => [w.slug, w]));
  const counts = new Map<string, number>();
  for (const w of config.widgets) {
    // Widgets con cantidad (ej. página adicional: una entrada, N páginas)
    const qty = Array.isArray((w.config as any)?.pages)
      ? Math.max(1, (w.config as any).pages.length)
      : Math.max(1, Number((w.config as any)?.qty) || 1);
    counts.set(w.widgetId, (counts.get(w.widgetId) ?? 0) + qty);
  }

  for (const [slug, qty] of counts) {
    const widget = bySlug.get(slug);
    if (!widget) continue;
    items.push({ label: widget.name, qty, unitPrice: widget.price, subtotal: widget.price * qty });
  }

  // Secciones extra en la página de inicio sin widget asociado (las de páginas
  // adicionales van incluidas en el precio por página).
  const widgetSectionTypes = new Set(
    config.widgets.map((w) => bySlug.get(w.widgetId)?.sectionType).filter(Boolean)
  );
  const extraSections = config.sections.filter(
    (s) => !BASE_SECTIONS.has(s.type) && !widgetSectionTypes.has(s.type)
  );
  const generic = bySlug.get("seccion-extra");
  if (extraSections.length > 0 && generic) {
    items.push({
      label: `${generic.name} (${extraSections.map((s) => s.type).join(", ")})`,
      qty: extraSections.length,
      unitPrice: generic.price,
      subtotal: generic.price * extraSections.length,
    });
  }

  // Si un tipo de widget se usa solo en páginas extra (no en inicio), igual
  // factura el widget una vez (el usuario está usando esa funcionalidad).
  for (const w of catalog) {
    if (!w.sectionType || counts.has(w.slug)) continue;
    const usedOnPages = config.widgets
      .find((x) => x.widgetId === "pagina-adicional")
      ?.config as { pages?: { sections?: { type: string }[] }[] } | undefined;
    const pages = usedOnPages?.pages ?? [];
    const used = pages.some((p) => (p.sections ?? []).some((s) => s.type === w.sectionType));
    if (used) {
      items.push({ label: w.name, qty: 1, unitPrice: w.price, subtotal: w.price });
    }
  }

  return { lineItems: items, total: items.reduce((acc, i) => acc + i.subtotal, 0) };
}
