import { z } from "zod";

// ---------------------------------------------------------------------------
// SiteConfig: la fuente de verdad de cada sitio. Se guarda en Site.config
// (JSONB). El preview en vivo y el exportador estático renderizan SOLO a
// partir de este documento.
// ---------------------------------------------------------------------------

export const BackgroundSchema = z.object({
  type: z.enum(["solid", "gradient", "image"]),
  // solid: "#0f172a" | gradient: "linear-gradient(...)" | image: url
  value: z.string().default(""),
  // Overlay rgba sobre imágenes para garantizar contraste
  overlay: z.string().optional(),
});

export const SectionStyleSchema = z.object({
  background: BackgroundSchema.default({ type: "solid", value: "" }),
  textColor: z.string().default(""),
  accentColor: z.string().default(""),
  card: z
    .object({
      // Legado: presets. Si "radius" (px) está definido, tiene prioridad.
      rounded: z.enum(["none", "md", "xl", "full"]).default("xl"),
      radius: z.number().min(0).max(48).optional(),
      shadow: z.boolean().default(true),
      border: z.boolean().default(false),
    })
    .default({ rounded: "xl", shadow: true, border: false }),
});

export const SectionTypeSchema = z.enum([
  "hero",
  "about",
  "products",
  "testimonials",
  "gallery",
  "carousel",
  "map",
  "faq",
  "contact",
  "quote",
]);
export type SectionType = z.infer<typeof SectionTypeSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  type: SectionTypeSchema,
  order: z.number().int(),
  // Si la sección aparece como enlace en el menú del header
  inMenu: z.boolean().default(true),
  style: SectionStyleSchema.default({}),
  // Contenido por tipo (title/subtitle/items/...). Se mantiene flexible;
  // cada renderer lee las llaves que le corresponden con defaults seguros.
  content: z.record(z.string(), z.any()).default({}),
});
export type Section = z.infer<typeof SectionSchema>;

export const SiteConfigSchema = z.object({
  version: z.literal(1).default(1),
  templateId: z.string(),
  business: z.object({
    name: z.string().min(1),
    // Mostrar el nombre junto al logo en el header (si no hay logo, el
    // nombre se muestra siempre)
    showNameInHeader: z.boolean().default(true),
    tagline: z.string().default(""),
    logoUrl: z.string().default(""),
    faviconUrl: z.string().default(""),
    email: z.string().default(""),
    phone: z.string().default(""),
    address: z.string().default(""),
  }),
  whatsapp: z.object({
    enabled: z.boolean().default(true),
    number: z.string().default(""),
    defaultMessage: z.string().default("Hola, vi su sitio web y me gustaría más información."),
  }),
  social: z.object({
    instagram: z.string().default(""),
    facebook: z.string().default(""),
    tiktok: z.string().default(""),
    x: z.string().default(""),
  }),
  // Tipografía elegida por el usuario (vacío = usar la del template).
  // fontEmbedUrl permite pegar la URL del embed de Google Fonts.
  theme: z
    .object({
      fontHeading: z.string().default(""),
      fontBody: z.string().default(""),
      fontEmbedUrl: z.string().default(""),
    })
    .default({ fontHeading: "", fontBody: "", fontEmbedUrl: "" }),
  sections: z.array(SectionSchema),
  // Widgets con precio agregados al sitio (facturan). Los widgets con
  // sectionType además insertan/activan su sección correspondiente.
  widgets: z.array(
    z.object({
      widgetId: z.string(), // slug del Widget
      config: z.record(z.string(), z.any()).default({}),
    })
  ),
});
export type SiteConfig = z.infer<typeof SiteConfigSchema>;

// Config de template (Template.config en DB)
export const TemplateConfigSchema = z.object({
  palette: z.object({
    primary: z.string(),
    secondary: z.string(),
    background: z.string(),
    surface: z.string(),
    text: z.string(),
    muted: z.string(),
  }),
  fonts: z.object({
    heading: z.string(), // nombre Google Font
    body: z.string(),
    googleUrl: z.string(),
  }),
  heroBackground: BackgroundSchema,
  dark: z.boolean().default(false),
});
export type TemplateConfig = z.infer<typeof TemplateConfigSchema>;

/** Radio en px de las tarjetas de una sección (slider nuevo o preset legado). */
export function cardRadiusPx(card: { rounded: string; radius?: number }): number {
  if (typeof card.radius === "number") return card.radius;
  return { none: 0, md: 10, xl: 20, full: 32 }[card.rounded] ?? 20;
}

let counter = 0;
export function sectionId(type: string) {
  counter += 1;
  return `${type}_${Date.now().toString(36)}${counter}`;
}

export const SECTION_LABELS: Record<SectionType, string> = {
  hero: "Hero",
  about: "Acerca de nosotros",
  products: "Productos / Servicios",
  testimonials: "Testimonios",
  gallery: "Galería",
  carousel: "Carrusel de imágenes",
  map: "Mapa / Ubicación",
  faq: "Preguntas frecuentes",
  contact: "Formulario de contacto",
  quote: "Calculadora de cotización",
};

/**
 * URL de chat de WhatsApp del negocio (wa.me).
 * Usa whatsapp.number; si no hay, el teléfono del negocio.
 */
export function businessWhatsAppUrl(config: SiteConfig): string | null {
  const raw = (config.whatsapp.number || config.business.phone || "").trim();
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const message =
    config.whatsapp.defaultMessage?.trim() ||
    "Hola, vi su sitio web y me gustaría más información.";
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Enlace del CTA del hero. Por defecto (vacío, "#", "#contacto", etc.)
 * abre una conversación de WhatsApp con el número del negocio.
 * Solo se usa un enlace custom si el usuario escribió uno distinto.
 */
export function resolveCtaLink(ctaLink: string | undefined, config: SiteConfig): string {
  const link = (ctaLink ?? "").trim();
  const normalized = link.toLowerCase();
  const isDefault =
    !link ||
    normalized === "#" ||
    normalized === "#contacto" ||
    normalized === "#contact" ||
    normalized === "/#contacto" ||
    normalized === "/#contact" ||
    normalized === "whatsapp" ||
    normalized === "wa";
  if (isDefault) {
    return businessWhatsAppUrl(config) ?? (link || "#");
  }
  return link;
}

/** Tipografía efectiva: overrides del usuario o la del template. */
export function effectiveFonts(config: SiteConfig, tpl: TemplateConfig): TemplateConfig["fonts"] {
  const t = config.theme ?? { fontHeading: "", fontBody: "", fontEmbedUrl: "" };
  if (!t.fontHeading.trim() && !t.fontBody.trim() && !t.fontEmbedUrl.trim()) return tpl.fonts;
  const heading = t.fontHeading.trim() || tpl.fonts.heading;
  const body = t.fontBody.trim() || tpl.fonts.body;
  const googleUrl =
    t.fontEmbedUrl.trim() ||
    `https://fonts.googleapis.com/css2?family=${heading.replace(/ /g, "+")}:wght@400;700&family=${body.replace(/ /g, "+")}:wght@400;500;600&display=swap`;
  return { heading, body, googleUrl };
}

export function defaultSectionContent(type: SectionType, businessName = ""): Record<string, any> {
  switch (type) {
    case "hero":
      return {
        title: businessName || "Tu negocio, en grande",
        subtitle: "Cuéntale al mundo qué haces y por qué eres la mejor opción.",
        ctaText: "Contáctanos",
        // Vacío = el botón abre WhatsApp con el número del negocio (ver resolveCtaLink)
        ctaLink: "",
      };
    case "about":
      return {
        title: "Acerca de nosotros",
        text: "Somos un equipo apasionado por lo que hacemos. Aquí va la historia de tu negocio.",
        imageUrl: "",
      };
    case "products":
      return {
        title: "Productos y servicios",
        items: [
          { name: "Producto estrella", description: "Descripción breve del producto.", price: "", imageUrl: "" },
          { name: "Servicio destacado", description: "Descripción breve del servicio.", price: "", imageUrl: "" },
          { name: "Otro más", description: "Descripción breve.", price: "", imageUrl: "" },
        ],
      };
    case "testimonials":
      return {
        title: "Lo que dicen nuestros clientes",
        items: [
          { name: "Cliente feliz", text: "Excelente servicio, 100% recomendado.", role: "" },
          { name: "Otra clienta", text: "La mejor decisión que tomamos este año.", role: "" },
        ],
      };
    case "gallery":
      // images: [{ url, caption }] — se limita a columns² fotos (grid N×N)
      return {
        title: "Galería",
        images: [],
        columns: 3,
        gapX: 12,
        gapY: 12,
        borderWidth: 0,
        borderColor: "#ffffff",
        radius: 16,
        hoverEffect: "zoom", // none | zoom | lift | gray | dark
        captionMode: "hover", // none | hover | always
      };
    case "carousel":
      // Carrusel automático: images [{ url, caption }], interval en segundos
      return { title: "", images: [], interval: 4, height: 400, radius: 16 };
    case "map":
      return { title: "Encuéntranos", address: "", embedUrl: "" };
    case "faq":
      return {
        title: "Preguntas frecuentes",
        items: [
          { q: "¿Cuál es el horario de atención?", a: "Lunes a viernes de 9:00 a 18:00." },
          { q: "¿Hacen envíos?", a: "Sí, a todo el país." },
        ],
      };
    case "contact":
      return { title: "Contáctanos", subtitle: "Te respondemos en menos de 24 horas." };
    case "quote":
      return {
        title: "Cotiza en línea",
        basePrice: 100,
        options: [
          { label: "Opción A", price: 50 },
          { label: "Opción B", price: 80 },
        ],
      };
  }
}

export function makeSection(type: SectionType, order: number, businessName = ""): Section {
  return {
    id: sectionId(type),
    type,
    order,
    // El hero es el inicio de la página: fuera del menú por defecto
    inMenu: type !== "hero",
    style: SectionStyleSchema.parse({}),
    content: defaultSectionContent(type, businessName),
  };
}

/** Config inicial al terminar el onboarding (secciones base incluidas en el precio del template). */
export function buildInitialConfig(input: {
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
}): SiteConfig {
  return SiteConfigSchema.parse({
    version: 1,
    templateId: input.templateId,
    business: {
      name: input.businessName,
      tagline: input.tagline ?? "",
      logoUrl: input.logoUrl ?? "",
      faviconUrl: input.faviconUrl ?? "",
      email: input.email ?? "",
      phone: input.phone ?? "",
      address: input.address ?? "",
    },
    whatsapp: {
      enabled: Boolean(input.whatsappNumber),
      number: input.whatsappNumber ?? "",
      defaultMessage: input.whatsappMessage || "Hola, vi su sitio web y me gustaría más información.",
    },
    social: { instagram: "", facebook: "", tiktok: "", x: "" },
    sections: [
      makeSection("hero", 1, input.businessName),
      makeSection("about", 2),
      makeSection("products", 3),
    ],
    widgets: [],
  });
}
