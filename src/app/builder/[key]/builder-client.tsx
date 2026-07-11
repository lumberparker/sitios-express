"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Textarea, Badge } from "@/components/ui";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { computeInvoice, BASE_SECTIONS, type LineItem } from "@/lib/pricing";
import { formatMoney } from "@/lib/utils";
import {
  cardRadiusPx,
  makeSection,
  overlayFromPercent,
  overlayOpacityPercent,
  SECTION_LABELS,
  type Section,
  type SectionType,
  type SiteConfig,
  type TemplateConfig,
} from "@/lib/site-config";

type CatalogWidget = {
  slug: string;
  name: string;
  description: string;
  price: number;
  sectionType: string | null;
  icon: string;
};

export function BuilderClient({
  siteKey,
  siteStatus,
  paidTotal: initialPaidTotal,
  initialConfig,
  templateConfig,
  template,
  catalog,
}: {
  siteKey: string;
  siteStatus: string;
  paidTotal: number;
  initialConfig: SiteConfig;
  templateConfig: TemplateConfig;
  template: { name: string; basePrice: number };
  catalog: CatalogWidget[];
}) {
  const [config, setConfig] = useState<SiteConfig>(() => {
    // Si un sitio viejo tenía ambos montajes, dejar solo el de dominio propio
    const c = structuredClone(initialConfig);
    const hasCon = c.widgets.some((w) => w.widgetId === "montaje-con-dominio");
    const hasSin = c.widgets.some((w) => w.widgetId === "montaje-sin-dominio");
    if (hasCon && hasSin) {
      c.widgets = c.widgets.filter((w) => w.widgetId !== "montaje-sin-dominio");
    }
    return c;
  });
  const [status, setStatus] = useState(siteStatus);
  const [paidTotal, setPaidTotal] = useState(initialPaidTotal);
  const [tab, setTab] = useState<"secciones" | "widgets" | "negocio">("secciones");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const [paymentBanner, setPaymentBanner] = useState<"" | "processing" | "paid" | "cancelled">("");

  // Al volver de Stripe (?pago=exitoso&session_id=cs_...):
  // 1) Confirmamos la sesión con Stripe (no depende solo del webhook)
  // 2) Polling del estado del sitio por si el webhook llega un poco después
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("pago");
    const sessionId = params.get("session_id") ?? "";
    if (!result) return;
    window.history.replaceState(null, "", window.location.pathname);

    if (result === "cancelado") {
      setPaymentBanner("cancelled");
      return;
    }
    if (result !== "exitoso") return;

    setPaymentBanner("processing");
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function applyPaid(paid?: number) {
      setStatus("PAID");
      if (paid !== undefined) setPaidTotal(paid);
      setPaymentBanner("paid");
    }

    async function confirmWithStripe(): Promise<boolean> {
      if (!sessionId.startsWith("cs_")) return false;
      const res = await fetch(`/api/sites/${siteKey}/confirm-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => null);
      if (!res) return false;
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === "PAID") {
        await applyPaid(data.paidTotal);
        return true;
      }
      return false;
    }

    async function pollSite(): Promise<boolean> {
      const res = await fetch(`/api/sites/${siteKey}`).catch(() => null);
      if (!res?.ok) return false;
      const site = await res.json();
      if (site.status === "PAID") {
        await applyPaid(site.invoice?.paidTotal ?? site.invoice?.total ?? 0);
        return true;
      }
      return false;
    }

    (async () => {
      if (await confirmWithStripe()) return;
      if (cancelled) return;

      let tries = 0;
      timer = setInterval(async () => {
        if (cancelled) return;
        tries += 1;
        if (tries <= 5 && (await confirmWithStripe())) {
          if (timer) clearInterval(timer);
          return;
        }
        if (await pollSite()) {
          if (timer) clearInterval(timer);
          return;
        }
        if (tries >= 20) {
          if (timer) clearInterval(timer);
          setPaymentBanner((b) => (b === "processing" ? "" : b));
          setError(
            "El pago puede haberse recibido, pero aún no se refleja. Espera un minuto y recarga la página. Si sigue igual, revisa el webhook de Stripe o contacta soporte."
          );
        }
      }, 2000);
    })();

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invoice = useMemo(
    () => computeInvoice(config, template, catalog as any),
    [config, template, catalog]
  );

  function update(fn: (c: SiteConfig) => SiteConfig) {
    setConfig((c) => fn(structuredClone(c)));
  }

  function updateSection(id: string, fn: (s: Section) => void) {
    update((c) => {
      const s = c.sections.find((x) => x.id === id);
      if (s) fn(s);
      return c;
    });
  }

  function moveSection(id: string, dir: -1 | 1) {
    update((c) => {
      const sorted = [...c.sections].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= sorted.length) return c;
      [sorted[i].order, sorted[j].order] = [sorted[j].order, sorted[i].order];
      return c;
    });
  }

  function removeSection(id: string) {
    update((c) => {
      const target = c.sections.find((s) => s.id === id);
      c.sections = c.sections.filter((s) => s.id !== id);
      // Si la sección venía de un widget, se quita también el cargo
      if (target) {
        const w = catalog.find((w) => w.sectionType === target.type);
        if (w) c.widgets = c.widgets.filter((x) => x.widgetId !== w.slug);
      }
      return c;
    });
  }

  function hasWidget(slug: string) {
    return config.widgets.some((w) => w.widgetId === slug);
  }

  /** Montaje en línea y montaje con dominio son mutuamente excluyentes. */
  const MONTAJE_SLUGS = ["montaje-sin-dominio", "montaje-con-dominio"] as const;

  function toggleWidget(w: CatalogWidget) {
    update((c) => {
      if (c.widgets.some((x) => x.widgetId === w.slug)) {
        c.widgets = c.widgets.filter((x) => x.widgetId !== w.slug);
        if (w.sectionType) c.sections = c.sections.filter((s) => s.type !== w.sectionType);
      } else {
        // Solo un tipo de montaje a la vez
        if ((MONTAJE_SLUGS as readonly string[]).includes(w.slug)) {
          c.widgets = c.widgets.filter((x) => !(MONTAJE_SLUGS as readonly string[]).includes(x.widgetId));
        }
        c.widgets.push({ widgetId: w.slug, config: {} });
        if (w.sectionType && !c.sections.some((s) => s.type === w.sectionType)) {
          const maxOrder = Math.max(0, ...c.sections.map((s) => s.order));
          c.sections.push(makeSection(w.sectionType as SectionType, maxOrder + 1, c.business.name));
        }
      }
      return c;
    });
  }

  function widgetConfig(slug: string): Record<string, any> {
    return config.widgets.find((w) => w.widgetId === slug)?.config ?? {};
  }

  function setWidgetConfig(slug: string, patch: Record<string, any>) {
    update((c) => {
      const entry = c.widgets.find((w) => w.widgetId === slug);
      if (entry) entry.config = { ...entry.config, ...patch };
      return c;
    });
  }

  /** Agrega una sección: gratis si es base (hero/about/products), con cargo si viene de un widget. */
  function addSection(type: SectionType) {
    const w = catalog.find((x) => x.sectionType === type);
    if (w && !hasWidget(w.slug)) {
      toggleWidget(w); // agrega la sección y su cargo en la factura
      return;
    }
    update((c) => {
      const maxOrder = Math.max(0, ...c.sections.map((s) => s.order));
      c.sections.push(makeSection(type, maxOrder + 1, c.business.name));
      return c;
    });
  }

  /** Página adicional: no es toggle — la cantidad es el número de páginas definidas. */
  function setExtraPages(pages: ExtraPage[]) {
    update((c) => {
      c.widgets = c.widgets.filter((w) => w.widgetId !== "pagina-adicional");
      if (pages.length > 0) c.widgets.push({ widgetId: "pagina-adicional", config: { pages } });
      return c;
    });
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/sites/${siteKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo guardar. Intenta de nuevo.");
      return;
    }
    const j = await res.json().catch(() => ({}));
    // Si agregó módulos después de pagar, el servidor regresa el pedido a
    // pendiente y aquí se refleja (se bloquea la descarga de nuevo).
    if (j.status) setStatus(j.status);
    if (j.invoice?.paidTotal !== undefined) setPaidTotal(j.invoice.paidTotal);
    setSavedAt(new Date());
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }

  const sorted = [...config.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="app-surface flex h-[100dvh] max-w-[100vw] flex-col overflow-x-hidden bg-slate-100">
      {/* Barra superior — apilada y sin overflow en móvil */}
      <header className="shrink-0 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="min-w-0 truncate text-sm font-semibold text-slate-900 sm:text-base">
              {config.business.name}
            </span>
            <Badge tone="indigo" className="hidden shrink-0 sm:inline-flex">
              {template.name}
            </Badge>
            {status === "COMPLETED" && (
              <Badge tone="slate" className="hidden shrink-0 md:inline-flex">
                Pedido
              </Badge>
            )}
            {status === "PAID" && (
              <Badge tone="green" className="shrink-0">
                Pagado
              </Badge>
            )}
          </div>

          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {savedAt && !saving && (
              <span className="order-last w-full text-[10px] text-slate-400 sm:order-none sm:w-auto sm:text-xs">
                Guardado {savedAt.toLocaleTimeString()}
              </span>
            )}
            {error && <span className="w-full text-[11px] text-rose-600 sm:w-auto">{error}</span>}

            <Button variant="ghost" size="sm" onClick={copyLink} className="h-9 min-h-9 px-2.5 text-xs sm:h-8 sm:text-sm">
              <span className="sm:hidden">{linkCopied ? "✓" : "🔗"}</span>
              <span className="hidden sm:inline">{linkCopied ? "✓ Copiado" : "🔗 Enlace"}</span>
            </Button>

            <Link href={`/preview/${siteKey}`} target="_blank" className="hidden sm:inline-flex">
              <Button variant="outline" size="sm" className="h-8 text-xs sm:text-sm">
                Vista ↗
              </Button>
            </Link>

            {status === "PAID" ? (
              <a href={`/api/sites/${siteKey}/export`} className="hidden sm:inline-flex">
                <Button variant="secondary" size="sm" className="h-8 text-xs sm:text-sm">
                  .zip
                </Button>
              </a>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                disabled
                title="La descarga se habilita con el pago confirmado"
                className="hidden h-8 sm:inline-flex"
              >
                🔒 .zip
              </Button>
            )}

            <PayButton
              siteKey={siteKey}
              lineItems={invoice.lineItems}
              total={invoice.total}
              paidTotal={paidTotal}
              status={status}
              initialWhatsapp={config.whatsapp?.number ?? config.business?.phone ?? ""}
              prepareCheckout={async (customerWhatsapp) => {
                const next = structuredClone(config);
                next.whatsapp = {
                  ...next.whatsapp,
                  enabled: true,
                  number: customerWhatsapp,
                  defaultMessage:
                    next.whatsapp?.defaultMessage ||
                    "Hola, vi su sitio web y me gustaría más información.",
                };
                if (!next.business.phone?.trim()) next.business.phone = customerWhatsapp;
                setConfig(next);
                const res = await fetch(`/api/sites/${siteKey}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ config: next }),
                });
                if (!res.ok) return false;
                const j = await res.json().catch(() => ({}));
                if (j.status) setStatus(j.status);
                if (j.invoice?.paidTotal !== undefined) setPaidTotal(j.invoice.paidTotal);
                return true;
              }}
            />

            <Button
              size="sm"
              onClick={save}
              disabled={saving}
              className="h-9 min-h-9 flex-1 px-3 text-xs sm:h-8 sm:flex-none sm:text-sm"
            >
              {saving ? "…" : "Guardar"}
            </Button>
          </div>
        </div>
      </header>

      {/* Estado del pago al volver de Stripe */}
      {paymentBanner === "processing" && (
        <div className="shrink-0 border-b border-sky-200 bg-sky-50 px-3 py-1.5 text-center text-[11px] text-sky-800 sm:text-xs">
          ⏳ Pago recibido — confirmando… la descarga se desbloqueará en unos segundos.
        </div>
      )}
      {paymentBanner === "paid" && (
        <div className="shrink-0 border-b border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-[11px] text-emerald-800 sm:text-xs">
          ✅ ¡Pago confirmado! Ya puedes descargar tu sitio.
        </div>
      )}
      {paymentBanner === "cancelled" && (
        <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-center text-[11px] text-amber-800 sm:text-xs">
          El pago se canceló — puedes intentarlo de nuevo con Pagar.
        </div>
      )}

      {/* Aviso: la URL es la llave de acceso (oculto en pantallas muy chicas) */}
      <div className="hidden shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800 sm:block">
        ⚠️ Este enlace es tu llave de acceso al sitio: <b>guárdalo</b> (márcalo como favorito o cópialo). Cualquiera con el enlace puede editarlo.
      </div>

      {/* Móvil: columna (editor arriba, preview abajo). Desktop: fila */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden md:flex-row">
        {/* Panel de edición */}
        <aside className="flex min-h-0 w-full min-w-0 shrink-0 flex-col border-b border-slate-200 bg-white md:h-auto md:w-[min(380px,38vw)] md:shrink-0 md:border-b-0 md:border-r">
          <nav className="flex shrink-0 border-b border-slate-200 text-sm">
            {(["secciones", "widgets", "negocio"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`flex-1 px-2 py-2.5 text-xs font-medium capitalize transition-colors sm:px-3 sm:text-sm ${
                  tab === t ? "border-b-2 border-brand-navy text-brand-navy" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
            {/* Factura compacta solo en móvil */}
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:hidden">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-800">Total</span>
                <span className="text-lg font-bold text-brand-navy">{formatMoney(invoice.total)}</span>
              </div>
              <p className="mt-0.5 text-[10px] text-slate-400">MXN · se actualiza con cada cambio</p>
            </div>

            {tab === "negocio" && <BusinessEditor config={config} update={update} />}

            {tab === "secciones" && (
              <div className="min-w-0 space-y-3">
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  💡 Cada sección puede aparecer (o no) en el menú del header. <b>Consejo:</b> si agregas todas al menú
                  puede verse demasiado lleno — elige las 3 o 4 más importantes.
                </p>
                {sorted.map((section, i) => (
                  <SectionEditor
                    key={section.id}
                    section={section}
                    isFirst={i === 0}
                    isLast={i === sorted.length - 1}
                    canRemove={!BASE_SECTIONS.has(section.type) || section.type !== "hero"}
                    onChange={(fn) => updateSection(section.id, fn)}
                    onMove={(dir) => moveSection(section.id, dir)}
                    onRemove={() => removeSection(section.id)}
                  />
                ))}
                <AddSectionControl sections={config.sections} catalog={catalog} onAdd={addSection} />
              </div>
            )}

            {tab === "widgets" && (
              <div className="min-w-0 space-y-3">
                {catalog
                  .filter((w) => w.slug !== "seccion-extra" && w.slug !== "pagina-adicional")
                  .map((w) => {
                    const active = hasWidget(w.slug);
                    return (
                      <div
                        key={w.slug}
                        className={`min-w-0 rounded-xl border p-3 transition-colors sm:p-4 ${active ? "border-brand-blue bg-brand-teal/10" : "border-slate-200"}`}
                      >
                        <div className="flex items-start justify-between gap-2 sm:gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{w.description}</p>
                          </div>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={active}
                            onClick={() => toggleWidget(w)}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${active ? "bg-brand-navy" : "bg-slate-300"}`}
                          >
                            <span
                              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${active ? "left-[22px]" : "left-0.5"}`}
                            />
                          </button>
                        </div>
                        <p className="mt-2 text-sm font-bold text-brand-navy">{formatMoney(w.price)}</p>
                        {active && <WidgetConfig widget={w} config={widgetConfig(w.slug)} onConfig={(patch) => setWidgetConfig(w.slug, patch)} />}
                      </div>
                    );
                  })}
                <ExtraPagesCard
                  widget={catalog.find((w) => w.slug === "pagina-adicional")}
                  pages={(widgetConfig("pagina-adicional").pages as ExtraPage[]) ?? []}
                  onChange={setExtraPages}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Preview en vivo — debajo en móvil, a la derecha en desktop */}
        <main className="min-h-[45vh] min-w-0 flex-1 overflow-x-hidden overflow-y-auto bg-slate-200 p-2 sm:p-4 md:min-h-0">
          <p className="mb-2 text-center text-[11px] font-medium text-slate-500 md:hidden">Vista previa en vivo</p>
          <div
            className="mx-auto min-h-full w-full max-w-5xl overflow-x-hidden overflow-hidden rounded-xl bg-white shadow-2xl"
            style={{ transform: "translateZ(0)" }}
          >
            <SiteRenderer config={config} templateConfig={templateConfig} />
          </div>
        </main>

        {/* Factura en tiempo real (solo desktop grande) */}
        <aside className="hidden w-[300px] shrink-0 flex-col border-l border-slate-200 bg-white lg:flex">
          <div className="border-b border-slate-200 px-4 py-3">
            <h2 className="text-sm font-semibold text-slate-900">🧾 Tu factura</h2>
            <p className="text-xs text-slate-400">Se actualiza con cada cambio</p>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <ul className="space-y-3">
              {invoice.lineItems.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-slate-600">
                    {item.label}
                    {item.qty > 1 && <span className="text-slate-400"> ×{item.qty}</span>}
                  </span>
                  <span className="shrink-0 font-medium text-slate-900">{formatMoney(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border-t border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="text-2xl font-bold text-brand-navy">{formatMoney(invoice.total)}</span>
            </div>
            <p className="mt-1 text-xs text-slate-400">MXN · pago único</p>
          </div>
        </aside>
      </div>
    </div>
  );
}

/**
 * Pago con Stripe Checkout: pide WhatsApp del cliente, guarda el pedido,
 * crea la sesión y redirige a la pasarela.
 */
function PayButton({
  siteKey,
  lineItems,
  total,
  paidTotal,
  status,
  initialWhatsapp,
  prepareCheckout,
}: {
  siteKey: string;
  lineItems: LineItem[];
  total: number;
  paidTotal: number;
  status: string;
  initialWhatsapp?: string;
  /** Guarda config (con WhatsApp) + factura antes de abrir Stripe. */
  prepareCheckout: (customerWhatsapp: string) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState("");
  const [whatsapp, setWhatsapp] = useState(initialWhatsapp ?? "");

  const saldo = Math.max(0, total - paidTotal);
  const canPay =
    saldo > 0 && (status === "DRAFT" || status === "COMPLETED" || (status === "PAID" && paidTotal > 0 && total > paidTotal));

  function normalizeWa(raw: string): string {
    let d = raw.replace(/\D/g, "");
    // 10 dígitos locales MX → 52 + número
    if (d.length === 10) d = `52${d}`;
    // 521 + 10 → 52 + 10
    if (d.length === 13 && d.startsWith("521")) d = `52${d.slice(3)}`;
    return d;
  }

  async function goToStripe() {
    setLoading(true);
    setPayError("");
    const wa = normalizeWa(whatsapp);
    if (wa.length < 12) {
      setPayError("Ingresa tu WhatsApp con código de país (ej. 529991234567 o 10 dígitos locales).");
      setLoading(false);
      return;
    }
    try {
      const prepared = await prepareCheckout(wa);
      if (!prepared) {
        setPayError("No se pudo guardar tu pedido. Intenta de nuevo.");
        setLoading(false);
        return;
      }
      const checkout = await fetch(`/api/sites/${siteKey}/checkout`, { method: "POST" });
      const data = await checkout.json().catch(() => ({}));
      if (checkout.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      if (checkout.status === 503) {
        setPayError(
          data.error ||
            "Los pagos en línea no están configurados todavía. Contacta al administrador."
        );
      } else if (checkout.status === 400) {
        setPayError(data.error || "No hay monto pendiente por pagar.");
      } else {
        setPayError(data.error || "No se pudo abrir la pasarela de pago. Intenta de nuevo en un momento.");
      }
    } catch {
      setPayError("Error de conexión. Revisa tu internet e intenta de nuevo.");
    }
    setLoading(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPayError("");
          setWhatsapp(initialWhatsapp ?? whatsapp);
          setOpen(true);
        }}
        className="h-9 min-h-9 shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors hover:bg-emerald-500 sm:h-8 sm:text-sm"
      >
        {status === "PAID" && saldo <= 0
          ? "Pedido"
          : saldo > 0 && paidTotal > 0
            ? "Saldo"
            : "Pagar"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Resumen de tu pedido</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {lineItems.map((item, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="text-slate-600">
                    {item.label}
                    {item.qty > 1 ? ` ×${item.qty}` : ""}
                  </span>
                  <span className="shrink-0 font-medium">{formatMoney(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-brand-navy">{formatMoney(total)}</span>
            </div>
            {paidTotal > 0 && total > paidTotal && (
              <div className="mt-2 rounded-lg bg-brand-teal/15 p-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>Ya pagado</span>
                  <span>−{formatMoney(paidTotal)}</span>
                </div>
                <div className="mt-1 flex justify-between font-semibold text-brand-navy">
                  <span>Saldo pendiente</span>
                  <span>{formatMoney(saldo)}</span>
                </div>
              </div>
            )}

            {canPay ? (
              <>
                <div className="mt-4 space-y-1.5">
                  <Label>Tu WhatsApp (obligatorio)</Label>
                  <Input
                    type="tel"
                    inputMode="tel"
                    placeholder="529991234567 o 9991234567"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    disabled={loading}
                  />
                  <p className="text-[11px] text-slate-500">
                    Te enviaremos la confirmación del pago a este número. Usa código de país <b>52</b> (México) + 10 dígitos.
                  </p>
                </div>
                <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800">
                  Al continuar serás redirigido a la <b>pasarela de pago segura (Stripe)</b> para pagar{" "}
                  <b>{formatMoney(saldo)}</b>. Al terminar podrás descargar el .zip de tu sitio.
                </p>
                {payError && (
                  <p className="mt-3 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{payError}</p>
                )}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setOpen(false)} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={goToStripe} disabled={loading || !whatsapp.trim()}>
                    {loading ? "Abriendo pago…" : `Ir a pagar ${formatMoney(saldo)}`}
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4">
                <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                  {status === "PAID"
                    ? "✅ Tu pedido está pagado. Si agregas módulos nuevos, aquí aparecerá el saldo a cubrir."
                    : "✅ No hay saldo pendiente por pagar."}
                </p>
                <Button variant="outline" className="mt-3 w-full" onClick={() => setOpen(false)}>
                  Cerrar
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/** Re-agregar secciones borradas o sumar nuevas desde la lista de secciones. */
function AddSectionControl({
  sections,
  catalog,
  onAdd,
}: {
  sections: Section[];
  catalog: { slug: string; sectionType: string | null; price: number }[];
  onAdd: (type: SectionType) => void;
}) {
  const [selected, setSelected] = useState("");
  const present = new Set(sections.map((s) => s.type));
  const available = (Object.keys(SECTION_LABELS) as SectionType[]).filter((t) => !present.has(t));
  if (available.length === 0) return null;

  const priceLabel = (t: SectionType) => {
    const w = catalog.find((x) => x.sectionType === t);
    return w ? `+${formatMoney(w.price)}` : "incluida";
  };

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-3">
      <Label>Agregar sección</Label>
      <div className="flex gap-1">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
        >
          <option value="">Elige una sección…</option>
          {available.map((t) => (
            <option key={t} value={t}>
              {SECTION_LABELS[t]} ({priceLabel(t)})
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={!selected}
          onClick={() => {
            onAdd(selected as SectionType);
            setSelected("");
          }}
        >
          Agregar
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-slate-400">
        Las secciones borradas se pueden volver a agregar aquí. Las que vienen de un widget suman su precio a la factura.
      </p>
    </div>
  );
}

// --- Configuración de widgets ------------------------------------------------

export type ExtraPage = { title: string; content: string };

/** Config específica por widget cuando está activo. */
function WidgetConfig({
  widget,
  config,
  onConfig,
}: {
  widget: { slug: string; sectionType: string | null };
  config: Record<string, any>;
  onConfig: (patch: Record<string, any>) => void;
}) {
  if (widget.slug === "contacto-avanzado") {
    return (
      <div className="mt-3 space-y-2 border-t border-brand-teal/30 pt-3">
        <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
          📬 El <b>envío</b> de este formulario (a tu correo o WhatsApp) lo configuramos nosotros al entregar tu sitio.
          Los textos sí puedes editarlos desde ya en la pestaña <b>Secciones</b>.
        </p>
      </div>
    );
  }
  if (widget.slug === "montaje-con-dominio") {
    return (
      <div className="mt-3 space-y-2 border-t border-brand-teal/30 pt-3">
        <p className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
          Solo puedes elegir <b>un</b> tipo de montaje. Si activas este, se desactiva el montaje sin dominio.
        </p>
        <Label>¿Qué dominio te gustaría?</Label>
        <Input
          placeholder="minegocio.com"
          value={config.desiredDomain ?? ""}
          onChange={(e) => onConfig({ desiredDomain: e.target.value })}
        />
        <p className="text-xs text-slate-400">
          El costo del dominio depende de su disponibilidad y terminación (.com, .mx…). Te cotizamos antes de comprarlo.
        </p>
      </div>
    );
  }
  if (widget.slug === "montaje-sin-dominio") {
    return (
      <div className="mt-3 space-y-2 border-t border-brand-teal/30 pt-3">
        <p className="rounded-lg bg-slate-50 p-2 text-[11px] text-slate-500">
          Solo puedes elegir <b>un</b> tipo de montaje. Si activas este, se desactiva el montaje con dominio propio.
        </p>
        <Label>Nombre para tu dirección web</Label>
        <div className="flex items-center gap-1">
          <Input
            placeholder="mi-negocio"
            value={config.subdomain ?? ""}
            onChange={(e) => onConfig({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
          />
          <span className="text-xs text-slate-400">.netlify.app</span>
        </div>
      </div>
    );
  }
  if (widget.sectionType) {
    return (
      <p className="mt-3 border-t border-brand-teal/30 pt-3 text-xs text-slate-500">
        ✏️ Su contenido y estilo se editan en la pestaña <b>Secciones</b>.
      </p>
    );
  }
  return null;
}

/** Página adicional: se definen cuántas y qué lleva cada una (precio por página). */
function ExtraPagesCard({
  widget,
  pages,
  onChange,
}: {
  widget?: { name: string; description: string; price: number };
  pages: ExtraPage[];
  onChange: (pages: ExtraPage[]) => void;
}) {
  if (!widget) return null;
  return (
    <div className={`rounded-xl border p-4 transition-colors ${pages.length > 0 ? "border-brand-blue bg-brand-teal/10" : "border-slate-200"}`}>
      <p className="text-sm font-semibold text-slate-900">{widget.name}</p>
      <p className="mt-0.5 text-xs text-slate-500">{widget.description}</p>
      <p className="mt-2 text-sm font-bold text-brand-navy">
        {formatMoney(widget.price)} <span className="font-normal text-slate-400">por página</span>
        {pages.length > 0 && <span className="ml-2 text-slate-600">× {pages.length} = {formatMoney(widget.price * pages.length)}</span>}
      </p>

      <div className="mt-3 space-y-3">
        {pages.map((page, i) => (
          <div key={i} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <Label className="mb-0">Página {i + 1}</Label>
              <button onClick={() => onChange(pages.filter((_, j) => j !== i))} className="text-xs text-rose-500 hover:underline">
                Quitar
              </button>
            </div>
            <Input
              className="mt-2"
              placeholder="Título (ej. Nosotros, Menú, Contacto)"
              value={page.title}
              onChange={(e) => onChange(pages.map((p, j) => (j === i ? { ...p, title: e.target.value } : p)))}
            />
            <Textarea
              className="mt-2"
              rows={3}
              placeholder="¿Qué va en esta página? Describe el contenido (texto, fotos, secciones que quieres)…"
              value={page.content}
              onChange={(e) => onChange(pages.map((p, j) => (j === i ? { ...p, content: e.target.value } : p)))}
            />
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={() => onChange([...pages, { title: "", content: "" }])}>
          + Agregar página
        </Button>
      </div>
    </div>
  );
}

// --- Editores ---------------------------------------------------------------

function BusinessEditor({ config, update }: { config: SiteConfig; update: (fn: (c: SiteConfig) => SiteConfig) => void }) {
  const b = config.business;
  const w = config.whatsapp;
  const setB = (k: keyof typeof b) => (e: React.ChangeEvent<HTMLInputElement>) =>
    update((c) => ((c.business as any)[k] = e.target.value, c));
  return (
    <div className="space-y-4">
      <LogoField
        logoUrl={b.logoUrl}
        faviconUrl={b.faviconUrl}
        onUploaded={(logoUrl, faviconUrl) =>
          update((c) => {
            c.business.logoUrl = logoUrl;
            if (faviconUrl) c.business.faviconUrl = faviconUrl;
            return c;
          })
        }
      />
      <div>
        <Label>Nombre del negocio</Label>
        <Input value={b.name} onChange={setB("name")} />
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={b.showNameInHeader !== false}
            onChange={(e) => update((c) => ((c.business.showNameInHeader = e.target.checked), c))}
            disabled={!b.logoUrl}
          />
          Mostrar el nombre junto al logo en el header
          {!b.logoUrl && <span className="text-slate-400">(sin logo, el nombre siempre se muestra)</span>}
        </label>
      </div>
      <div>
        <Label>Correo</Label>
        <Input value={b.email} onChange={setB("email")} />
      </div>
      <div>
        <Label>Teléfono</Label>
        <Input value={b.phone} onChange={setB("phone")} />
      </div>
      <div>
        <Label>Dirección</Label>
        <Input value={b.address} onChange={setB("address")} />
      </div>
      <div className="rounded-xl bg-emerald-50 p-3">
        <p className="mb-2 text-xs font-semibold text-emerald-800">WhatsApp</p>
        <Label>Número</Label>
        <Input value={w.number} onChange={(e) => update((c) => ((c.whatsapp.number = e.target.value), (c.whatsapp.enabled = !!e.target.value), c))} />
        <Label className="mt-3">Mensaje predeterminado</Label>
        <Textarea rows={2} value={w.defaultMessage} onChange={(e) => update((c) => ((c.whatsapp.defaultMessage = e.target.value), c))} />
      </div>
      <div>
        <p className="mb-2 text-xs font-semibold text-slate-500">Redes sociales (URLs)</p>
        {(Object.keys(config.social) as (keyof typeof config.social)[]).map((net) => (
          <div key={net} className="mb-2">
            <Label className="capitalize">{net}</Label>
            <Input value={config.social[net]} onChange={(e) => update((c) => ((c.social[net] = e.target.value), c))} />
          </div>
        ))}
      </div>
      <FontsEditor config={config} update={update} />
    </div>
  );
}

const FONT_PRESETS: { label: string; heading: string; body: string }[] = [
  { label: "Ochentera — Righteous + Work Sans", heading: "Righteous", body: "Work Sans" },
  { label: "Elegante — Playfair Display + Source Sans 3", heading: "Playfair Display", body: "Source Sans 3" },
  { label: "Moderna — Space Grotesk + Inter", heading: "Space Grotesk", body: "Inter" },
  { label: "Cálida — Fraunces + Karla", heading: "Fraunces", body: "Karla" },
  { label: "Editorial — Libre Baskerville + Open Sans", heading: "Libre Baskerville", body: "Open Sans" },
  { label: "Divertida — Baloo 2 + Nunito", heading: "Baloo 2", body: "Nunito" },
];

/** Tipografía del sitio: preset curado o embed de Google Fonts pegado por el usuario. */
function FontsEditor({ config, update }: { config: SiteConfig; update: (fn: (c: SiteConfig) => SiteConfig) => void }) {
  const theme = config.theme ?? { fontHeading: "", fontBody: "", fontEmbedUrl: "" };
  const [custom, setCustom] = useState(Boolean(theme.fontEmbedUrl));
  const [embedDraft, setEmbedDraft] = useState(theme.fontEmbedUrl);

  const setTheme = (patch: Partial<typeof theme>) =>
    update((c) => ((c.theme = { ...(c.theme ?? { fontHeading: "", fontBody: "", fontEmbedUrl: "" }), ...patch }), c));

  const presetValue =
    !theme.fontEmbedUrl && theme.fontHeading
      ? FONT_PRESETS.findIndex((p) => p.heading === theme.fontHeading && p.body === theme.fontBody)
      : -1;

  function applyEmbed() {
    // Acepta el <link> completo de Google Fonts o solo la URL
    const match = embedDraft.match(/href="([^"]+)"/) ?? embedDraft.match(/(https:\/\/fonts\.googleapis\.com\/css2[^\s"'<>]+)/);
    const url = match?.[1] ?? match?.[0] ?? "";
    if (!url.startsWith("https://fonts.googleapis.com/")) {
      alert("Pega el código embed (o la URL) de Google Fonts — debe apuntar a fonts.googleapis.com");
      return;
    }
    setTheme({ fontEmbedUrl: url });
  }

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <p className="mb-2 text-xs font-semibold text-slate-500">Tipografía del sitio</p>
      {!custom ? (
        <>
          <select
            value={presetValue}
            onChange={(e) => {
              const i = Number(e.target.value);
              if (i < 0) setTheme({ fontHeading: "", fontBody: "", fontEmbedUrl: "" });
              else setTheme({ fontHeading: FONT_PRESETS[i].heading, fontBody: FONT_PRESETS[i].body, fontEmbedUrl: "" });
            }}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
          >
            <option value={-1}>La del template (recomendada)</option>
            {FONT_PRESETS.map((p, i) => (
              <option key={i} value={i}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => setCustom(true)} className="mt-2 text-xs text-brand-blue hover:underline">
            Usar otra fuente de Google Fonts →
          </button>
        </>
      ) : (
        <div className="space-y-2">
          <Label className="text-xs">Pega el código embed de Google Fonts (el &lt;link&gt;)</Label>
          <Textarea rows={3} value={embedDraft} onChange={(e) => setEmbedDraft(e.target.value)} placeholder={'<link href="https://fonts.googleapis.com/css2?family=..." rel="stylesheet">'} className="font-mono text-xs" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Fuente de títulos</Label>
              <Input value={theme.fontHeading} onChange={(e) => setTheme({ fontHeading: e.target.value })} placeholder="Ej. Lobster" />
            </div>
            <div>
              <Label className="text-xs">Fuente de texto</Label>
              <Input value={theme.fontBody} onChange={(e) => setTheme({ fontBody: e.target.value })} placeholder="Ej. Lato" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={applyEmbed}>Aplicar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setCustom(false); setTheme({ fontHeading: "", fontBody: "", fontEmbedUrl: "" }); }}>
              Volver a presets
            </Button>
          </div>
          <p className="text-[11px] text-slate-400">
            En fonts.google.com elige tu fuente → "Get embed code" → copia el bloque &lt;link&gt; y escribe los nombres tal cual aparecen.
          </p>
        </div>
      )}
    </div>
  );
}

function SectionEditor({
  section,
  isFirst,
  isLast,
  canRemove,
  onChange,
  onMove,
  onRemove,
}: {
  section: Section;
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  onChange: (fn: (s: Section) => void) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const c = section.content;
  const setContent = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange((s) => (s.content[k] = e.target.value));

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 text-left text-sm font-medium text-slate-800">
          {open ? "▾" : "▸"} {SECTION_LABELS[section.type]}
        </button>
        <div className="flex items-center gap-1 text-slate-400">
          <button onClick={() => onMove(-1)} disabled={isFirst} className="rounded px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-30" title="Subir">↑</button>
          <button onClick={() => onMove(1)} disabled={isLast} className="rounded px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-30" title="Bajar">↓</button>
          {canRemove && section.type !== "hero" && (
            <button onClick={onRemove} className="rounded px-1.5 py-0.5 text-rose-400 hover:bg-rose-50" title="Quitar">✕</button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={section.inMenu} onChange={(e) => onChange((s) => (s.inMenu = e.target.checked))} />
            Mostrar en el menú del header
          </label>
          {section.type === "contact" && (
            <p className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-700">
              📬 Aquí editas los textos del formulario. El <b>envío de mensajes</b> (a tu correo o WhatsApp) lo
              configuramos nosotros al entregar tu sitio — no tienes que hacer nada técnico.
            </p>
          )}
          {/* Contenido por tipo */}
          {"title" in c && (
            <div>
              <Label>Título</Label>
              <Input value={c.title ?? ""} onChange={setContent("title")} />
            </div>
          )}
          {section.type === "hero" && (
            <>
              <div><Label>Subtítulo</Label><Textarea rows={2} value={c.subtitle ?? ""} onChange={setContent("subtitle")} /></div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(String(c.ctaText ?? "").trim())}
                  onChange={(e) =>
                    onChange((s) => {
                      if (e.target.checked) {
                        s.content.ctaText = String(s.content.ctaText ?? "").trim() || "Contáctanos";
                      } else {
                        s.content.ctaText = "";
                      }
                    })
                  }
                />
                Mostrar botón de contacto
              </label>
              {Boolean(String(c.ctaText ?? "").trim()) && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label>Texto del botón</Label>
                      <Input value={c.ctaText ?? ""} onChange={setContent("ctaText")} />
                    </div>
                    <div>
                      <Label>Enlace del botón</Label>
                      <Input
                        value={c.ctaLink ?? ""}
                        onChange={setContent("ctaLink")}
                        placeholder="Vacío = WhatsApp del negocio"
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    El botón es opcional. Por defecto abre un chat de WhatsApp con el número del negocio
                    (Negocio → WhatsApp). Solo llena el enlace si quieres mandar a otra URL.
                  </p>
                </>
              )}
            </>
          )}
          {section.type === "about" && (
            <>
              <div><Label>Texto</Label><Textarea rows={4} value={c.text ?? ""} onChange={setContent("text")} /></div>
              <ImageField label="Imagen" value={c.imageUrl ?? ""} onUploaded={(url) => onChange((s) => (s.content.imageUrl = url))} />
            </>
          )}
          {section.type === "map" && (
            <>
              <div><Label>Dirección visible</Label><Input value={c.address ?? ""} onChange={setContent("address")} /></div>
              <div><Label>URL de embed de Google Maps</Label><Input value={c.embedUrl ?? ""} onChange={setContent("embedUrl")} placeholder="https://www.google.com/maps/embed?pb=…" /></div>
            </>
          )}
          {section.type === "contact" && (
            <div><Label>Subtítulo</Label><Input value={c.subtitle ?? ""} onChange={setContent("subtitle")} /></div>
          )}
          {(section.type === "products" || section.type === "testimonials" || section.type === "faq") && (
            <ItemsEditor section={section} onChange={onChange} />
          )}
          {section.type === "gallery" && <GalleryEditor section={section} onChange={onChange} />}
          {section.type === "carousel" && <CarouselEditor section={section} onChange={onChange} />}

          {/* Estilo */}
          <div className="rounded-lg bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold text-slate-500">Estilo de la sección</p>
            <Label>Fondo</Label>
            <div className="mb-2 flex gap-1">
              {(["solid", "gradient", "image"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => onChange((s) => (s.style.background.type = t))}
                  className={`rounded-md px-2 py-1 text-xs capitalize ${section.style.background.type === t ? "bg-brand-navy text-white" : "bg-white text-slate-600 border border-slate-200"}`}
                >
                  {t === "solid" ? "Sólido" : t === "gradient" ? "Degradado" : "Imagen"}
                </button>
              ))}
            </div>
            {section.style.background.type === "solid" && (
              <input type="color" value={section.style.background.value || "#ffffff"} onChange={(e) => onChange((s) => (s.style.background.value = e.target.value))} className="h-9 w-full cursor-pointer rounded border border-slate-200" />
            )}
            {section.style.background.type === "gradient" && (
              <Input placeholder="linear-gradient(135deg, #667eea, #764ba2)" value={section.style.background.value} onChange={(e) => onChange((s) => (s.style.background.value = e.target.value))} />
            )}
            {section.style.background.type === "image" && (
              <>
                <ImageField
                  label="Imagen de fondo"
                  value={section.style.background.value}
                  onUploaded={(url) =>
                    onChange((s) => {
                      s.style.background.value = url;
                      // Default 45% si aún no hay overlay configurado
                      if (s.style.background.overlay === undefined || s.style.background.overlay === "") {
                        s.style.background.overlay = overlayFromPercent(45);
                      }
                    })
                  }
                />
                {section.style.background.value && (
                  <div className="mt-2">
                    <Label>
                      Oscuridad del overlay ({overlayOpacityPercent(section.style.background.overlay)}%)
                    </Label>
                    <input
                      type="range"
                      min={0}
                      max={90}
                      step={5}
                      value={overlayOpacityPercent(section.style.background.overlay)}
                      onChange={(e) =>
                        onChange((s) => {
                          const next = overlayFromPercent(Number(e.target.value));
                          if (next) s.style.background.overlay = next;
                          else delete s.style.background.overlay;
                        })
                      }
                      className="w-full"
                    />
                    <p className="mt-1 text-[11px] text-slate-500">
                      0% = imagen sin capa oscura. Sube el valor para que el texto se lea mejor.
                    </p>
                  </div>
                )}
              </>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <Label>Color de texto</Label>
                <input type="color" value={section.style.textColor || "#111111"} onChange={(e) => onChange((s) => (s.style.textColor = e.target.value))} className="h-9 w-full cursor-pointer rounded border border-slate-200" />
              </div>
              <div>
                <Label>Color de acento</Label>
                <input type="color" value={section.style.accentColor || "#6366f1"} onChange={(e) => onChange((s) => (s.style.accentColor = e.target.value))} className="h-9 w-full cursor-pointer rounded border border-slate-200" />
              </div>
            </div>
            <div className="mt-2">
              <Label>Tarjetas — esquinas redondeadas ({cardRadiusPx(section.style.card)}px)</Label>
              <input
                type="range"
                min={0}
                max={48}
                value={cardRadiusPx(section.style.card)}
                onChange={(e) => onChange((s) => (s.style.card.radius = Number(e.target.value)))}
                className="w-full"
              />
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                <label className="flex items-center gap-1"><input type="checkbox" checked={section.style.card.shadow} onChange={(e) => onChange((s) => (s.style.card.shadow = e.target.checked))} /> Sombra</label>
                <label className="flex items-center gap-1"><input type="checkbox" checked={section.style.card.border} onChange={(e) => onChange((s) => (s.style.card.border = e.target.checked))} /> Borde</label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ItemsEditor({ section, onChange }: { section: Section; onChange: (fn: (s: Section) => void) => void }) {
  const items: any[] = section.content.items ?? [];
  const fields: Record<string, { key: string; label: string; textarea?: boolean; image?: boolean }[]> = {
    products: [
      { key: "name", label: "Nombre" },
      { key: "description", label: "Descripción", textarea: true },
      { key: "price", label: "Precio (texto, ej. $250)" },
      { key: "imageUrl", label: "Foto del producto", image: true },
    ],
    testimonials: [
      { key: "name", label: "Nombre" },
      { key: "role", label: "Cargo / detalle" },
      { key: "text", label: "Testimonio", textarea: true },
    ],
    faq: [
      { key: "q", label: "Pregunta" },
      { key: "a", label: "Respuesta", textarea: true },
    ],
  };
  const empty: Record<string, any> = {
    products: { name: "Nuevo producto", description: "", price: "", imageUrl: "" },
    testimonials: { name: "", role: "", text: "" },
    faq: { q: "", a: "" },
  };
  const f = fields[section.type] ?? [];

  return (
    <div className="space-y-2">
      <Label>Elementos ({items.length})</Label>
      {items.map((item, i) => (
        <details key={i} className="rounded-lg border border-slate-200 p-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">
            {item.name || item.q || `Elemento ${i + 1}`}
          </summary>
          <div className="mt-2 space-y-2">
            {f.map(({ key, label, textarea, image }) => (
              <div key={key}>
                {image ? (
                  <ImageField label={label} value={item[key] ?? ""} onUploaded={(url) => onChange((s) => (s.content.items[i][key] = url))} />
                ) : (
                  <>
                    <Label className="text-xs">{label}</Label>
                    {textarea ? (
                      <Textarea rows={2} value={item[key] ?? ""} onChange={(e) => onChange((s) => (s.content.items[i][key] = e.target.value))} />
                    ) : (
                      <Input value={item[key] ?? ""} onChange={(e) => onChange((s) => (s.content.items[i][key] = e.target.value))} />
                    )}
                  </>
                )}
              </div>
            ))}
            <button onClick={() => onChange((s) => s.content.items.splice(i, 1))} className="text-xs text-rose-500 hover:underline">
              Quitar elemento
            </button>
          </div>
        </details>
      ))}
      <Button variant="outline" size="sm" onClick={() => onChange((s) => (s.content.items = [...items, structuredClone(empty[section.type])]))}>
        + Agregar elemento
      </Button>
    </div>
  );
}

function GalleryEditor({ section, onChange }: { section: Section; onChange: (fn: (s: Section) => void) => void }) {
  const c = section.content;
  const cols = Math.min(10, Math.max(2, Number(c.columns) || 3));
  const images: { url: string; caption?: string }[] = ((c.images as any[]) ?? [])
    .map((i) => (typeof i === "string" ? { url: i } : i))
    .filter((i) => i?.url);
  const max = cols * cols;
  const set = (k: string, v: any) => onChange((s) => (s.content[k] = v));
  const setImages = (imgs: { url: string; caption?: string }[]) => set("images", imgs);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Cuadrícula</Label>
          <select
            value={cols}
            onChange={(e) => set("columns", Number(e.target.value))}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
          >
            {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} × {n} (hasta {n * n} fotos)
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Efecto al pasar el mouse</Label>
          <select
            value={c.hoverEffect ?? "zoom"}
            onChange={(e) => set("hoverEffect", e.target.value)}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
          >
            <option value="none">Ninguno</option>
            <option value="zoom">Zoom</option>
            <option value="lift">Elevar con sombra</option>
            <option value="gray">Gris → color</option>
            <option value="dark">Oscuro → claro</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Espacio horizontal ({Number(c.gapX ?? 12)}px)</Label>
          <input type="range" min={0} max={48} value={Number(c.gapX ?? 12)} onChange={(e) => set("gapX", Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <Label>Espacio vertical ({Number(c.gapY ?? 12)}px)</Label>
          <input type="range" min={0} max={48} value={Number(c.gapY ?? 12)} onChange={(e) => set("gapY", Number(e.target.value))} className="w-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Borde ({Number(c.borderWidth ?? 0)}px)</Label>
          <input type="range" min={0} max={10} value={Number(c.borderWidth ?? 0)} onChange={(e) => set("borderWidth", Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <Label>Color del borde</Label>
          <input
            type="color"
            value={c.borderColor || "#ffffff"}
            onChange={(e) => set("borderColor", e.target.value)}
            className="h-9 w-full cursor-pointer rounded border border-slate-200"
            disabled={!Number(c.borderWidth ?? 0)}
          />
        </div>
      </div>

      <div>
        <Label>Esquinas redondeadas ({Number(c.radius ?? 16)}px)</Label>
        <input type="range" min={0} max={40} value={Number(c.radius ?? 16)} onChange={(e) => set("radius", Number(e.target.value))} className="w-full" />
      </div>

      <div>
        <Label>Texto sobre la imagen</Label>
        <select
          value={c.captionMode ?? "hover"}
          onChange={(e) => set("captionMode", e.target.value)}
          className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
        >
          <option value="none">Sin texto</option>
          <option value="hover">Mostrar al pasar el mouse</option>
          <option value="always">Siempre visible</option>
        </select>
      </div>

      <div>
        <Label>
          Fotos ({images.length} de {max})
        </Label>
        {images.length >= max ? (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Cuadrícula llena. Cambia a una cuadrícula más grande o quita una foto.
          </p>
        ) : (
          <ImageField label="Agregar foto" value="" onUploaded={(url) => setImages([...images, { url, caption: "" }])} />
        )}
        <div className="mt-2 space-y-2">
          {images.map((img, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              <Input
                placeholder="Texto de esta foto (opcional)"
                value={img.caption ?? ""}
                onChange={(e) => setImages(images.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
              />
              <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="shrink-0 text-xs text-rose-500 hover:underline">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Logo del negocio: al subirlo se regenera el favicon automáticamente. */
function LogoField({
  logoUrl,
  faviconUrl,
  onUploaded,
}: {
  logoUrl: string;
  faviconUrl: string;
  onUploaded: (logoUrl: string, faviconUrl?: string) => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload?favicon=1", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const json = await res.json();
      onUploaded(json.url, json.faviconUrl);
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "No se pudo subir el logo.");
    }
  }

  function applyUrl() {
    const u = urlDraft.trim();
    if (!/^https?:\/\/.+/.test(u)) {
      setError("Pega una URL válida (http:// o https://).");
      return;
    }
    setError("");
    onUploaded(u);
    setUrlDraft("");
  }

  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex items-center justify-between">
        <Label className="mb-0">Logo del negocio {uploading && <span className="text-brand-blue">(subiendo…)</span>}</Label>
        <div className="flex gap-1 text-xs">
          <button type="button" onClick={() => setMode("upload")} className={`rounded px-1.5 py-0.5 ${mode === "upload" ? "bg-brand-navy text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            Subir
          </button>
          <button type="button" onClick={() => setMode("url")} className={`rounded px-1.5 py-0.5 ${mode === "url" ? "bg-brand-navy text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            URL
          </button>
        </div>
      </div>
      {mode === "upload" ? (
        <>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
            className="mt-1.5 block w-full text-xs text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-brand-teal/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-navy"
          />
          <p className="mt-1 text-xs text-slate-400">Al subir el logo, el favicon (ícono de la pestaña) se genera solo.</p>
        </>
      ) : (
        <div className="mt-1.5">
          <div className="flex gap-1">
            <Input placeholder="https://misitio.com/logo.png" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" variant="secondary" onClick={applyUrl}>Usar</Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            Si hospedas tu propio logo, pega su enlace directo. Ojo: con URL externa el favicon no se genera automático (súbelo como archivo si lo quieres).
          </p>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {(logoUrl || faviconUrl) && (
        <div className="mt-2 flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {logoUrl && <img src={logoUrl} alt="logo" className="h-10 rounded bg-white p-1" />}
          {faviconUrl && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              Favicon: <img src={faviconUrl} alt="favicon" className="h-5 w-5 rounded" />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function CarouselEditor({ section, onChange }: { section: Section; onChange: (fn: (s: Section) => void) => void }) {
  const c = section.content;
  const images: { url: string; caption?: string }[] = ((c.images as any[]) ?? [])
    .map((i) => (typeof i === "string" ? { url: i } : i))
    .filter((i) => i?.url);
  const set = (k: string, v: any) => onChange((s) => (s.content[k] = v));
  const setImages = (imgs: { url: string; caption?: string }[]) => set("images", imgs);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Avance automático ({Number(c.interval ?? 4)}s)</Label>
          <input type="range" min={2} max={10} value={Number(c.interval ?? 4)} onChange={(e) => set("interval", Number(e.target.value))} className="w-full" />
        </div>
        <div>
          <Label>Altura ({Number(c.height ?? 400)}px)</Label>
          <input type="range" min={240} max={560} step={20} value={Number(c.height ?? 400)} onChange={(e) => set("height", Number(e.target.value))} className="w-full" />
        </div>
      </div>
      <div>
        <Label>Esquinas redondeadas ({Number(c.radius ?? 16)}px)</Label>
        <input type="range" min={0} max={40} value={Number(c.radius ?? 16)} onChange={(e) => set("radius", Number(e.target.value))} className="w-full" />
      </div>
      <div>
        <Label>Fotos ({images.length} de 15)</Label>
        {images.length < 15 && (
          <ImageField label="Agregar foto" value="" onUploaded={(url) => setImages([...images, { url, caption: "" }])} />
        )}
        <div className="mt-2 space-y-2">
          {images.map((img, i) => (
            <div key={i} className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
              <Input
                placeholder="Texto de esta foto (opcional)"
                value={img.caption ?? ""}
                onChange={(e) => setImages(images.map((x, j) => (j === i ? { ...x, caption: e.target.value } : x)))}
              />
              <div className="flex shrink-0 flex-col text-xs text-slate-400">
                <button onClick={() => i > 0 && setImages(images.map((x, j) => (j === i - 1 ? images[i] : j === i ? images[i - 1] : x)))} disabled={i === 0} className="hover:text-slate-700 disabled:opacity-30">↑</button>
                <button onClick={() => i < images.length - 1 && setImages(images.map((x, j) => (j === i + 1 ? images[i] : j === i ? images[i + 1] : x)))} disabled={i === images.length - 1} className="hover:text-slate-700 disabled:opacity-30">↓</button>
              </div>
              <button onClick={() => setImages(images.filter((_, j) => j !== i))} className="shrink-0 text-xs text-rose-500 hover:underline">
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Campo de imagen con dos modos: subir archivo o pegar una URL externa
 * (para quien prefiere hospedar sus propias fotos).
 */
function ImageField({ label, value, onUploaded }: { label: string; value: string; onUploaded: (url: string) => void }) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [urlDraft, setUrlDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setUploading(true);
    setError("");
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      onUploaded((await res.json()).url);
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "No se pudo subir la imagen.");
    }
  }

  function applyUrl() {
    const u = urlDraft.trim();
    if (!/^https?:\/\/.+/.test(u)) {
      setError("Pega una URL válida (debe empezar con http:// o https://).");
      return;
    }
    setError("");
    onUploaded(u);
    setUrlDraft("");
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <Label className="mb-0">{label} {uploading && <span className="text-brand-blue">(subiendo…)</span>}</Label>
        <div className="flex gap-1 text-xs">
          <button type="button" onClick={() => setMode("upload")} className={`rounded px-1.5 py-0.5 ${mode === "upload" ? "bg-brand-navy text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            Subir
          </button>
          <button type="button" onClick={() => setMode("url")} className={`rounded px-1.5 py-0.5 ${mode === "url" ? "bg-brand-navy text-white" : "text-slate-500 hover:bg-slate-100"}`}>
            URL
          </button>
        </div>
      </div>
      {mode === "upload" ? (
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
          className="mt-1.5 block w-full text-xs text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-brand-teal/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-navy"
        />
      ) : (
        <div className="mt-1.5">
          <div className="flex gap-1">
            <Input placeholder="https://misitio.com/foto.jpg" value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} className="h-8 text-xs" />
            <Button size="sm" variant="secondary" onClick={applyUrl}>Usar</Button>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">
            ¿Ya tienes tus fotos en internet (tu hosting, Imgur, Cloudinary…)? Pega aquí su enlace directo.
          </p>
        </div>
      )}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 h-16 rounded object-cover" />
      )}
    </div>
  );
}
