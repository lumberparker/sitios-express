"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Card, Input, Label, Textarea } from "@/components/ui";
import { formatMoney } from "@/lib/utils";
import type { TemplateConfig } from "@/lib/site-config";

type TemplateOption = { id: string; name: string; description: string; basePrice: number; config: TemplateConfig };

const STEPS = ["Tu negocio", "Contacto y WhatsApp", "Elige tu template"] as const;

export function OnboardingWizard({ templates }: { templates: TemplateOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    businessName: "",
    tagline: "",
    logoUrl: "",
    faviconUrl: "",
    email: "",
    phone: "",
    address: "",
    whatsappNumber: "",
    whatsappMessage: "Hola, vi su sitio web y me gustaría más información.",
    templateId: "",
  });

  const set = (k: keyof typeof data) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setData((d) => ({ ...d, [k]: e.target.value }));

  async function uploadLogo(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/upload?favicon=1", { method: "POST", body: fd });
    if (!res.ok) {
      setError("No se pudo subir el logo.");
      return;
    }
    const json = await res.json();
    setData((d) => ({ ...d, logoUrl: json.url, faviconUrl: json.faviconUrl ?? "" }));
  }

  async function finish() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "No se pudo crear el sitio.");
      setLoading(false);
      return;
    }
    const { editKey } = await res.json();
    router.push(`/builder/${editKey}`);
  }

  return (
    <main className="app-surface min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">Configura tu sitio</h1>
          <span className="rounded-full bg-slate-200 px-3 py-1 text-xs text-slate-500" title="Muy pronto podrás llenar esto conversando con un asistente">
            💬 Modo chatbot · próximamente
          </span>
        </div>

        {/* Progreso */}
        <div className="mb-8 flex gap-2">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-brand-navy" : "bg-slate-300"}`} />
              <p className={`mt-2 text-xs ${i === step ? "font-semibold text-brand-navy" : "text-slate-400"}`}>{label}</p>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.25 }}>
            {step === 0 && (
              <Card className="space-y-4 p-8">
                <div>
                  <Label>Nombre del negocio *</Label>
                  <Input value={data.businessName} onChange={set("businessName")} placeholder="Ej. Café La Esquina" required />
                </div>
                <div>
                  <Label>Eslogan o descripción corta</Label>
                  <Input value={data.tagline} onChange={set("tagline")} placeholder="El mejor café de la colonia" />
                </div>
                <div>
                  <Label>Logo (genera tu favicon automáticamente)</Label>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                    className="block w-full text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-brand-teal/15 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-navy hover:file:bg-brand-teal/25"
                  />
                  {data.logoUrl && (
                    <div className="mt-3 flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={data.logoUrl} alt="logo" className="h-12 rounded" />
                      {data.faviconUrl && (
                        <span className="flex items-center gap-2 text-xs text-slate-500">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          Favicon: <img src={data.faviconUrl} alt="favicon" className="h-6 w-6 rounded" />
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            )}

            {step === 1 && (
              <Card className="space-y-4 p-8">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Correo de contacto</Label>
                    <Input type="email" value={data.email} onChange={set("email")} />
                  </div>
                  <div>
                    <Label>Teléfono</Label>
                    <Input value={data.phone} onChange={set("phone")} />
                  </div>
                </div>
                <div>
                  <Label>Dirección</Label>
                  <Input value={data.address} onChange={set("address")} placeholder="Calle, número, colonia, ciudad" />
                </div>
                <div className="rounded-xl bg-emerald-50 p-4">
                  <p className="mb-3 text-sm font-medium text-emerald-800">Botón flotante de WhatsApp (incluido)</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Número (con código de país, ej. 52155...)</Label>
                      <Input value={data.whatsappNumber} onChange={set("whatsappNumber")} placeholder="5215512345678" />
                    </div>
                    <div>
                      <Label>Mensaje predeterminado</Label>
                      <Textarea rows={2} value={data.whatsappMessage} onChange={set("whatsappMessage")} />
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {step === 2 && (
              <div className="grid gap-4 md:grid-cols-3">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setData((d) => ({ ...d, templateId: t.id }))}
                    className={`overflow-hidden rounded-2xl border-2 text-left transition-all hover:-translate-y-1 hover:shadow-lg ${
                      data.templateId === t.id ? "border-brand-navy ring-2 ring-brand-teal/40" : "border-transparent shadow"
                    }`}
                  >
                    <div
                      className="flex h-32 items-end p-4"
                      style={{
                        background: t.config.heroBackground.type === "image" ? `url(${t.config.heroBackground.value}) center/cover` : t.config.heroBackground.value,
                      }}
                    >
                      <span className="text-xl font-bold" style={{ fontFamily: `'${t.config.fonts.heading}', serif`, color: t.config.palette.text }}>
                        {t.name}
                      </span>
                    </div>
                    <div className="bg-white p-4">
                      <p className="text-xs text-slate-500">{t.description}</p>
                      <p className="mt-2 text-sm font-bold text-brand-navy">{formatMoney(t.basePrice)} base</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-4 text-sm text-rose-600">{error}</p>}

        <div className="mt-8 flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            ← Atrás
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={step === 0 && !data.businessName.trim()}>
              Siguiente →
            </Button>
          ) : (
            <Button onClick={finish} disabled={!data.templateId || loading}>
              {loading ? "Creando tu sitio…" : "Crear mi sitio 🚀"}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
