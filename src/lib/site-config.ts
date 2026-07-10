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
      rounded: z.enum(["none", "md", "xl", "full"]).default("xl"),
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
  // Bloque libre: título + texto + imagen opcional (secciones personalizadas)
  "custom",
  // Embed genérico: el usuario pega una URL (o HTML de iframe) y se muestra embebido
  "iframe",
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
  custom: "Personalizada",
  iframe: "Iframe / Embed",
};

/** Secciones que se pueden repetir en la misma página. */
export const REPEATABLE_SECTIONS = new Set<SectionType>(["custom", "iframe"]);

/** Página extra (widget pagina-adicional): título + secciones propias + texto libre opcional. */
export type ExtraPage = {
  id: string;
  title: string;
  /** Texto libre introductorio (compat con páginas viejas solo-texto). */
  content: string;
  sections: Section[];
};

export function pageId() {
  return sectionId("page");
}

/** Normaliza páginas del widget (formato viejo {title,content} o nuevo con sections). */
export function normalizeExtraPages(raw: unknown): ExtraPage[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p: any, i: number) => {
    const sections: Section[] = Array.isArray(p?.sections)
      ? p.sections.map((s: unknown, j: number) => {
          try {
            return SectionSchema.parse(s);
          } catch {
            return makeSection("custom", j + 1);
          }
        })
      : [];
    return {
      // id estable: si falta (páginas viejas), page_0, page_1… hasta que se guarde
      id: typeof p?.id === "string" && p.id ? p.id : `page_${i}`,
      title: String(p?.title ?? ""),
      content: String(p?.content ?? ""),
      sections,
    };
  });
}

export function getExtraPages(config: SiteConfig): ExtraPage[] {
  const entry = config.widgets.find((w) => w.widgetId === "pagina-adicional");
  return normalizeExtraPages(entry?.config?.pages);
}

/** Todas las secciones del sitio (inicio + páginas extra), para facturación y limpieza. */
export function allSiteSections(config: SiteConfig): Section[] {
  return [...config.sections, ...getExtraPages(config).flatMap((p) => p.sections)];
}

/**
 * Normaliza lo que el usuario pegue en una sección iframe:
 * URL directa, o HTML `<iframe src="...">` completo.
 * También convierte YouTube/Vimeo watch → embed cuando es posible.
 */
export function normalizeIframeSrc(raw: string | undefined | null): string {
  const input = String(raw ?? "").trim();
  if (!input) return "";

  // Pegaron el HTML del iframe
  const iframeSrc = input.match(/src=["']([^"']+)["']/i)?.[1];
  let url = (iframeSrc || input).trim().replace(/&amp;/g, "&");

  // Protocolo relativo //example.com → https:
  if (url.startsWith("//")) url = `https:${url}`;

  // Sin protocolo: asumir https
  if (!/^https?:\/\//i.test(url) && !url.startsWith("about:")) {
    url = `https://${url}`;
  }

  try {
    const u = new URL(url);

    // YouTube: watch?v= / youtu.be / shorts → embed
    if (/(?:www\.)?youtube\.com$/i.test(u.hostname) || /(?:www\.)?youtube-nocookie\.com$/i.test(u.hostname)) {
      const v = u.searchParams.get("v");
      if (v) return `https://www.youtube.com/embed/${v}`;
      const shorts = u.pathname.match(/\/shorts\/([\w-]+)/);
      if (shorts) return `https://www.youtube.com/embed/${shorts[1]}`;
      const embed = u.pathname.match(/\/embed\/([\w-]+)/);
      if (embed) return `https://www.youtube.com/embed/${embed[1]}${u.search}`;
    }
    if (/^(?:www\.)?youtu\.be$/i.test(u.hostname)) {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id) return `https://www.youtube.com/embed/${id}`;
    }

    // Vimeo
    if (/(?:www\.)?vimeo\.com$/i.test(u.hostname)) {
      const id = u.pathname.match(/\/(\d+)/)?.[1];
      if (id && !u.pathname.includes("/video/")) return `https://player.vimeo.com/video/${id}`;
    }

    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Convierte lo que el usuario pegue (enlace de Maps, share, o HTML de iframe)
 * en una URL válida para <iframe src>. Los links normales de Google Maps
 * no se pueden embeber tal cual (X-Frame-Options) y el iframe queda en blanco.
 */
export function normalizeMapEmbedUrl(raw: string | undefined | null): string {
  const input = String(raw ?? "").trim();
  if (!input) return "";

  // 1) Pegaron el HTML completo del iframe de "Compartir → Insertar un mapa"
  const iframeSrc = input.match(/src=["']([^"']+)["']/i)?.[1];
  let url = (iframeSrc || input).trim();

  // Decodificar entidades por si viene de un copy-paste raro
  url = url.replace(/&amp;/g, "&");

  // 2) Ya es una URL de embed → listo
  if (/google\.[^/]+\/maps\/embed/i.test(url) || /maps\.google\.[^/]+\/maps\?.*output=embed/i.test(url)) {
    return url;
  }

  // 3) Coordenadas en el path: /@19.4326,-99.1332,17z
  const atCoords = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)(?:,(\d+\.?\d*)z)?/);
  if (atCoords) {
    const [, lat, lng, zoom] = atCoords;
    const z = zoom ? Math.round(Number(zoom)) : 15;
    return `https://maps.google.com/maps?q=${lat},${lng}&z=${z}&output=embed&hl=es`;
  }

  // 4) ?q= / query= / ll= lat,lng
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const q = u.searchParams.get("q") || u.searchParams.get("query");
    if (q) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed&hl=es`;
    }
    const ll = u.searchParams.get("ll");
    if (ll) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(ll)}&z=15&output=embed&hl=es`;
    }
    // /place/Nombre+Del+Lugar/
    const place = u.pathname.match(/\/place\/([^/]+)/);
    if (place?.[1]) {
      const name = decodeURIComponent(place[1].replace(/\+/g, " "));
      return `https://maps.google.com/maps?q=${encodeURIComponent(name)}&z=15&output=embed&hl=es`;
    }
    // /search/consulta
    const search = u.pathname.match(/\/search\/([^/]+)/);
    if (search?.[1]) {
      const name = decodeURIComponent(search[1].replace(/\+/g, " "));
      return `https://maps.google.com/maps?q=${encodeURIComponent(name)}&z=15&output=embed&hl=es`;
    }
  } catch {
    // no es URL parseable
  }

  // 5) Texto libre (dirección escrita a mano)
  if (!/^https?:\/\//i.test(input) && !input.includes("<iframe")) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(input)}&z=15&output=embed&hl=es`;
  }

  // 6) Enlaces cortos (maps.app.goo.gl / goo.gl) no se pueden expandir aquí.
  //    Devolvemos vacío para que el UI pida el enlace completo o la dirección.
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) {
    return "";
  }

  // 7) Último recurso: usar la URL completa como query (share links largos de Google)
  if (/google\.[^/]+\/maps/i.test(url) || /maps\.google\./i.test(url)) {
    return `https://maps.google.com/maps?q=${encodeURIComponent(url)}&z=15&output=embed&hl=es`;
  }

  return `https://maps.google.com/maps?q=${encodeURIComponent(input)}&z=15&output=embed&hl=es`;
}

/**
 * Enlace del CTA del hero. Si el usuario no puso uno (o quedó el default
 * viejo "#contacto"), abre WhatsApp con el número del negocio.
 */
export function resolveCtaLink(ctaLink: string | undefined, config: SiteConfig): string {
  const link = (ctaLink ?? "").trim();
  const isDefault = !link || link === "#" || link === "#contacto";
  if (isDefault && config.whatsapp.number) {
    return `https://wa.me/${config.whatsapp.number.replace(/\D/g, "")}?text=${encodeURIComponent(config.whatsapp.defaultMessage)}`;
  }
  return link || "#";
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
        // Sin botón por defecto; el usuario puede agregar uno en el builder
        ctaText: "",
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
        // Radio de esquinas de las tarjetas (px). Si no viene, se usa style.card.rounded.
        radius: 20,
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
    case "custom":
      return {
        title: "Sección personalizada",
        text: "Escribe aquí el contenido que quieras mostrar. Puedes usar varios bloques personalizados en la misma página.",
        imageUrl: "",
        // layout: text | text-image | image-text | centered
        layout: "text",
      };
    case "iframe":
      return {
        title: "",
        // URL o HTML <iframe src="..."> — se normaliza al renderizar
        url: "",
        height: 480,
        // full = ancho completo del sitio; narrow = columna centrada
        width: "full", // full | narrow
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
