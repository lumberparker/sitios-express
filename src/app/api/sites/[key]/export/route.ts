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

  // Incluir imágenes subidas como assets/ (disco local en dev, Blob en prod)
  for (const url of collectUploads(config)) {
    try {
      const buf = url.startsWith("/uploads/")
        ? await readFile(path.join(process.cwd(), "public", url))
        : Buffer.from(await (await fetch(url)).arrayBuffer());
      zip.file(`assets/${url.split("/").pop()}`, buf);
    } catch {
      // imagen inaccesible: se omite sin romper el export
    }
  }

  zip.file(
    "README.txt",
    `Sitio generado por Sitios Web Express para ${config.business.name}.\n\n` +
      `Contenido: index.html, styles.css, script.js y assets/.\n` +
      `Para publicarlo sube TODOS los archivos a tu hosting (Netlify, Vercel, GitHub Pages, cPanel...).\n` +
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
