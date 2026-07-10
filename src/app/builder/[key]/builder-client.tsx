"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Textarea, Badge } from "@/components/ui";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { computeInvoice, BASE_SECTIONS, type LineItem } from "@/lib/pricing";
import { formatMoney } from "@/lib/utils";
import {
  getExtraPages,
  makeSection,
  normalizeExtraPages,
  pageId,
  REPEATABLE_SECTIONS,
  SECTION_LABELS,
  type ExtraPage,
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
  initialConfig,
  templateConfig,
  template,
  catalog,
}: {
  siteKey: string;
  siteStatus: string;
  initialConfig: SiteConfig;
  templateConfig: TemplateConfig;
  template: { name: string; basePrice: number };
  catalog: CatalogWidget[];
}) {
  const [config, setConfig] = useState<SiteConfig>(initialConfig);
  const [status, setStatus] = useState(siteStatus);
  const [tab, setTab] = useState<"secciones" | "widgets" | "negocio">("secciones");
  /** "home" = página de inicio; id de ExtraPage = subpágina. */
  const [editingPageId, setEditingPageId] = useState<string>("home");
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

  const extraPages = useMemo(() => getExtraPages(config), [config]);
  const isHome = editingPageId === "home";
  const activeExtraPage = extraPages.find((p) => p.id === editingPageId) ?? null;

  const invoice = useMemo(
    () => computeInvoice(config, template, catalog as any),
    [config, template, catalog]
  );

  function update(fn: (c: SiteConfig) => SiteConfig) {
    setConfig((c) => fn(structuredClone(c)));
  }

  function withPages(c: SiteConfig, pages: ExtraPage[]) {
    c.widgets = c.widgets.filter((w) => w.widgetId !== "pagina-adicional");
    if (pages.length > 0) c.widgets.push({ widgetId: "pagina-adicional", config: { pages } });
  }

  function mutateActiveSections(fn: (sections: Section[]) => Section[]) {
    update((c) => {
      if (editingPageId === "home") {
        c.sections = fn(c.sections);
        return c;
      }
      const pages = normalizeExtraPages(
        c.widgets.find((w) => w.widgetId === "pagina-adicional")?.config?.pages
      );
      const page = pages.find((p) => p.id === editingPageId);
      if (page) page.sections = fn(page.sections);
      withPages(c, pages);
      return c;
    });
  }

  function updateSection(id: string, fn: (s: Section) => void) {
    mutateActiveSections((sections) => {
      const s = sections.find((x) => x.id === id);
      if (s) fn(s);
      return sections;
    });
  }

  function moveSection(id: string, dir: -1 | 1) {
    mutateActiveSections((sections) => {
      const sorted = [...sections].sort((a, b) => a.order - b.order);
      const i = sorted.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= sorted.length) return sections;
      [sorted[i].order, sorted[j].order] = [sorted[j].order, sorted[i].order];
      return sections;
    });
  }

  /** ¿El tipo de sección sigue usándose en inicio o en alguna página? */
  function sectionTypeStillUsed(c: SiteConfig, type: string, exceptId?: string): boolean {
    if (c.sections.some((s) => s.type === type && s.id !== exceptId)) return true;
    return getExtraPages(c).some((p) => p.sections.some((s) => s.type === type && s.id !== exceptId));
  }

  function removeSection(id: string) {
    update((c) => {
      let target: Section | undefined;
      if (editingPageId === "home") {
        target = c.sections.find((s) => s.id === id);
        c.sections = c.sections.filter((s) => s.id !== id);
      } else {
        const pages = getExtraPages(c);
        const page = pages.find((p) => p.id === editingPageId);
        target = page?.sections.find((s) => s.id === id);
        if (page) page.sections = page.sections.filter((s) => s.id !== id);
        withPages(c, pages);
      }
      // Quitar widget solo si ya no hay ninguna sección de ese tipo en el sitio
      if (target) {
        const w = catalog.find((w) => w.sectionType === target!.type);
        if (w && !sectionTypeStillUsed(c, target.type, id)) {
          c.widgets = c.widgets.filter((x) => x.widgetId !== w.slug);
        }
      }
      return c;
    });
  }

  function hasWidget(slug: string) {
    return config.widgets.some((w) => w.widgetId === slug);
  }

  function toggleWidget(w: CatalogWidget) {
    update((c) => {
      if (c.widgets.some((x) => x.widgetId === w.slug)) {
        c.widgets = c.widgets.filter((x) => x.widgetId !== w.slug);
        // Quitar secciones de ese tipo en inicio y en páginas extra
        if (w.sectionType) {
          c.sections = c.sections.filter((s) => s.type !== w.sectionType);
          const pages = getExtraPages(c).map((p) => ({
            ...p,
            sections: p.sections.filter((s) => s.type !== w.sectionType),
          }));
          withPages(c, pages);
        }
      } else {
        c.widgets.push({ widgetId: w.slug, config: {} });
        // Al activar desde Widgets, la sección se agrega a la página de inicio
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

  /**
   * Agrega una sección a la página en edición.
   * - En inicio: widgets se activan y facturan (igual que antes).
   * - En página extra: la sección va en esa página; el widget se activa si aplica
   *   (factura una vez). custom y bases se incluyen en el precio de la página.
   */
  function addSection(type: SectionType) {
    const w = catalog.find((x) => x.sectionType === type);

    if (editingPageId === "home") {
      if (w && !hasWidget(w.slug)) {
        toggleWidget(w);
        return;
      }
      update((c) => {
        // custom / iframe se pueden repetir; el resto no si ya está
        if (!REPEATABLE_SECTIONS.has(type) && c.sections.some((s) => s.type === type)) return c;
        const maxOrder = Math.max(0, ...c.sections.map((s) => s.order));
        c.sections.push(makeSection(type, maxOrder + 1, c.business.name));
        return c;
      });
      return;
    }

    // Página adicional
    update((c) => {
      if (w && !c.widgets.some((x) => x.widgetId === w.slug)) {
        c.widgets.push({ widgetId: w.slug, config: {} });
      }
      const pages = getExtraPages(c);
      const page = pages.find((p) => p.id === editingPageId);
      if (!page) return c;
      if (!REPEATABLE_SECTIONS.has(type) && page.sections.some((s) => s.type === type)) return c;
      const maxOrder = Math.max(0, ...page.sections.map((s) => s.order));
      page.sections.push(makeSection(type, maxOrder + 1, c.business.name));
      withPages(c, pages);
      return c;
    });
  }

  /** Página adicional: no es toggle — la cantidad es el número de páginas definidas. */
  function setExtraPages(pages: ExtraPage[]) {
    update((c) => {
      withPages(c, pages);
      return c;
    });
    // Si se borró la página que se editaba, volver al inicio
    if (editingPageId !== "home" && !pages.some((p) => p.id === editingPageId)) {
      setEditingPageId("home");
    }
  }

  function updateExtraPage(pageIdToEdit: string, patch: Partial<ExtraPage>) {
    const pages = extraPages.map((p) => (p.id === pageIdToEdit ? { ...p, ...patch } : p));
    setExtraPages(pages);
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
    setSavedAt(new Date());
  }

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2500);
    });
  }

  const activeSections = isHome
    ? config.sections
    : activeExtraPage?.sections ?? [];
  const sorted = [...activeSections].sort((a, b) => a.order - b.order);

  return (
    <div className="app-surface flex h-screen flex-col bg-slate-100">
      {/* Barra superior */}
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-slate-900">{config.business.name}</span>
          <Badge tone="indigo">{template.name}</Badge>
          {status === "COMPLETED" && <Badge tone="slate">Pedido registrado</Badge>}
          {status === "PAID" && <Badge tone="green">Pagado</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {savedAt && !saving && <span className="text-xs text-slate-400">Guardado {savedAt.toLocaleTimeString()}</span>}
          {error && <span className="text-xs text-rose-600">{error}</span>}
          <Button variant="ghost" size="sm" onClick={copyLink}>
            {linkCopied ? "✓ Copiado" : "🔗 Copiar mi enlace"}
          </Button>
          <Link href={`/preview/${siteKey}`} target="_blank">
            <Button variant="outline" size="sm">
              Vista previa ↗
            </Button>
          </Link>
          {status === "PAID" ? (
            <a href={`/api/sites/${siteKey}/export`}>
              <Button variant="secondary" size="sm">
                Descargar .zip
              </Button>
            </a>
          ) : (
            <Button variant="secondary" size="sm" disabled title="La descarga del código se habilita cuando tu pago esté confirmado">
              🔒 Descargar .zip
            </Button>
          )}
          <PayButton siteKey={siteKey} lineItems={invoice.lineItems} total={invoice.total} status={status} onPaid={() => setStatus("COMPLETED")} />
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </header>

      {/* Aviso: la URL es la llave de acceso */}
      <div className="border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-center text-xs text-amber-800">
        ⚠️ Este enlace es tu llave de acceso al sitio: <b>guárdalo</b> (márcalo como favorito o cópialo). Cualquiera con el enlace puede editarlo.
      </div>

      <div className="flex min-h-0 flex-1">
        {/* Panel de edición */}
        <aside className="flex w-[380px] shrink-0 flex-col border-r border-slate-200 bg-white">
          <nav className="flex border-b border-slate-200 text-sm">
            {(["secciones", "widgets", "negocio"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2.5 font-medium capitalize transition-colors ${
                  tab === t ? "border-b-2 border-brand-navy text-brand-navy" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {tab === "negocio" && <BusinessEditor config={config} update={update} />}

            {tab === "secciones" && (
              <div className="space-y-3">
                {/* Selector de página: inicio o páginas adicionales */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <Label>Página a editar</Label>
                  <select
                    value={editingPageId}
                    onChange={(e) => setEditingPageId(e.target.value)}
                    className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                  >
                    <option value="home">Inicio (página principal)</option>
                    {extraPages.map((p, i) => (
                      <option key={p.id} value={p.id}>
                        {p.title.trim() || `Página extra ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  {extraPages.length === 0 && (
                    <p className="mt-1.5 text-[11px] text-slate-500">
                      Para crear páginas nuevas ve a <b>Widgets → Página adicional</b>.
                    </p>
                  )}
                </div>

                {!isHome && activeExtraPage && (
                  <div className="space-y-2 rounded-xl border border-brand-teal/40 bg-brand-teal/5 p-3">
                    <div>
                      <Label>Título de la página (menú y pestaña)</Label>
                      <Input
                        value={activeExtraPage.title}
                        onChange={(e) => updateExtraPage(activeExtraPage.id, { title: e.target.value })}
                        placeholder="Ej. Nosotros, Menú, Servicios…"
                      />
                    </div>
                    <div>
                      <Label>Texto introductorio (opcional)</Label>
                      <Textarea
                        rows={2}
                        value={activeExtraPage.content}
                        onChange={(e) => updateExtraPage(activeExtraPage.id, { content: e.target.value })}
                        placeholder="Párrafo libre al inicio de la página…"
                      />
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Debajo puedes armar la página con secciones de widgets o bloques <b>Personalizada</b>.
                    </p>
                  </div>
                )}

                {isHome && (
                  <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                    💡 Cada sección puede aparecer (o no) en el menú del header. <b>Consejo:</b> si agregas todas al menú
                    puede verse demasiado lleno y perder elegancia — elige las 3 o 4 más importantes.
                  </p>
                )}

                {sorted.length === 0 && !isHome && (
                  <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                    Esta página aún no tiene secciones. Agrega un widget (galería, mapa…) o un bloque personalizado.
                  </p>
                )}

                {sorted.map((section, i) => (
                  <SectionEditor
                    key={section.id}
                    section={section}
                    isFirst={i === 0}
                    isLast={i === sorted.length - 1}
                    canRemove={isHome ? !BASE_SECTIONS.has(section.type) || section.type !== "hero" : true}
                    showInMenuToggle={isHome}
                    onChange={(fn) => updateSection(section.id, fn)}
                    onMove={(dir) => moveSection(section.id, dir)}
                    onRemove={() => removeSection(section.id)}
                  />
                ))}
                <AddSectionControl
                  sections={activeSections}
                  catalog={catalog}
                  onAdd={addSection}
                  onExtraPage={!isHome}
                />
              </div>
            )}

            {tab === "widgets" && (
              <div className="space-y-3">
                {catalog
                  .filter((w) => w.slug !== "seccion-extra" && w.slug !== "pagina-adicional")
                  .map((w) => {
                    const active = hasWidget(w.slug);
                    return (
                      <div
                        key={w.slug}
                        className={`rounded-xl border p-4 transition-colors ${active ? "border-brand-blue bg-brand-teal/10" : "border-slate-200"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{w.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{w.description}</p>
                          </div>
                          <button
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
                  pages={extraPages}
                  onChange={setExtraPages}
                  onOpenPage={(id) => {
                    setEditingPageId(id);
                    setTab("secciones");
                  }}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Preview en vivo */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-200 p-4">
          {/* translateZ(0) hace que el botón fixed de WhatsApp quede contenido en el preview */}
          <div className="mx-auto min-h-full max-w-5xl overflow-hidden rounded-xl shadow-2xl" style={{ transform: "translateZ(0)" }}>
            <SiteRenderer
              config={config}
              templateConfig={templateConfig}
              previewPageId={editingPageId}
              onNavigatePage={setEditingPageId}
            />
          </div>
        </main>

        {/* Factura en tiempo real */}
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
 * Placeholder de pago: muestra el resumen y registra el pedido.
 * La pasarela real (Stripe) se conecta después en src/lib/payments.ts.
 */
function PayButton({
  siteKey,
  lineItems,
  total,
  status,
  onPaid,
}: {
  siteKey: string;
  lineItems: LineItem[];
  total: number;
  status: string;
  onPaid: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function confirm() {
    setLoading(true);
    await fetch(`/api/sites/${siteKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    setLoading(false);
    setOpen(false);
    onPaid();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-8 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
      >
        {status === "DRAFT" ? "Pagar" : "Ver mi pedido"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-slate-900">Resumen de tu pedido</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {lineItems.map((item, i) => (
                <li key={i} className="flex justify-between">
                  <span className="text-slate-600">
                    {item.label}
                    {item.qty > 1 ? ` ×${item.qty}` : ""}
                  </span>
                  <span className="font-medium">{formatMoney(item.subtotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-between border-t border-slate-200 pt-3">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-bold text-brand-navy">{formatMoney(total)}</span>
            </div>
            {status === "DRAFT" ? (
              <>
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-700">
                  🚧 La pasarela de pago (Stripe/PayPal) se integrará próximamente. Al confirmar, tu pedido queda registrado y
                  nos pondremos en contacto para el pago. Puedes seguir editando tu sitio.
                </p>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button className="flex-1" onClick={confirm} disabled={loading}>
                    {loading ? "Confirmando…" : "Confirmar pedido"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-4">
                <p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">
                  ✅ Tu pedido ya está registrado. Si sigues editando y cambia el total, el nuevo monto queda reflejado aquí.
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
  onExtraPage = false,
}: {
  sections: Section[];
  catalog: { slug: string; sectionType: string | null; price: number }[];
  onAdd: (type: SectionType) => void;
  /** En páginas extra: custom se puede repetir; el precio de widgets se factura 1 vez. */
  onExtraPage?: boolean;
}) {
  const [selected, setSelected] = useState("");
  const present = new Set(sections.map((s) => s.type));
  const available = (Object.keys(SECTION_LABELS) as SectionType[]).filter((t) => {
    if (REPEATABLE_SECTIONS.has(t)) return true; // personalizada e iframe se pueden repetir
    return !present.has(t);
  });
  if (available.length === 0) return null;

  const priceLabel = (t: SectionType) => {
    if (onExtraPage) {
      const w = catalog.find((x) => x.sectionType === t);
      if (w) return `widget +${formatMoney(w.price)}`;
      return "incluida en la página";
    }
    const w = catalog.find((x) => x.sectionType === t);
    if (w) return `+${formatMoney(w.price)}`;
    if (REPEATABLE_SECTIONS.has(t)) return "sección extra";
    return "incluida";
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
        {onExtraPage
          ? "Puedes combinar widgets (galería, mapa, contacto…) y bloques personalizados. Los widgets se cobran una sola vez en todo el sitio."
          : "Las secciones borradas se pueden volver a agregar aquí. Las de widget suman su precio; Personalizada cuenta como sección extra."}
      </p>
    </div>
  );
}

// --- Configuración de widgets ------------------------------------------------

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
        <Label>Nombre para tu dirección web</Label>
        <div className="flex items-center gap-1">
          <Input
            placeholder="mi-negocio"
            value={config.subdomain ?? ""}
            onChange={(e) => onConfig({ subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
          />
          <span className="text-xs text-slate-400">.sitiosexpress.mx</span>
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

/** Página adicional: se definen cuántas páginas hay; el contenido se arma en Secciones. */
function ExtraPagesCard({
  widget,
  pages,
  onChange,
  onOpenPage,
}: {
  widget?: { name: string; description: string; price: number };
  pages: ExtraPage[];
  onChange: (pages: ExtraPage[]) => void;
  onOpenPage?: (pageId: string) => void;
}) {
  if (!widget) return null;
  return (
    <div className={`rounded-xl border p-4 transition-colors ${pages.length > 0 ? "border-brand-blue bg-brand-teal/10" : "border-slate-200"}`}>
      <p className="text-sm font-semibold text-slate-900">{widget.name}</p>
      <p className="mt-0.5 text-xs text-slate-500">{widget.description}</p>
      <p className="mt-2 text-sm font-bold text-brand-navy">
        {formatMoney(widget.price)} <span className="font-normal text-slate-400">por página</span>
        {pages.length > 0 && (
          <span className="ml-2 text-slate-600">
            × {pages.length} = {formatMoney(widget.price * pages.length)}
          </span>
        )}
      </p>
      <p className="mt-2 rounded-lg bg-white/70 p-2 text-[11px] text-slate-600">
        Cada página puede armarse con <b>secciones de widgets</b> (galería, mapa, contacto…) y bloques{" "}
        <b>Personalizada</b>. Crea la página aquí y edítala en la pestaña <b>Secciones</b>.
      </p>

      <div className="mt-3 space-y-3">
        {pages.map((page, i) => (
          <div key={page.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-2">
              <Label className="mb-0">Página {i + 1}</Label>
              <div className="flex items-center gap-2">
                {onOpenPage && (
                  <button
                    type="button"
                    onClick={() => onOpenPage(page.id)}
                    className="text-xs font-medium text-brand-navy hover:underline"
                  >
                    Editar secciones →
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(pages.filter((p) => p.id !== page.id))}
                  className="text-xs text-rose-500 hover:underline"
                >
                  Quitar
                </button>
              </div>
            </div>
            <Input
              className="mt-2"
              placeholder="Título (ej. Nosotros, Menú, Contacto)"
              value={page.title}
              onChange={(e) =>
                onChange(pages.map((p) => (p.id === page.id ? { ...p, title: e.target.value } : p)))
              }
            />
            <p className="mt-1.5 text-[11px] text-slate-400">
              {page.sections.length === 0
                ? "Sin secciones aún"
                : `${page.sections.length} sección${page.sections.length === 1 ? "" : "es"}`}
              {page.content?.trim() ? " · con texto intro" : ""}
            </p>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const next: ExtraPage = { id: pageId(), title: "", content: "", sections: [] };
            onChange([...pages, next]);
            onOpenPage?.(next.id);
          }}
        >
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
  showInMenuToggle = true,
  onChange,
  onMove,
  onRemove,
}: {
  section: Section;
  isFirst: boolean;
  isLast: boolean;
  canRemove: boolean;
  showInMenuToggle?: boolean;
  onChange: (fn: (s: Section) => void) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const c = section.content;
  const setContent = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    onChange((s) => (s.content[k] = e.target.value));

  const label =
    section.type === "custom" && c.title
      ? `${SECTION_LABELS.custom}: ${String(c.title).slice(0, 28)}`
      : section.type === "iframe" && (c.title || c.url)
        ? `${SECTION_LABELS.iframe}: ${String(c.title || c.url).slice(0, 28)}`
        : SECTION_LABELS[section.type];

  return (
    <div className="rounded-xl border border-slate-200">
      <div className="flex items-center justify-between px-3 py-2.5">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 text-left text-sm font-medium text-slate-800">
          {open ? "▾" : "▸"} {label}
        </button>
        <div className="flex items-center gap-1 text-slate-400">
          <button onClick={() => onMove(-1)} disabled={isFirst} className="rounded px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-30" title="Subir">↑</button>
          <button onClick={() => onMove(1)} disabled={isLast} className="rounded px-1.5 py-0.5 hover:bg-slate-100 disabled:opacity-30" title="Bajar">↓</button>
          {canRemove && (section.type !== "hero" || !showInMenuToggle) && (
            <button onClick={onRemove} className="rounded px-1.5 py-0.5 text-rose-400 hover:bg-rose-50" title="Quitar">✕</button>
          )}
        </div>
      </div>

      {open && (
        <div className="space-y-3 border-t border-slate-100 p-3">
          {showInMenuToggle && (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={section.inMenu} onChange={(e) => onChange((s) => (s.inMenu = e.target.checked))} />
              Mostrar en el menú del header
            </label>
          )}
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
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Texto del botón</Label>
                  <Input value={c.ctaText ?? ""} onChange={setContent("ctaText")} placeholder="Vacío = sin botón" />
                </div>
                <div>
                  <Label>Enlace del botón</Label>
                  <Input value={c.ctaLink ?? ""} onChange={setContent("ctaLink")} placeholder="Vacío = abre tu WhatsApp" />
                </div>
              </div>
              <p className="text-[11px] text-slate-500">Si dejas el texto del botón vacío, no se muestra ningún botón de contacto.</p>
            </>
          )}
          {section.type === "about" && (
            <>
              <div><Label>Texto</Label><Textarea rows={4} value={c.text ?? ""} onChange={setContent("text")} /></div>
              <ImageField label="Imagen" value={c.imageUrl ?? ""} onUploaded={(url) => onChange((s) => (s.content.imageUrl = url))} />
            </>
          )}
          {section.type === "custom" && (
            <>
              <div>
                <Label>Texto</Label>
                <Textarea rows={5} value={c.text ?? ""} onChange={setContent("text")} />
              </div>
              <div>
                <Label>Diseño</Label>
                <select
                  value={c.layout ?? "text"}
                  onChange={(e) => onChange((s) => (s.content.layout = e.target.value))}
                  className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                >
                  <option value="text">Solo texto</option>
                  <option value="text-image">Texto + imagen a la derecha</option>
                  <option value="image-text">Imagen a la izquierda + texto</option>
                  <option value="centered">Centrado</option>
                </select>
              </div>
              {(c.layout === "text-image" || c.layout === "image-text") && (
                <ImageField label="Imagen" value={c.imageUrl ?? ""} onUploaded={(url) => onChange((s) => (s.content.imageUrl = url))} />
              )}
            </>
          )}
          {section.type === "iframe" && (
            <>
              <div>
                <Label>URL a embeber</Label>
                <Input
                  value={c.url ?? ""}
                  onChange={setContent("url")}
                  placeholder="https://… o pega el HTML del iframe"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Pega la URL del contenido (YouTube, formularios, calendarios, otra web que permita embed) o el código{" "}
                  <code className="rounded bg-slate-100 px-1">&lt;iframe src=&quot;…&quot;&gt;</code> completo. Solo con la URL se genera el iframe.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Alto ({Number(c.height ?? 480)}px)</Label>
                  <input
                    type="range"
                    min={200}
                    max={900}
                    step={20}
                    value={Number(c.height ?? 480)}
                    onChange={(e) => onChange((s) => (s.content.height = Number(e.target.value)))}
                    className="w-full"
                  />
                </div>
                <div>
                  <Label>Ancho</Label>
                  <select
                    value={c.width ?? "full"}
                    onChange={(e) => onChange((s) => (s.content.width = e.target.value))}
                    className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
                  >
                    <option value="full">Ancho completo</option>
                    <option value="narrow">Centrado (más estrecho)</option>
                  </select>
                </div>
              </div>
            </>
          )}
          {section.type === "map" && (
            <>
              <div>
                <Label>Dirección visible</Label>
                <Input value={c.address ?? ""} onChange={setContent("address")} placeholder="Ej. Av. Juárez 30, CDMX" />
              </div>
              <div>
                <Label>Enlace de Google Maps</Label>
                <Textarea
                  rows={3}
                  value={c.embedUrl ?? ""}
                  onChange={setContent("embedUrl")}
                  placeholder="Pega el enlace de Maps, coordenadas, o el HTML del iframe"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Funciona con: enlace largo de Maps (barra de direcciones), código de <b>Compartir → Insertar un mapa</b>,
                  coordenadas (<code className="rounded bg-slate-100 px-1">19.43,-99.13</code>) o solo la dirección.
                  No uses links cortos <code className="rounded bg-slate-100 px-1">maps.app.goo.gl</code>.
                </p>
              </div>
            </>
          )}
          {section.type === "contact" && (
            <div><Label>Subtítulo</Label><Input value={c.subtitle ?? ""} onChange={setContent("subtitle")} /></div>
          )}
          {section.type === "products" && (
            <div>
              <Label>Esquinas redondeadas ({Number(c.radius ?? 20)}px)</Label>
              <input
                type="range"
                min={0}
                max={40}
                value={Number(c.radius ?? 20)}
                onChange={(e) => onChange((s) => (s.content.radius = Number(e.target.value)))}
                className="w-full"
              />
            </div>
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
              <ImageField label="Imagen de fondo" value={section.style.background.value} onUploaded={(url) => onChange((s) => { s.style.background.value = url; s.style.background.overlay = s.style.background.overlay || "rgba(0,0,0,.5)"; })} />
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
              <Label>Tarjetas</Label>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <select
                  value={section.style.card.rounded}
                  onChange={(e) => onChange((s) => (s.style.card.rounded = e.target.value as any))}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2"
                >
                  <option value="none">Sin redondeo</option>
                  <option value="md">Redondeo suave</option>
                  <option value="xl">Redondeado</option>
                  <option value="full">Muy redondeado</option>
                </select>
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

type GalleryImg = { url: string; caption?: string; colSpan?: number; rowSpan?: number };

function GalleryEditor({ section, onChange }: { section: Section; onChange: (fn: (s: Section) => void) => void }) {
  const c = section.content;
  const cols = Math.min(10, Math.max(2, Number(c.columns) || 3));
  const images: GalleryImg[] = ((c.images as any[]) ?? [])
    .map((i) => (typeof i === "string" ? { url: i, colSpan: 1, rowSpan: 1 } : i))
    .filter((i) => i?.url);
  const max = 24;
  const set = (k: string, v: any) => onChange((s) => (s.content[k] = v));
  const setImages = (imgs: GalleryImg[]) => set("images", imgs);
  const patchImage = (i: number, patch: Partial<GalleryImg>) =>
    setImages(images.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Columnas de la grilla</Label>
          <select
            value={cols}
            onChange={(e) => set("columns", Number(e.target.value))}
            className="h-9 w-full rounded-md border border-slate-200 bg-white px-2 text-sm"
          >
            {Array.from({ length: 9 }, (_, i) => i + 2).map((n) => (
              <option key={n} value={n}>
                {n} columnas
              </option>
            ))}
          </select>
          <p className="mt-0.5 text-[11px] text-slate-400">Base del layout. Cada foto puede ocupar varias celdas.</p>
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

      <div>
        <Label>
          Ancho de la cuadrícula (
          {c.maxWidth === undefined ||
          c.maxWidth === null ||
          c.maxWidth === "" ||
          c.maxWidth === 0 ||
          c.maxWidth === "full" ||
          c.maxWidth === "0"
            ? "100%"
            : `${Number(c.maxWidth)}px`}
          )
        </Label>
        <input
          type="range"
          min={0}
          max={1400}
          step={20}
          value={
            c.maxWidth === undefined ||
            c.maxWidth === null ||
            c.maxWidth === "" ||
            c.maxWidth === 0 ||
            c.maxWidth === "full" ||
            c.maxWidth === "0"
              ? 0
              : Math.min(1400, Math.max(0, Number(c.maxWidth)))
          }
          onChange={(e) => set("maxWidth", Number(e.target.value))}
          className="w-full"
        />
        <p className="mt-0.5 text-[11px] text-slate-400">
          0 = todo el ancho disponible. Baja el valor (ej. 640–960) para una galería más compacta y centrada.
        </p>
      </div>

      <div>
        <Label>
          Tamaño máx. celda 1×1 (
          {Number(c.maxCell ?? 0) > 0 ? `${Number(c.maxCell)}px` : "sin límite"}
          )
        </Label>
        <input
          type="range"
          min={0}
          max={400}
          step={10}
          value={Math.min(400, Math.max(0, Number(c.maxCell ?? 0)))}
          onChange={(e) => set("maxCell", Number(e.target.value))}
          className="w-full"
        />
        <p className="mt-0.5 text-[11px] text-slate-400">
          0 = el ancho se reparte entre columnas. Con límite, la grilla se centra.
        </p>
      </div>

      <div>
        <Label>Alto de fila base ({Number(c.rowHeight ?? 160)}px)</Label>
        <input
          type="range"
          min={80}
          max={320}
          step={10}
          value={Math.min(320, Math.max(80, Number(c.rowHeight ?? 160)))}
          onChange={(e) => set("rowHeight", Number(e.target.value))}
          className="w-full"
        />
        <p className="mt-0.5 text-[11px] text-slate-400">
          Define la altura de una celda 1×1. Una foto de 2 filas mide el doble de alto.
        </p>
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
        <p className="mb-2 text-[11px] text-slate-500">
          En cada foto elige cuántas <b>columnas</b> (ancho) y <b>filas</b> (alto) ocupa en la grilla. Ej: 2×1 = panorámica; 1×2 = vertical alta; 2×2 = grande.
        </p>
        {images.length >= max ? (
          <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            Límite de {max} fotos. Quita una para agregar otra.
          </p>
        ) : (
          <ImageField
            label="Agregar foto"
            value=""
            onUploaded={(url) => setImages([...images, { url, caption: "", colSpan: 1, rowSpan: 1 }])}
          />
        )}
        <div className="mt-2 space-y-2">
          {images.map((img, i) => {
            const colSpan = Math.min(cols, Math.max(1, Number(img.colSpan) || 1));
            const rowSpan = Math.min(cols, Math.max(1, Number(img.rowSpan) || 1));
            return (
              <div key={i} className="rounded-lg border border-slate-200 bg-white p-2 space-y-2">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
                  <Input
                    placeholder="Texto de esta foto (opcional)"
                    value={img.caption ?? ""}
                    onChange={(e) => patchImage(i, { caption: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => setImages(images.filter((_, j) => j !== i))}
                    className="shrink-0 text-xs text-rose-500 hover:underline"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-[11px]">Ancho (columnas)</Label>
                    <select
                      value={colSpan}
                      onChange={(e) => patchImage(i, { colSpan: Number(e.target.value) })}
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      {Array.from({ length: cols }, (_, n) => n + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "columna" : "columnas"}
                          {n === cols ? " (todo el ancho)" : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-[11px]">Alto (filas)</Label>
                    <select
                      value={rowSpan}
                      onChange={(e) => patchImage(i, { rowSpan: Number(e.target.value) })}
                      className="h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs"
                    >
                      {Array.from({ length: cols }, (_, n) => n + 1).map((n) => (
                        <option key={n} value={n}>
                          {n} {n === 1 ? "fila" : "filas"}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400">
                  Ocupa <b>{colSpan}×{rowSpan}</b> celdas
                  {colSpan > 1 || rowSpan > 1 ? " · layout tipo bento" : ""}
                </p>
              </div>
            );
          })}
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
