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
        const waPhone = phoneBySite.get(s.id);
        const contact = waPhone
          ? `WhatsApp ${waPhone}`
          : config?.business?.email || config?.whatsapp?.number || "Web (sin contacto)";
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
        };
      })}
    />
  );
}
