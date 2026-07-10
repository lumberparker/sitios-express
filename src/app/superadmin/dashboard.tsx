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
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
                  <th className="px-4 py-3">Sitio</th>
                  <th className="px-4 py-3">Contacto</th>
                  <th className="px-4 py-3">Template</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3 text-center" title="Montaje en línea (con o sin dominio)">
                    Montaje
                  </th>
                  <th className="px-4 py-3 text-center" title="Montaje con dominio propio: le ayudamos con el dominio">
                    Con dominio
                  </th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {sites.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{s.name}<div className="text-xs font-normal text-slate-400">{s.updatedAt}</div></td>
                    <td className="px-4 py-3 text-slate-600">{s.owner}</td>
                    <td className="px-4 py-3 text-slate-600">{s.template}</td>
                    <td className="px-4 py-3"><Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge></td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={s.montaje ? "green" : "slate"}>{s.montaje ? "Sí" : "No"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge tone={s.conDominio ? "indigo" : "slate"}>{s.conDominio ? "Sí" : "No"}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatMoney(s.total)}
                      {s.paid > 0 && s.total > s.paid && (
                        <div className="text-xs font-normal text-amber-600">
                          pagado {formatMoney(s.paid)} · saldo {formatMoney(s.total - s.paid)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <Link href={`/preview/${s.editKey}`} target="_blank" className="text-brand-blue hover:underline">Ver ↗</Link>
                      <Link href={`/builder/${s.editKey}`} target="_blank" className="ml-3 text-brand-blue hover:underline">Editar ↗</Link>
                      {s.status !== "PAID" ? (
                        <button
                          onClick={() => {
                            if (confirm(`¿Marcar “${s.name}” como PAGADO? Esto habilita la descarga del .zip para el cliente.`)) {
                              patch(`/api/superadmin/sites/${s.id}`, { status: "PAID" });
                            }
                          }}
                          className="ml-3 font-medium text-emerald-600 hover:underline"
                        >
                          Marcar pagado
                        </button>
                      ) : (
                        <button
                          onClick={() => patch(`/api/superadmin/sites/${s.id}`, { status: "COMPLETED" })}
                          className="ml-3 text-slate-400 hover:underline"
                          title="Regresar a Completado (deshabilita la descarga)"
                        >
                          Deshacer pago
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {sites.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">Aún no hay sitios creados.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
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
