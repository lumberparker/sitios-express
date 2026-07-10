"use client";

// Renderiza un sitio completo a partir del SiteConfig (fuente de verdad).
// Se usa en el preview en vivo del builder y en /preview/[siteId].
// El exportador estático (src/lib/export/static.ts) produce el mismo diseño
// en HTML/CSS puro.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { SiteConfig, Section, TemplateConfig } from "@/lib/site-config";
import { SECTION_LABELS, businessWhatsAppUrl, cardRadiusPx, effectiveFonts, resolveCtaLink } from "@/lib/site-config";

const ROUNDED: Record<string, string> = { none: "0", md: "10px", xl: "20px", full: "32px" };

function sectionBg(section: Section, tpl: TemplateConfig, index: number): React.CSSProperties {
  const bg = section.style.background;
  const style: React.CSSProperties = {};
  if (bg.type === "image" && bg.value) {
    style.backgroundImage = `${bg.overlay ? `linear-gradient(${bg.overlay}, ${bg.overlay}), ` : ""}url(${bg.value})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  } else if (bg.type === "gradient" && bg.value) {
    style.background = bg.value;
  } else if (bg.value) {
    style.background = bg.value;
  } else if (section.type === "hero") {
    const hb = tpl.heroBackground;
    style.background = hb.type === "image" ? `url(${hb.value}) center/cover` : hb.value;
  } else {
    style.background = index % 2 === 0 ? tpl.palette.background : tpl.palette.surface;
  }
  style.color = section.style.textColor || tpl.palette.text;
  return style;
}

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function cardStyle(section: Section, tpl: TemplateConfig): React.CSSProperties {
  const c = section.style.card;
  return {
    background: tpl.palette.surface,
    borderRadius: cardRadiusPx(c),
    boxShadow: c.shadow ? "0 12px 32px rgba(0,0,0,.12)" : "none",
    border: c.border ? `1px solid ${section.style.accentColor || tpl.palette.primary}33` : "none",
    color: tpl.palette.text,
  };
}

export function SiteRenderer({ config, templateConfig: tplBase }: { config: SiteConfig; templateConfig: TemplateConfig }) {
  // Tipografía: overrides del usuario (config.theme) sobre la del template
  const tpl: TemplateConfig = { ...tplBase, fonts: effectiveFonts(config, tplBase) };
  const [menuOpen, setMenuOpen] = useState(false);
  const sections = [...config.sections].sort((a, b) => a.order - b.order);
  const menuSections = sections.filter((s) => s.inMenu);
  const accent = (s: Section) => s.style.accentColor || tpl.palette.primary;

  return (
    <div
      style={{
        fontFamily: `'${tpl.fonts.body}', system-ui, sans-serif`,
        background: tpl.palette.background,
        color: tpl.palette.text,
        minHeight: "100%",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={tpl.fonts.googleUrl} />

      {/* Header */}
      <header
        className="sticky top-0 z-40 backdrop-blur"
        style={{ background: `${tpl.palette.background}e6`, borderBottom: `1px solid ${tpl.palette.text}14` }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {config.business.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.business.logoUrl} alt={config.business.name} className="h-10 w-auto object-contain" />
            )}
            {(config.business.showNameInHeader !== false || !config.business.logoUrl) && (
              <span className="text-lg font-bold" style={{ fontFamily: `'${tpl.fonts.heading}', serif`, color: tpl.palette.primary }}>
                {config.business.name}
              </span>
            )}
          </div>
          <nav className="hidden gap-6 text-sm font-medium md:flex">
            {menuSections.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="opacity-80 transition-opacity hover:opacity-100">
                {(s.content.title as string) || SECTION_LABELS[s.type]}
              </a>
            ))}
          </nav>
          <button
            aria-label="Abrir menú"
            className="flex h-10 w-10 flex-col items-center justify-center gap-1.5 md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="h-0.5 w-6 transition-transform" style={{ background: tpl.palette.text, transform: menuOpen ? "translateY(4px) rotate(45deg)" : "none" }} />
            <span className="h-0.5 w-6 transition-opacity" style={{ background: tpl.palette.text, opacity: menuOpen ? 0 : 1 }} />
            <span className="h-0.5 w-6 transition-transform" style={{ background: tpl.palette.text, transform: menuOpen ? "translateY(-4px) rotate(-45deg)" : "none" }} />
          </button>
        </div>
        <motion.nav
          initial={false}
          animate={{ height: menuOpen ? "auto" : 0 }}
          className="overflow-hidden md:hidden"
          style={{ background: tpl.palette.surface }}
        >
          {menuSections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="block px-6 py-3 text-sm font-medium" onClick={() => setMenuOpen(false)}>
              {(s.content.title as string) || SECTION_LABELS[s.type]}
            </a>
          ))}
        </motion.nav>
      </header>

      {sections.map((section, i) => (
        <section key={section.id} id={section.id} style={sectionBg(section, tpl, i)}>
          <SectionBody section={section} tpl={tpl} accent={accent(section)} config={config} />
        </section>
      ))}

      {/* Footer */}
      <footer style={{ background: tpl.dark ? "#000000cc" : tpl.palette.text, color: tpl.dark ? tpl.palette.muted : tpl.palette.background }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center text-sm md:flex-row md:justify-between md:text-left">
          <div>
            <p className="font-semibold" style={{ fontFamily: `'${tpl.fonts.heading}', serif` }}>
              {config.business.name}
            </p>
            {config.business.address && <p className="mt-1 opacity-70">{config.business.address}</p>}
            {config.business.email && <p className="opacity-70">{config.business.email}</p>}
            {config.business.phone && <p className="opacity-70">{config.business.phone}</p>}
          </div>
          <div className="flex gap-4">
            {Object.entries(config.social)
              .filter(([, url]) => url)
              .map(([net, url]) => (
                <a key={net} href={url as string} target="_blank" rel="noreferrer" className="capitalize underline-offset-4 hover:underline">
                  {net}
                </a>
              ))}
          </div>
          <p className="opacity-60">
            © {new Date().getFullYear()} {config.business.name}
          </p>
        </div>
      </footer>

      {/* Botón flotante de WhatsApp */}
      {config.whatsapp.enabled && businessWhatsAppUrl(config) && (
        <a
          href={businessWhatsAppUrl(config)!}
          target="_blank"
          rel="noreferrer"
          aria-label="WhatsApp"
          className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-transform hover:scale-110"
          style={{ background: "#25D366" }}
        >
          <svg viewBox="0 0 32 32" width="30" height="30" fill="#fff" aria-hidden>
            <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.8 5 2.3 7L4.5 28l6.3-1.7c1.6.9 3.4 1.3 5.2 1.3 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-1.6 0-3.2-.4-4.6-1.2l-.3-.2-3.7 1 1-3.6-.2-.3c-1.3-1.7-2-3.7-2-5.7C6.2 9.5 10.6 5.2 16 5.2s9.8 4.3 9.8 9.7-4.4 9.9-9.8 9.9zm5.4-7.3c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1c-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1s-1.2-.5-2.4-1.5c-.9-.8-1.5-1.8-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4z" />
          </svg>
        </a>
      )}
    </div>
  );
}

function SectionBody({
  section,
  tpl,
  accent,
  config,
}: {
  section: Section;
  tpl: TemplateConfig;
  accent: string;
  config: SiteConfig;
}) {
  const c = section.content;
  const heading = { fontFamily: `'${tpl.fonts.heading}', serif` };

  switch (section.type) {
    case "hero":
      return (
        <div className="mx-auto max-w-5xl px-6 py-28 text-center md:py-40">
          <Reveal>
            <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-7xl" style={heading}>
              {c.title}
            </h1>
          </Reveal>
          <Reveal delay={0.15}>
            <p className="mx-auto mt-6 max-w-2xl text-lg opacity-80 md:text-xl">{c.subtitle}</p>
          </Reveal>
          {c.ctaText && (
            <Reveal delay={0.3}>
              <a
                href={resolveCtaLink(c.ctaLink, config)}
                target={resolveCtaLink(c.ctaLink, config).startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="mt-10 inline-block rounded-full px-10 py-4 text-lg font-semibold text-white shadow-lg transition-transform hover:scale-105"
                style={{ background: accent }}
              >
                {c.ctaText}
              </a>
            </Reveal>
          )}
        </div>
      );

    case "about":
      return (
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2">
          <Reveal>
            <div>
              <h2 className="text-3xl font-bold md:text-4xl" style={heading}>
                {c.title}
              </h2>
              <div className="mt-2 h-1 w-16 rounded" style={{ background: accent }} />
              <p className="mt-6 whitespace-pre-line leading-relaxed opacity-85">{c.text}</p>
            </div>
          </Reveal>
          <Reveal delay={0.15}>
            {c.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.imageUrl} alt={c.title} className="w-full object-cover" style={{ borderRadius: 24, maxHeight: 420 }} />
            ) : (
              <div className="flex h-64 items-center justify-center text-sm opacity-40" style={{ borderRadius: 24, border: `2px dashed currentColor` }}>
                Sube una foto de tu equipo o negocio
              </div>
            )}
          </Reveal>
        </div>
      );

    case "products":
      return (
        <div className="mx-auto max-w-6xl px-6 py-24">
          <Reveal>
            <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
              {c.title}
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {(c.items ?? []).map((item: any, i: number) => (
              <Reveal key={i} delay={i * 0.08}>
                <div className="overflow-hidden transition-transform hover:-translate-y-1" style={cardStyle(section, tpl)}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="h-44 w-full object-cover" />
                  ) : (
                    <div className="h-44 w-full" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}55)` }} />
                  )}
                  <div className="p-6">
                    <h3 className="text-lg font-semibold" style={heading}>
                      {item.name}
                    </h3>
                    <p className="mt-2 text-sm opacity-75">{item.description}</p>
                    {item.price && (
                      <p className="mt-4 text-xl font-bold" style={{ color: accent }}>
                        {item.price}
                      </p>
                    )}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      );

    case "testimonials":
      return (
        <div className="mx-auto max-w-5xl px-6 py-24">
          <Reveal>
            <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
              {c.title}
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {(c.items ?? []).map((t: any, i: number) => (
              <Reveal key={i} delay={i * 0.1}>
                <figure className="p-8" style={cardStyle(section, tpl)}>
                  <div style={{ color: accent }} className="text-4xl leading-none">
                    “
                  </div>
                  <blockquote className="mt-2 italic opacity-85">{t.text}</blockquote>
                  <figcaption className="mt-4 text-sm font-semibold">
                    {t.name}
                    {t.role && <span className="ml-2 font-normal opacity-60">{t.role}</span>}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </div>
      );

    case "gallery":
      return <GallerySection section={section} heading={heading} />;

    case "carousel":
      return <CarouselSection section={section} heading={heading} />;

    case "map":
      return (
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <Reveal>
            <h2 className="text-3xl font-bold md:text-4xl" style={heading}>
              {c.title}
            </h2>
            {c.address && <p className="mt-3 opacity-75">{c.address}</p>}
          </Reveal>
          <Reveal delay={0.15}>
            {c.embedUrl ? (
              <iframe src={c.embedUrl} className="mt-8 h-96 w-full border-0" style={{ borderRadius: 20 }} loading="lazy" title="Mapa" />
            ) : (
              <div className="mt-8 flex h-64 items-center justify-center text-sm opacity-40" style={{ borderRadius: 20, border: "2px dashed currentColor" }}>
                Pega la URL de embed de Google Maps en el builder
              </div>
            )}
          </Reveal>
        </div>
      );

    case "faq":
      return (
        <div className="mx-auto max-w-3xl px-6 py-24">
          <Reveal>
            <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
              {c.title}
            </h2>
          </Reveal>
          <div className="mt-10 space-y-4">
            {(c.items ?? []).map((f: any, i: number) => (
              <Reveal key={i} delay={i * 0.05}>
                <details className="group p-5" style={cardStyle(section, tpl)}>
                  <summary className="cursor-pointer list-none font-semibold">
                    <span className="mr-2" style={{ color: accent }}>
                      +
                    </span>
                    {f.q}
                  </summary>
                  <p className="mt-3 text-sm opacity-75">{f.a}</p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      );

    case "contact":
      return (
        <div className="mx-auto max-w-2xl px-6 py-24">
          <Reveal>
            <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
              {c.title}
            </h2>
            {c.subtitle && <p className="mt-3 text-center opacity-75">{c.subtitle}</p>}
          </Reveal>
          <Reveal delay={0.15}>
            <form className="mt-10 space-y-4 p-8" style={cardStyle(section, tpl)} onSubmit={(e) => e.preventDefault()}>
              <input placeholder="Tu nombre" className="w-full rounded-lg border border-current/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-current/50" />
              <input placeholder="Tu correo" type="email" className="w-full rounded-lg border border-current/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-current/50" />
              <textarea placeholder="Mensaje" rows={4} className="w-full rounded-lg border border-current/20 bg-transparent px-4 py-3 text-sm outline-none focus:border-current/50" />
              <button type="submit" className="w-full rounded-lg py-3 font-semibold text-white transition-opacity hover:opacity-90" style={{ background: accent }}>
                Enviar mensaje
              </button>
            </form>
          </Reveal>
        </div>
      );

    case "quote":
      return <QuoteSection section={section} tpl={tpl} accent={accent} heading={heading} />;

    default:
      return null;
  }
}

export type GalleryImage = { url: string; caption?: string };

/** Acepta el formato viejo (string[]) y el nuevo ([{ url, caption }]). */
export function normalizeGalleryImages(raw: any): GalleryImage[] {
  return ((raw as any[]) ?? [])
    .map((i) => (typeof i === "string" ? { url: i } : i))
    .filter((i): i is GalleryImage => Boolean(i?.url));
}

function GallerySection({ section, heading }: { section: Section; heading: React.CSSProperties }) {
  const c = section.content;
  const cols = Math.min(10, Math.max(2, Number(c.columns) || 3));
  const images = normalizeGalleryImages(c.images).slice(0, cols * cols);
  const gapX = Number(c.gapX ?? 12);
  const gapY = Number(c.gapY ?? 12);
  const borderWidth = Number(c.borderWidth ?? 0);
  const borderColor = c.borderColor || "#ffffff";
  const radius = Number(c.radius ?? 16);
  const effect = c.hoverEffect ?? "zoom";
  const capMode = c.captionMode ?? "hover";
  const id = section.id;

  // Reglas dinámicas (hover/caption) con alcance por sección
  const css = [
    `#${id} .g-item{position:relative;overflow:hidden;border-radius:${radius}px}`,
    `#${id} .g-item img{aspect-ratio:1;width:100%;object-fit:cover;display:block;border-radius:${radius}px;transition:transform .35s ease,filter .35s ease;${
      borderWidth ? `border:${borderWidth}px solid ${borderColor};` : ""
    }}`,
    `#${id} .g-cap{position:absolute;left:0;right:0;bottom:0;padding:.9rem;color:#fff;font-size:.85rem;background:linear-gradient(transparent,rgba(0,0,0,.75));border-radius:0 0 ${radius}px ${radius}px;transition:opacity .3s}`,
    capMode === "hover" ? `#${id} .g-cap{opacity:0} #${id} .g-item:hover .g-cap{opacity:1}` : "",
    capMode === "none" ? `#${id} .g-cap{display:none}` : "",
    effect === "zoom" ? `#${id} .g-item:hover img{transform:scale(1.07)}` : "",
    effect === "lift" ? `#${id} .g-item{transition:transform .3s,box-shadow .3s} #${id} .g-item:hover{transform:translateY(-6px);box-shadow:0 16px 32px rgba(0,0,0,.25)}` : "",
    effect === "gray" ? `#${id} .g-item img{filter:grayscale(1)} #${id} .g-item:hover img{filter:grayscale(0)}` : "",
    effect === "dark" ? `#${id} .g-item img{filter:brightness(.72)} #${id} .g-item:hover img{filter:brightness(1)}` : "",
    `@media (max-width:640px){ #${id} .g-grid{grid-template-columns:repeat(2,1fr)!important} }`,
  ].join("\n");

  return (
    <div className="mx-auto max-w-6xl px-6 py-24">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Reveal>
        <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
          {c.title}
        </h2>
      </Reveal>
      {images.length > 0 ? (
        <div
          className="g-grid mt-12"
          style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, columnGap: gapX, rowGap: gapY }}
        >
          {images.map((img, i) => (
            <Reveal key={i} delay={Math.min(i * 0.04, 0.4)}>
              <figure className="g-item">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption || ""} />
                {img.caption && <figcaption className="g-cap">{img.caption}</figcaption>}
              </figure>
            </Reveal>
          ))}
        </div>
      ) : (
        <p className="mt-12 text-center text-sm opacity-50">Agrega fotos desde el builder.</p>
      )}
    </div>
  );
}

function CarouselSection({ section, heading }: { section: Section; heading: React.CSSProperties }) {
  const c = section.content;
  const images = normalizeGalleryImages(c.images).slice(0, 15);
  const interval = Math.min(10, Math.max(2, Number(c.interval) || 4)) * 1000;
  const height = Math.min(640, Math.max(200, Number(c.height) || 400));
  const radius = Number(c.radius ?? 16);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (images.length < 2) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % images.length), interval);
    return () => clearInterval(t);
  }, [images.length, interval]);

  if (images.length === 0) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-24 text-center text-sm opacity-50">Agrega fotos al carrusel desde el builder.</div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-24">
      {c.title && (
        <Reveal>
          <h2 className="mb-10 text-center text-3xl font-bold md:text-4xl" style={heading}>
            {c.title}
          </h2>
        </Reveal>
      )}
      <Reveal>
        <div className="relative overflow-hidden" style={{ borderRadius: radius }}>
          <div
            className="flex transition-transform duration-700 ease-in-out"
            style={{ transform: `translateX(-${idx * 100}%)` }}
          >
            {images.map((img, i) => (
              <div key={i} className="relative w-full shrink-0" style={{ height }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.caption || ""} className="h-full w-full object-cover" />
                {img.caption && (
                  <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-5 text-sm text-white">
                    {img.caption}
                  </p>
                )}
              </div>
            ))}
          </div>
          {/* Flechas */}
          {images.length > 1 && (
            <>
              <button
                aria-label="Anterior"
                onClick={() => setIdx((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-white transition-colors hover:bg-black/60"
              >
                ‹
              </button>
              <button
                aria-label="Siguiente"
                onClick={() => setIdx((i) => (i + 1) % images.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 px-3 py-1.5 text-white transition-colors hover:bg-black/60"
              >
                ›
              </button>
            </>
          )}
          {/* Puntos */}
          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {images.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Foto ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className="h-2 w-2 rounded-full transition-all"
                  style={{ background: i === idx ? "#fff" : "rgba(255,255,255,.45)", width: i === idx ? 16 : 8 }}
                />
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  );
}

function QuoteSection({ section, tpl, accent, heading }: { section: Section; tpl: TemplateConfig; accent: string; heading: React.CSSProperties }) {
  const c = section.content;
  const [selected, setSelected] = useState<number[]>([]);
  const base = Number(c.basePrice) || 0;
  const options: { label: string; price: number }[] = c.options ?? [];
  const total = base + selected.reduce((acc, i) => acc + (Number(options[i]?.price) || 0), 0);

  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <Reveal>
        <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
          {c.title}
        </h2>
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-10 p-8" style={cardStyle(section, tpl)}>
          <p className="text-sm opacity-70">Precio base: ${base}</p>
          <div className="mt-4 space-y-3">
            {options.map((opt, i) => (
              <label key={i} className="flex cursor-pointer items-center justify-between rounded-lg border border-current/15 px-4 py-3 text-sm">
                <span className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(i)}
                    onChange={(e) => setSelected((s) => (e.target.checked ? [...s, i] : s.filter((x) => x !== i)))}
                  />
                  {opt.label}
                </span>
                <span className="font-semibold">+${opt.price}</span>
              </label>
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between border-t border-current/10 pt-4">
            <span className="font-semibold">Total estimado</span>
            <span className="text-2xl font-bold" style={{ color: accent }}>
              ${total}
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
