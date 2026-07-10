import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SuperAdminDashboard } from "./dashboard";

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "SUPER_ADMIN") redirect("/login");

  const [templates, widgets, sites, conversations] = await Promise.all([
    prisma.template.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.widget.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.site.findMany({
      include: { template: { select: { name: true } }, invoice: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.whatsappConversation.findMany({ where: { siteId: { not: null } }, select: { siteId: true, phone: true } }),
  ]);

  const phoneBySite = new Map(conversations.map((c) => [c.siteId, c.phone]));

  return (
    <SuperAdminDashboard
      templates={templates.map((t) => ({ ...t, createdAt: t.createdAt.toISOString() })) as any}
      widgets={widgets.map((w) => ({ ...w, createdAt: w.createdAt.toISOString() })) as any}
      sites={sites.map((s) => {
        const config = s.config as any;
        const widgets: { widgetId?: string }[] = Array.isArray(config?.widgets) ? config.widgets : [];
        const widgetIds = new Set(widgets.map((w) => w.widgetId).filter(Boolean));
        // Montaje: con o sin dominio; "con dominio" = le ayudamos a publicar con dominio propio
        const montajeConDominio = widgetIds.has("montaje-con-dominio");
        const montajeSinDominio = widgetIds.has("montaje-sin-dominio");
        const montaje = montajeConDominio || montajeSinDominio;
        const waPhone = phoneBySite.get(s.id);
        const clientWhatsapp = String(config?.whatsapp?.number || config?.business?.phone || "").replace(/\D/g, "");
        const contact = waPhone
          ? `WhatsApp ${waPhone}`
          : config?.whatsapp?.number || config?.business?.email || "Web (sin contacto)";
        // Prefill URL si el cliente pidió Netlify con subdominio
        const montajeWidget = (Array.isArray(config?.widgets) ? config.widgets : []).find(
          (w: any) => w?.widgetId === "montaje-sin-dominio" || w?.widgetId === "montaje-con-dominio"
        );
        const sub = String(montajeWidget?.config?.subdomain ?? "").trim();
        const desiredDomain = String(montajeWidget?.config?.desiredDomain ?? "").trim();
        const suggestedUrl = montajeConDominio
          ? desiredDomain
            ? desiredDomain.startsWith("http")
              ? desiredDomain
              : `https://${desiredDomain}`
            : ""
          : sub
            ? `https://${sub}.netlify.app`
            : "";
        return {
          id: s.id,
          editKey: s.editKey,
          name: s.name,
          status: s.status,
          total: s.invoice?.total ?? 0,
          paid: s.invoice?.paidTotal ?? 0,
          owner: contact,
          template: s.template.name,
          updatedAt: s.updatedAt.toLocaleDateString("es-MX"),
          montaje,
          conDominio: montajeConDominio,
          clientWhatsapp,
          suggestedUrl,
        };
      })}
    />
  );
}
