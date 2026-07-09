"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Input, Label, Textarea, Badge } from "@/components/ui";
import { SiteRenderer } from "@/components/site/SiteRenderer";
import { computeInvoice, BASE_SECTIONS, type LineItem } from "@/lib/pricing";
import { formatMoney } from "@/lib/utils";
import {
  makeSection,
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
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);

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

  function toggleWidget(w: CatalogWidget) {
    update((c) => {
      if (c.widgets.some((x) => x.widgetId === w.slug)) {
        c.widgets = c.widgets.filter((x) => x.widgetId !== w.slug);
        if (w.sectionType) c.sections = c.sections.filter((s) => s.type !== w.sectionType);
      } else {
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
                <p className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                  💡 Cada sección puede aparecer (o no) en el menú del header. <b>Consejo:</b> si agregas todas al menú
                  puede verse demasiado lleno y perder elegancia — elige las 3 o 4 más importantes.
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
                <p className="pt-2 text-xs text-slate-400">
                  Para agregar secciones nuevas (galería, FAQ, mapa…) usa la pestaña <b>Widgets</b>: cada una muestra su precio.
                </p>
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
                  pages={(widgetConfig("pagina-adicional").pages as ExtraPage[]) ?? []}
                  onChange={setExtraPages}
                />
              </div>
            )}
          </div>
        </aside>

        {/* Preview en vivo */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-slate-200 p-4">
          {/* translateZ(0) hace que el botón fixed de WhatsApp quede contenido en el preview */}
          <div className="mx-auto min-h-full max-w-5xl overflow-hidden rounded-xl shadow-2xl" style={{ transform: "translateZ(0)" }}>
            <SiteRenderer config={config} templateConfig={templateConfig} />
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
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Texto del botón</Label><Input value={c.ctaText ?? ""} onChange={setContent("ctaText")} /></div>
                <div><Label>Enlace del botón</Label><Input value={c.ctaLink ?? ""} onChange={setContent("ctaLink")} /></div>
              </div>
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
          {section.type === "gallery" && (
            <GalleryEditor images={c.images ?? []} onChange={(imgs) => onChange((s) => (s.content.images = imgs))} />
          )}

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

function GalleryEditor({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  return (
    <div>
      <ImageField label="Agregar foto" value="" onUploaded={(url) => onChange([...images, url])} />
      <div className="mt-2 grid grid-cols-4 gap-2">
        {images.map((url, i) => (
          <div key={i} className="group relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="aspect-square w-full rounded object-cover" />
            <button
              onClick={() => onChange(images.filter((_, j) => j !== i))}
              className="absolute right-0.5 top-0.5 hidden rounded bg-black/60 px-1 text-xs text-white group-hover:block"
            >
              ✕
            </button>
          </div>
        ))}
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
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload?favicon=1", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      const json = await res.json();
      onUploaded(json.url, json.faviconUrl);
    }
  }
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <Label>Logo del negocio {uploading && <span className="text-brand-blue">(subiendo…)</span>}</Label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-brand-teal/20 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-navy"
      />
      <p className="mt-1 text-xs text-slate-400">Al subir el logo, el favicon (ícono de la pestaña) se genera solo.</p>
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

function ImageField({ label, value, onUploaded }: { label: string; value: string; onUploaded: (url: string) => void }) {
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) onUploaded((await res.json()).url);
  }
  return (
    <div>
      <Label>{label} {uploading && <span className="text-brand-blue">(subiendo…)</span>}</Label>
      <input
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        className="block w-full text-xs text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-brand-teal/15 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-navy"
      />
      {value && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="mt-2 h-16 rounded object-cover" />
      )}
    </div>
  );
}
