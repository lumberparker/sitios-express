import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const templates = [
  {
    slug: "aurora",
    name: "Aurora",
    description: "Oscuro y premium: gradientes violeta, tipografía geométrica, ideal para tech, agencias y marcas modernas.",
    basePrice: 1500,
    config: {
      palette: {
        primary: "#8b5cf6",
        secondary: "#22d3ee",
        background: "#0b0716",
        surface: "#171226",
        text: "#f4f1fb",
        muted: "#a49cc0",
      },
      fonts: {
        heading: "Space Grotesk",
        body: "Inter",
        googleUrl: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&display=swap",
      },
      heroBackground: {
        type: "gradient",
        value: "radial-gradient(ellipse 80% 60% at 70% 20%, rgba(139,92,246,.35), transparent), linear-gradient(160deg, #0b0716 0%, #1a1033 55%, #0b0716 100%)",
      },
      dark: true,
    },
  },
  {
    slug: "terracota",
    name: "Terracota",
    description: "Cálido y artesanal: tonos tierra, serifas con carácter, perfecto para restaurantes, cafés y negocios locales.",
    basePrice: 1500,
    config: {
      palette: {
        primary: "#c2410c",
        secondary: "#a16207",
        background: "#fdf8f1",
        surface: "#ffffff",
        text: "#3b2f27",
        muted: "#8a7a6d",
      },
      fonts: {
        heading: "Fraunces",
        body: "Karla",
        googleUrl: "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Karla:wght@400;500;700&display=swap",
      },
      heroBackground: {
        type: "gradient",
        value: "linear-gradient(135deg, #fdf1e3 0%, #f7d9b8 50%, #eebd8e 100%)",
      },
      dark: false,
    },
  },
  {
    slug: "lumen",
    name: "Lumen",
    description: "Minimal y editorial: blanco generoso, acentos esmeralda, tipografía elegante. Para consultorios, estudios y profesionales.",
    basePrice: 1500,
    config: {
      palette: {
        primary: "#059669",
        secondary: "#0f766e",
        background: "#fbfdfc",
        surface: "#ffffff",
        text: "#111827",
        muted: "#6b7280",
      },
      fonts: {
        heading: "Playfair Display",
        body: "Source Sans 3",
        googleUrl: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&family=Source+Sans+3:wght@400;600&display=swap",
      },
      heroBackground: {
        type: "gradient",
        value: "linear-gradient(180deg, #ecfdf5 0%, #fbfdfc 70%)",
      },
      dark: false,
    },
  },
];

const widgets = [
  { slug: "galeria", name: "Galería de fotos", description: "Cuadrícula de fotos configurable (tamaño, efectos, espaciados, textos).", sectionType: "gallery", icon: "image", price: 250 },
  { slug: "carrusel", name: "Carrusel de imágenes", description: "Carrusel de fotos que avanza automáticamente, con textos y controles.", sectionType: "carousel", icon: "images", price: 300 },
  { slug: "testimonios", name: "Testimonios / reseñas", description: "Carrusel de reseñas de clientes con foto y nombre.", sectionType: "testimonials", icon: "quote", price: 200 },
  { slug: "mapa", name: "Integración de mapa", description: "Mapa embebido de Google Maps con tu ubicación.", sectionType: "map", icon: "map-pin", price: 150 },
  { slug: "faq", name: "Preguntas frecuentes", description: "Acordeón de preguntas y respuestas.", sectionType: "faq", icon: "help-circle", price: 150 },
  { slug: "contacto-avanzado", name: "Formulario de contacto avanzado", description: "Formulario con validación listo para conectar a tu correo.", sectionType: "contact", icon: "mail", price: 300 },
  { slug: "cotizador", name: "Calculadora de cotización", description: "Tus clientes arman su cotización con opciones y precio en vivo.", sectionType: "quote", icon: "calculator", price: 450 },
  { slug: "seccion-extra", name: "Sección extra", description: "Cualquier sección adicional agregada manualmente.", sectionType: null, icon: "layout", price: 100 },
  { slug: "pagina-adicional", name: "Página adicional", description: "Páginas completas extra (ej. Nosotros o Contacto dedicada). Precio por página; tú defines qué lleva cada una.", sectionType: null, icon: "file-plus", price: 400 },
  // Descartado por ahora (2026-07-09): se conserva inactivo por si se retoma
  { slug: "multi-idioma", name: "Multi-idioma", description: "Tu sitio en español e inglés con selector de idioma.", sectionType: null, icon: "globe", price: 600, active: false },
  { slug: "montaje-sin-dominio", name: "Montaje en línea (sin dominio)", description: "Publicamos tu sitio en internet con una dirección en Netlify (tu-negocio.netlify.app).", sectionType: null, icon: "cloud", price: 300 },
  { slug: "montaje-con-dominio", name: "Montaje con dominio propio", description: "Publicamos tu sitio con tu propio dominio (.com, .mx…). El costo del dominio se cotiza aparte según disponibilidad.", sectionType: null, icon: "globe", price: 800 },
];

async function main() {
  for (const t of templates) {
    await prisma.template.upsert({ where: { slug: t.slug }, update: { config: t.config, description: t.description }, create: t });
  }
  for (const w of widgets) {
    await prisma.widget.upsert({
      where: { slug: w.slug },
      // No se actualiza price: los precios se administran desde /superadmin
      update: { description: w.description, sectionType: w.sectionType, icon: w.icon, active: (w as any).active ?? true },
      create: w,
    });
  }

  await prisma.user.upsert({
    where: { email: "rodney@berriesandmango.com" },
    update: { role: "SUPER_ADMIN" },
    create: {
      email: "rodney@berriesandmango.com",
      name: "Rodney",
      role: "SUPER_ADMIN",
      passwordHash: await hash("superadmin123", 10),
    },
  });

  console.log("Seed listo: 3 templates y todos los widgets, super admin rodney@berriesandmango.com (password: superadmin123)");
}

main().finally(() => prisma.$disconnect());
