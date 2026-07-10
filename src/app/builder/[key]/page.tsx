import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSiteByKey } from "@/lib/sites";
import { SiteConfigSchema, TemplateConfigSchema } from "@/lib/site-config";
import { BuilderClient } from "./builder-client";

// El acceso se autoriza por la editKey de la URL (clave secreta del dueño).
export default async function BuilderPage({ params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) notFound();

  const widgets = await prisma.widget.findMany({ where: { active: true }, orderBy: { price: "asc" } });

  // Número de soporte para el botón de WhatsApp post-pago de montaje
  const supportWhatsapp = (process.env.SUPPORT_WHATSAPP || process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || "")
    .replace(/\D/g, "");

  return (
    <BuilderClient
      siteKey={site.editKey}
      siteStatus={site.status}
      paidTotal={site.invoice?.paidTotal ?? 0}
      initialConfig={SiteConfigSchema.parse(site.config)}
      templateConfig={TemplateConfigSchema.parse(site.template.config)}
      template={{ name: site.template.name, basePrice: site.template.basePrice }}
      supportWhatsapp={supportWhatsapp}
      catalog={widgets.map((w) => ({
        slug: w.slug,
        name: w.name,
        description: w.description,
        price: w.price,
        sectionType: w.sectionType,
        icon: w.icon,
      }))}
    />
  );
}
