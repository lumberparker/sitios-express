import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import JSZip from "jszip";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSiteByKey } from "@/lib/sites";
import { SiteConfigSchema, TemplateConfigSchema } from "@/lib/site-config";
import { generateStaticSite, collectUploads } from "@/lib/export/static";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) return NextResponse.json({ error: "No encontrado" }, { status: 404 });

  // La descarga del código solo se habilita con el pago confirmado.
  // El super admin (sesión) puede descargar siempre.
  if (site.status !== "PAID") {
    const session = await getServerSession(authOptions);
    if (session?.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "La descarga se habilita cuando tu pago esté confirmado." },
        { status: 402 }
      );
    }
  }

  const config = SiteConfigSchema.parse(site.config);
  const templateConfig = TemplateConfigSchema.parse(site.template.config);
  const files = generateStaticSite(config, templateConfig);

  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);

  // Imágenes subidas → assets/images/ (disco local en dev, Blob en prod)
  for (const url of collectUploads(config)) {
    try {
      const buf = url.startsWith("/uploads/")
        ? await readFile(path.join(process.cwd(), "public", url))
        : Buffer.from(await (await fetch(url)).arrayBuffer());
      const name = url.split("/").pop() || "image";
      zip.file(`assets/images/${name}`, buf);
    } catch {
      // imagen inaccesible: se omite sin romper el export
    }
  }

  zip.file(
    "README.txt",
    `Sitio generado por Sitios Web Express para ${config.business.name}.\n\n` +
      `Estructura:\n` +
      `  index.html          — página principal\n` +
      `  styles.css          — importa todos los CSS de styles/\n` +
      `  styles/             — un archivo por bloque (header.css, hero.css, map.css…)\n` +
      `  styles/fonts.css    — Google Fonts (@import). Edítalo para cambiar tipografías.\n` +
      `  styles/base.css     — variables de color y fuentes (--font-heading, --font-body)\n` +
      `  script.js           — menú, carrusel, cotizador…\n` +
      `  assets/images/      — imágenes del sitio\n\n` +
      `Tipografías personalizadas:\n` +
      `  1) fonts.google.com → elige familias → "Get embed code"\n` +
      `  2) Copia la URL css2?family=... en styles/fonts.css (@import url("..."))\n` +
      `  3) Actualiza --font-heading y --font-body en styles/base.css\n` +
      `  (O usa el builder: Negocio → Tipografía → pegar el <link> de Google Fonts)\n\n` +
      `Para publicarlo sube TODOS los archivos a tu hosting (Netlify, Vercel, cPanel…).\n` +
      `No requiere instalación ni dependencias.\n`
  );

  const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const slug = config.business.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sitio";

  return new NextResponse(buffer as any, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slug}-sitio-web.zip"`,
    },
  });
}
