import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { buildInitialConfig } from "@/lib/site-config";
import { computeInvoice } from "@/lib/pricing";

export type OnboardingInput = {
  templateId: string;
  businessName: string;
  tagline?: string;
  logoUrl?: string;
  faviconUrl?: string;
  email?: string;
  phone?: string;
  address?: string;
  whatsappNumber?: string;
  whatsappMessage?: string;
};

/**
 * Crea un sitio con su config inicial, factura y primera versión.
 * No requiere cuenta: la editKey (URL secreta /builder/<editKey>) es la
 * llave de acceso del dueño para editar, pagar y (ya pagado) descargar.
 */
export async function createOnboardedSite(input: OnboardingInput) {
  const template = await prisma.template.findUnique({ where: { id: input.templateId } });
  if (!template || !template.active) throw new Error("Template no disponible");

  const config = buildInitialConfig(input);
  const catalog = await prisma.widget.findMany({ where: { active: true } });
  const invoice = computeInvoice(config, template, catalog);

  return prisma.site.create({
    data: {
      name: input.businessName,
      editKey: crypto.randomBytes(24).toString("base64url"),
      templateId: template.id,
      config,
      invoice: { create: { lineItems: invoice.lineItems, total: invoice.total } },
      versions: { create: { config } },
    },
  });
}

/** Busca un sitio por su editKey (la posesión de la clave autoriza). */
export async function getSiteByKey(editKey: string) {
  return prisma.site.findUnique({ where: { editKey }, include: { template: true, invoice: true } });
}
