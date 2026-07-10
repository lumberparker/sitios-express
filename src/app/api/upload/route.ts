import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";
import { put } from "@vercel/blob";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

// Con BLOB_READ_WRITE_TOKEN (Vercel Blob) las imágenes van al storage en la
// nube; sin él (dev local) van a public/uploads. El contrato de la respuesta
// ({ url, faviconUrl? }) es el mismo en ambos casos.
const useBlob = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN);

async function store(name: string, buffer: Buffer, contentType: string): Promise<string> {
  if (useBlob()) {
    const blob = await put(`uploads/${name}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: false,
    });
    return blob.url;
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  return `/uploads/${name}`;
}

/**
 * Subida de imágenes. Con ?favicon=1 genera además un favicon PNG 64x64
 * a partir de la imagen (para el logo).
 */
export async function POST(req: Request) {
  // En Vercel el disco es efímero: sin Blob store las imágenes se perderían.
  // Mejor fallar con un mensaje claro que guardar en un disco que se borra.
  if (process.env.VERCEL && !useBlob()) {
    return NextResponse.json(
      { error: "Almacenamiento no configurado: crea el Blob store en Vercel (Storage → Create → Blob) y redeploy." },
      { status: 503 }
    );
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Formato no soportado (usa PNG, JPG, WebP o SVG)." }, { status: 400 });
  }
  // Límite de 4 MB: el body de una función de Vercel admite 4.5 MB máximo
  if (file.size > 4 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 4 MB. Comprime la imagen o usa la opción de URL externa." }, { status: 400 });
  }

  const id = crypto.randomBytes(8).toString("hex");
  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const buffer = Buffer.from(await file.arrayBuffer());

  const result: { url: string; faviconUrl?: string } = {
    url: await store(`${id}.${ext}`, buffer, file.type),
  };

  const wantsFavicon = new URL(req.url).searchParams.get("favicon") === "1";
  if (wantsFavicon && file.type !== "image/svg+xml") {
    const favBuffer = await sharp(buffer)
      .resize(64, 64, { fit: "cover", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    result.faviconUrl = await store(`${id}-favicon.png`, favBuffer, "image/png");
  }

  return NextResponse.json(result, { status: 201 });
}
