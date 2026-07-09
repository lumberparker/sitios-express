import { NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import sharp from "sharp";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

/**
 * Subida de imágenes a disco local (dev). El contrato (POST multipart →
 * { url, faviconUrl? }) se mantiene igual cuando se migre a S3/Cloudinary.
 * Con ?favicon=1 genera además un favicon PNG 64x64 a partir de la imagen.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "Formato no soportado (usa PNG, JPG, WebP o SVG)." }, { status: 400 });
  }
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Máximo 8 MB." }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });
  const id = crypto.randomBytes(8).toString("hex");
  const ext = file.type === "image/svg+xml" ? "svg" : file.type.split("/")[1];
  const buffer = Buffer.from(await file.arrayBuffer());

  const name = `${id}.${ext}`;
  await writeFile(path.join(UPLOAD_DIR, name), buffer);
  const result: { url: string; faviconUrl?: string } = { url: `/uploads/${name}` };

  const wantsFavicon = new URL(req.url).searchParams.get("favicon") === "1";
  if (wantsFavicon && file.type !== "image/svg+xml") {
    const favName = `${id}-favicon.png`;
    await sharp(buffer)
      .resize(64, 64, { fit: "cover", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(UPLOAD_DIR, favName));
    result.faviconUrl = `/uploads/${favName}`;
  }

  return NextResponse.json(result, { status: 201 });
}
