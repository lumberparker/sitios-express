"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Badge, Button, Card, Input, Label, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/utils";

type WidgetRow = { id: string; slug: string; name: string; description: string; sectionType: string | null; price: number; active: boolean };
type TemplateRow = { id: string; slug: string; name: string; description: string; basePrice: number; active: boolean; config: unknown };
type SiteRow = {
  id: string;
  editKey: string;
  name: string;
  status: string;
  total: number;
  paid: number;
  owner: string;
  template: string;
  updatedAt: string;
  /** Cliente pidió montaje (en línea o con dominio) */
  montaje: boolean;
  /** Montaje con dominio propio (le ayudamos con el dominio) */
  conDominio: boolean;
  /** WhatsApp del cliente (dígitos), si lo capturó al pagar */
  clientWhatsapp: string;
  /** URL sugerida (Netlify / dominio) */
  suggestedUrl: string;
};

const STATUS_TONE: Record<string, "amber" | "slate" | "green"> = { DRAFT: "amber", COMPLETED: "slate", PAID: "green" };
const STATUS_LABEL: Record<string, string> = { DRAFT: "Borrador", COMPLETED: "Completado", PAID: "Pagado" };

export function SuperAdminDashboard({ templates, widgets, sites }: { templates: TemplateRow[]; widgets: WidgetRow[]; sites: SiteRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"sitios" | "widgets" | "templates">("sitios");

  const potential = sites.filter((s) => s.status !== "PAID").reduce((a, s) => a + s.total, 0);
  const real = sites.filter((s) => s.status === "PAID").reduce((a, s) => a + s.total, 0);
  const issued = sites.filter((s) => s.status === "COMPLETED").reduce((a, s) => a + s.total, 0);

  async function patch(url: string, body: unknown) {
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) alert((await res.json().catch(() => ({}))).error ?? "Error al guardar");
    router.refresh();
  }

  return (
    <main className="app-surface min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold text-slate-900">Panel Super Admin</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await fetch("/api/superadmin/test-wapisimo");
                const data = await res.json().catch(() => ({}));
                if (!res.ok) {
                  alert(data.error ?? "No autorizado");
                  return;
                }
                if (!data.configured) {
                  alert(
                    `Wapisimo NO listo en este deploy:\n${data.reason ?? "sin detalle"}\n\n` +
                      `hasApiKey=${data.hasApiKey}\nphoneId=${data.phoneId ?? "—"}\n` +
                      `notifyTo=${data.notifyTo ?? "—"}\n\n` +
                      "En Vercel → Settings → Environment Variables agrega:\n" +
                      "WAPISIMO_API_KEY, WAPISIMO_PHONE_ID, ORDER_NOTIFY_WHATSAPP\n" +
                      "para Production, y haz Redeploy."
                  );
                  return;
                }
                if (!confirm(`¿Enviar mensaje de prueba a ${data.notifyTo}?`)) return;
                const send = await fetch("/api/superadmin/test-wapisimo", { method: "POST" });
                const body = await send.json().catch(() => ({}));
                alert(send.ok ? body.message ?? "Enviado" : body.error ?? "Error al enviar");
              }}
            >
              Probar WhatsApp
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
              Cerrar sesión
            </Button>
          </div>
        </div>

        {/* Reporte de ingresos */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <Card className="p-5">
            <p className="text-xs font-medium uppercase text-slate-400">Ingresos potenciales (borradores)</p>
            <p className="mt-1 text-2xl font-bold text-amber-600">{formatMoney(potential - issued)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium uppercase text-slate-400">Por cobrar (completados)</p>
            <p className="mt-1 text-2xl font-bold text-brand-navy">{formatMoney(issued)}</p>
          </Card>
          <Card className="p-5">
            <p className="text-xs font-medium uppercase text-slate-400">Ingresos reales (pagados)</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{formatMoney(real)}</p>
          </Card>
        </div>

        <nav className="mb-4 flex gap-1 rounded-xl bg-slate-200 p-1 text-sm">
          {(["sitios", "widgets", "templates"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 rounded-lg px-4 py-2 font-medium capitalize transition-colors ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
              {t} {t === "sitios" ? `(${sites.length})` : t === "widgets" ? `(${widgets.length})` : `(${templates.length})`}
            </button>
          ))}
        </nav>

        {tab === "sitios" && (
          <div className="space-y-4">
            {sites.map((s) => (
              <SiteCard key={s.id} site={s} onPatch={patch} />
            ))}
            {sites.length === 0 && (
              <Card className="px-4 py-8 text-center text-slate-400">Aún no hay sitios creados.</Card>
            )}
          </div>
        )}

        {tab === "widgets" && (
          <div className="space-y-4">
            {widgets.map((w) => (
              <WidgetEditor key={w.id} widget={w} onSave={(data) => patch(`/api/superadmin/widgets/${w.id}`, data)} />
            ))}
            <NewWidgetForm onCreated={() => router.refresh()} />
          </div>
        )}

        {tab === "templates" && (
          <div className="space-y-4">
            {templates.map((t) => (
              <TemplateEditor key={t.id} template={t} onSave={(data) => patch(`/api/superadmin/templates/${t.id}`, data)} />
            ))}
            <p className="text-xs text-slate-400">
              Para crear un template nuevo agrega su entrada en <code>prisma/seed.ts</code> (paleta, fuentes y fondo de hero) y corre{" "}
              <code>npm run db:seed</code>, o usa POST /api/superadmin/templates.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function SiteCard({
  site,
  onPatch,
}: {
  site: SiteRow;
  onPatch: (url: string, body: unknown) => Promise<void>;
}) {
  const [url, setUrl] = useState(site.suggestedUrl || "");
  const [sending, setSending] = useState(false);
  const [sentMsg, setSentMsg] = useState<string | null>(null);

  async function notifyReady() {
    const trimmed = url.trim();
    if (!trimmed) {
      alert("Escribe la URL del sitio (ej. https://mitienda.netlify.app)");
      return;
    }
    if (!site.clientWhatsapp) {
      alert(
        "Este sitio no tiene WhatsApp del cliente. Debe haberlo capturado al pagar, o agrégalo en el builder (Negocio)."
      );
      return;
    }
    if (!confirm(`¿Enviar al cliente (…${site.clientWhatsapp.slice(-4)})?\n\n"Tu sitio está listo en: ${trimmed}"`)) {
      return;
    }
    setSending(true);
    setSentMsg(null);
    try {
      const res = await fetch(`/api/superadmin/sites/${site.id}/notify-ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Error al enviar");
        return;
      }
      setSentMsg(data.message ?? "Mensaje enviado");
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-slate-900">{site.name}</h3>
            <Badge tone={STATUS_TONE[site.status] ?? "slate"}>{STATUS_LABEL[site.status] ?? site.status}</Badge>
            {site.montaje && (
              <Badge tone="amber">{site.conDominio ? "Montaje + dominio" : "Montaje Netlify"}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {site.template} · {site.owner} · {site.updatedAt}
          </p>
          <p className="mt-0.5 text-sm font-medium text-slate-700">
            Total {formatMoney(site.total)}
            {site.paid > 0 ? ` · Pagado ${formatMoney(site.paid)}` : ""}
          </p>
          {site.clientWhatsapp ? (
            <p className="mt-1 text-xs text-emerald-700">WhatsApp cliente: {site.clientWhatsapp}</p>
          ) : (
            <p className="mt-1 text-xs text-amber-600">Sin WhatsApp del cliente en el sitio</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/builder/${site.editKey}`}
            className="inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Abrir builder
          </Link>
          {site.status !== "PAID" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (confirm(`¿Marcar "${site.name}" como PAGADO?`)) {
                  void onPatch(`/api/superadmin/sites/${site.id}`, { status: "PAID" });
                }
              }}
            >
              Marcar pagado
            </Button>
          )}
        </div>
      </div>

      {/* Avisar sitio listo por WhatsApp */}
      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Sitio listo — avisar al cliente
        </Label>
        <p className="mt-1 text-xs text-slate-500">
          Se enviará: <span className="font-medium text-slate-700">Tu sitio está listo en: [URL]</span>
        </p>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Label htmlFor={`ready-url-${site.id}`}>URL del sitio</Label>
            <Input
              id={`ready-url-${site.id}`}
              type="url"
              placeholder="https://tusitio.netlify.app"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setSentMsg(null);
              }}
            />
          </div>
          <Button size="sm" disabled={sending || !url.trim()} onClick={() => void notifyReady()}>
            {sending ? "Enviando…" : "Avisar listo"}
          </Button>
        </div>
        {sentMsg && <p className="mt-2 text-xs font-medium text-emerald-600">{sentMsg}</p>}
      </div>
    </Card>
  );
}

function WidgetEditor({ widget, onSave }: { widget: WidgetRow; onSave: (data: Partial<WidgetRow>) => void }) {
  const [price, setPrice] = useState(String(widget.price));
  const [name, setName] = useState(widget.name);
  const [description, setDescription] = useState(widget.description);

  return (
    <Card className="flex flex-wrap items-end gap-3 p-4">
      <div className="min-w-40 flex-1">
        <Label>Nombre</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="min-w-64 flex-[2]">
        <Label>Descripción</Label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="w-28">
        <Label>Precio (MXN)</Label>
        <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <label className="flex h-10 items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={widget.active} onChange={(e) => onSave({ active: e.target.checked })} /> Activo
      </label>
      <Button size="sm" onClick={() => onSave({ name, description, price: Number(price) || 0 })}>Guardar</Button>
    </Card>
  );
}

function NewWidgetForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", description: "", price: "0", sectionType: "" });

  async function create() {
    const res = await fetch("/api/superadmin/widgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, price: Number(form.price) || 0, sectionType: form.sectionType || null }),
    });
    if (!res.ok) {
      alert((await res.json().catch(() => ({}))).error ?? "Error");
      return;
    }
    setOpen(false);
    setForm({ slug: "", name: "", description: "", price: "0", sectionType: "" });
    onCreated();
  }

  if (!open) return <Button variant="outline" onClick={() => setOpen(true)}>+ Nuevo widget</Button>;
  return (
    <Card className="space-y-3 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Slug (ej. video-fondo)</Label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div><Label>Nombre</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Precio (MXN)</Label><Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></div>
        <div>
          <Label>Tipo de sección que agrega (opcional)</Label>
          <select value={form.sectionType} onChange={(e) => setForm({ ...form, sectionType: e.target.value })} className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
            <option value="">Ninguna (solo cargo)</option>
            {["testimonials", "gallery", "map", "faq", "contact", "quote"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>
      <div><Label>Descripción</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
      <div className="flex gap-2">
        <Button size="sm" onClick={create}>Crear</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </Card>
  );
}

function TemplateEditor({ template, onSave }: { template: TemplateRow; onSave: (data: any) => void }) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description);
  const [basePrice, setBasePrice] = useState(String(template.basePrice));
  const [showConfig, setShowConfig] = useState(false);
  const [configText, setConfigText] = useState(JSON.stringify(template.config, null, 2));

  function save() {
    let config: unknown;
    if (showConfig) {
      try {
        config = JSON.parse(configText);
      } catch {
        alert("El JSON del config no es válido.");
        return;
      }
    }
    onSave({ name, description, basePrice: Number(basePrice) || 0, ...(config ? { config } : {}) });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-40 flex-1"><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="min-w-64 flex-[2]"><Label>Descripción</Label><Input value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="w-32"><Label>Precio base</Label><Input type="number" min={0} value={basePrice} onChange={(e) => setBasePrice(e.target.value)} /></div>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" checked={template.active} onChange={(e) => onSave({ active: e.target.checked })} /> Activo
        </label>
        <Button size="sm" onClick={save}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setShowConfig((v) => !v)}>{showConfig ? "Ocultar config" : "Editar config (paleta/fuentes)"}</Button>
      </div>
      {showConfig && <Textarea className="mt-3 font-mono text-xs" rows={14} value={configText} onChange={(e) => setConfigText(e.target.value)} />}
    </Card>
  );
}
