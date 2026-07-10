"use client";

// Renderiza un sitio completo a partir del SiteConfig (fuente de verdad).
// Se usa en el preview en vivo del builder y en /preview/[siteId].
// El exportador estático (src/lib/export/static.ts) produce el mismo diseño
// en HTML/CSS puro.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { SiteConfig, Section, TemplateConfig, ExtraPage } from "@/lib/site-config";
import {
  SECTION_LABELS,
  cssObjectPosition,
  effectiveFonts,
  getExtraPages,
  normalizeIframeSrc,
  normalizeMapEmbedUrl,
  normalizeObjectFit,
  normalizePosX,
  normalizePosY,
  resolveCtaLink,
} from "@/lib/site-config";

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

function Reveal({
  children,
  delay = 0,
  style,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      style={style}
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
    borderRadius: ROUNDED[c.rounded],
    boxShadow: c.shadow ? "0 12px 32px rgba(0,0,0,.12)" : "none",
    border: c.border ? `1px solid ${section.style.accentColor || tpl.palette.primary}33` : "none",
    color: tpl.palette.text,
  };
}

export function SiteRenderer({
  config,
  templateConfig: tplBase,
  previewPageId = "home",
  onNavigatePage,
}: {
  config: SiteConfig;
  templateConfig: TemplateConfig;
  /** "home" o id de ExtraPage — controlado por el builder; en preview público se usa estado interno. */
  previewPageId?: string;
  onNavigatePage?: (pageId: string) => void;
}) {
  // Tipografía: overrides del usuario (config.theme) sobre la del template
  const tpl: TemplateConfig = { ...tplBase, fonts: effectiveFonts(config, tplBase) };
  const [menuOpen, setMenuOpen] = useState(false);
  const [internalPage, setInternalPage] = useState(previewPageId);
  const extraPages = getExtraPages(config);

  // Sync con el builder cuando cambia la página en edición
  useEffect(() => {
    setInternalPage(previewPageId);
  }, [previewPageId]);

  const activePageId = onNavigatePage ? previewPageId : internalPage;
  const goToPage = (id: string) => {
    if (onNavigatePage) onNavigatePage(id);
    else setInternalPage(id);
    setMenuOpen(false);
  };

  const activeExtra: ExtraPage | null =
    activePageId === "home" ? null : extraPages.find((p) => p.id === activePageId) ?? null;
  const isHome = !activeExtra;

  const homeSections = [...config.sections].sort((a, b) => a.order - b.order);
  const pageSections = activeExtra
    ? [...activeExtra.sections].sort((a, b) => a.order - b.order)
    : [];
  const sections = isHome ? homeSections : pageSections;
  const menuSections = homeSections.filter((s) => s.inMenu);
  const accent = (s: Section) => s.style.accentColor || tpl.palette.primary;

  const navLinkClass = "opacity-80 transition-opacity hover:opacity-100 cursor-pointer";

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
          <button type="button" className="flex items-center gap-3 text-left" onClick={() => goToPage("home")}>
            {config.business.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.business.logoUrl} alt={config.business.name} className="h-10 w-auto object-contain" />
            )}
            {(config.business.showNameInHeader !== false || !config.business.logoUrl) && (
              <span className="text-lg font-bold" style={{ fontFamily: `'${tpl.fonts.heading}', serif`, color: tpl.palette.primary }}>
                {config.business.name}
              </span>
            )}
          </button>
          <nav className="hidden flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm font-medium md:flex">
            {isHome &&
              menuSections.map((s) => (
                <a key={s.id} href={`#${s.id}`} className={navLinkClass}>
                  {(s.content.title as string) || SECTION_LABELS[s.type]}
                </a>
              ))}
            {!isHome && (
              <button type="button" className={navLinkClass} onClick={() => goToPage("home")}>
                Inicio
              </button>
            )}
            {extraPages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`${navLinkClass} ${activePageId === p.id ? "opacity-100 font-semibold" : ""}`}
                onClick={() => goToPage(p.id)}
              >
                {p.title.trim() || `Página ${i + 1}`}
              </button>
            ))}
          </nav>
          <button
            type="button"
            aria-label={menuOpen ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={menuOpen}
            className="relative h-11 w-11 shrink-0 rounded-lg md:hidden"
            style={{ border: `1px solid ${tpl.palette.text}22` }}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {/* Icono hamburguesa → X (líneas centradas; no se deforma al abrir) */}
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 block h-0.5 w-5 rounded-full transition-all duration-300 ease-out"
              style={{
                background: tpl.palette.text,
                transform: menuOpen ? "translate(-50%, -50%) rotate(45deg)" : "translate(-50%, calc(-50% - 7px))",
              }}
            />
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 block h-0.5 w-5 rounded-full transition-all duration-300 ease-out"
              style={{
                background: tpl.palette.text,
                opacity: menuOpen ? 0 : 1,
                transform: "translate(-50%, -50%)",
              }}
            />
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 block h-0.5 w-5 rounded-full transition-all duration-300 ease-out"
              style={{
                background: tpl.palette.text,
                transform: menuOpen ? "translate(-50%, -50%) rotate(-45deg)" : "translate(-50%, calc(-50% + 7px))",
              }}
            />
          </button>
        </div>
        <motion.nav
          initial={false}
          animate={{ height: menuOpen ? "auto" : 0 }}
          className="overflow-hidden md:hidden"
          style={{ background: tpl.palette.surface, borderTop: menuOpen ? `1px solid ${tpl.palette.text}12` : undefined }}
        >
          <div className="px-2 py-2">
            {isHome &&
              menuSections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="block rounded-lg px-4 py-3 text-sm font-medium transition-colors hover:bg-black/5"
                  onClick={() => setMenuOpen(false)}
                >
                  {(s.content.title as string) || SECTION_LABELS[s.type]}
                </a>
              ))}
            {!isHome && (
              <button
                type="button"
                className="block w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-black/5"
                onClick={() => goToPage("home")}
              >
                Inicio
              </button>
            )}
            {extraPages.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={`block w-full rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-black/5 ${
                  activePageId === p.id ? "font-semibold opacity-100" : "opacity-90"
                }`}
                onClick={() => goToPage(p.id)}
              >
                {p.title.trim() || `Página ${i + 1}`}
              </button>
            ))}
          </div>
        </motion.nav>
      </header>

      {/* Contenido de subpágina: título + texto libre + secciones */}
      {!isHome && activeExtra && (
        <section className="px-6 py-16" style={{ background: tpl.palette.background }}>
          <div className="mx-auto max-w-3xl text-center">
            <Reveal>
              <h1 className="text-4xl font-bold md:text-5xl" style={{ fontFamily: `'${tpl.fonts.heading}', serif` }}>
                {activeExtra.title.trim() || "Página"}
              </h1>
              {activeExtra.content.trim() && (
                <p className="mx-auto mt-6 max-w-2xl whitespace-pre-line text-lg opacity-80">{activeExtra.content}</p>
              )}
            </Reveal>
          </div>
        </section>
      )}

      {sections.map((section, i) => (
        <section key={section.id} id={section.id} style={sectionBg(section, tpl, i)}>
          <SectionBody section={section} tpl={tpl} accent={accent(section)} config={config} />
        </section>
      ))}

      {!isHome && sections.length === 0 && !activeExtra?.content.trim() && (
        <div className="px-6 py-20 text-center text-sm opacity-50">Agrega secciones a esta página desde el editor.</div>
      )}

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
      {config.whatsapp.enabled && config.whatsapp.number && (
        <a
          href={`https://wa.me/${config.whatsapp.number.replace(/\D/g, "")}?text=${encodeURIComponent(config.whatsapp.defaultMessage)}`}
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

    case "custom": {
      const layout = c.layout ?? "text";
      const withImage = layout === "text-image" || layout === "image-text";
      const imageFirst = layout === "image-text";
      const imageBlock = withImage ? (
        <Reveal delay={imageFirst ? 0 : 0.15}>
          {c.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.imageUrl} alt={c.title} className="w-full object-cover" style={{ borderRadius: 24, maxHeight: 420 }} />
          ) : (
            <div className="flex h-56 items-center justify-center text-sm opacity-40" style={{ borderRadius: 24, border: "2px dashed currentColor" }}>
              Sube una imagen
            </div>
          )}
        </Reveal>
      ) : null;
      const textBlock = (
        <Reveal delay={imageFirst ? 0.15 : 0}>
          <div className={layout === "centered" ? "text-center" : ""}>
            <h2 className="text-3xl font-bold md:text-4xl" style={heading}>
              {c.title}
            </h2>
            <div
              className={`mt-2 h-1 w-16 rounded ${layout === "centered" ? "mx-auto" : ""}`}
              style={{ background: accent }}
            />
            <p className={`mt-6 whitespace-pre-line leading-relaxed opacity-85 ${layout === "centered" ? "mx-auto max-w-2xl" : ""}`}>
              {c.text}
            </p>
          </div>
        </Reveal>
      );
      if (withImage) {
        return (
          <div className={`mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 md:grid-cols-2`}>
            {imageFirst ? (
              <>
                {imageBlock}
                {textBlock}
              </>
            ) : (
              <>
                {textBlock}
                {imageBlock}
              </>
            )}
          </div>
        );
      }
      return <div className="mx-auto max-w-3xl px-6 py-24">{textBlock}</div>;
    }

    case "products": {
      const productCard = cardStyle(section, tpl);
      if (c.radius != null && c.radius !== "") {
        productCard.borderRadius = `${Number(c.radius)}px`;
      }
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
                <div className="overflow-hidden transition-transform hover:-translate-y-1" style={productCard}>
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
    }

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

    case "iframe": {
      const src = normalizeIframeSrc(c.url);
      const height = Math.min(900, Math.max(200, Number(c.height) || 480));
      const narrow = c.width === "narrow";
      return (
        <div className={`mx-auto px-6 py-16 ${narrow ? "max-w-3xl" : "max-w-6xl"}`}>
          {c.title ? (
            <Reveal>
              <h2 className="mb-8 text-center text-3xl font-bold md:text-4xl" style={heading}>
                {c.title}
              </h2>
            </Reveal>
          ) : null}
          <Reveal delay={0.1}>
            {src ? (
              <iframe
                src={src}
                title={c.title || "Contenido embebido"}
                className="w-full border-0 bg-black/5"
                style={{ height, borderRadius: 16 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
              />
            ) : (
              <div
                className="flex items-center justify-center text-sm opacity-40"
                style={{ height, borderRadius: 16, border: "2px dashed currentColor" }}
              >
                Pega una URL en el builder para mostrar el iframe
              </div>
            )}
          </Reveal>
        </div>
      );
    }

    case "map": {
      // Si no hay enlace usable, la dirección visible también sirve para el mapa
      const mapSrc = normalizeMapEmbedUrl(c.embedUrl) || normalizeMapEmbedUrl(c.address);
      const openQuery = (c.address || c.embedUrl || "").trim();
      const openHref =
        openQuery && !/^https?:\/\//i.test(openQuery) && !/<iframe/i.test(openQuery)
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(openQuery)}`
          : openQuery && /^https?:\/\//i.test(openQuery) && !/\/maps\/embed/i.test(openQuery)
            ? openQuery
            : mapSrc
              ? mapSrc.replace("/maps/embed?", "/maps?")
              : "";
      return (
        <div className="mx-auto max-w-5xl px-6 py-24 text-center">
          <Reveal>
            <h2 className="text-3xl font-bold md:text-4xl" style={heading}>
              {c.title}
            </h2>
            {c.address && <p className="mt-3 opacity-75">{c.address}</p>}
          </Reveal>
          {/* Sin Reveal alrededor del iframe: whileInView deja opacity:0 en el scroll anidado del builder */}
          {mapSrc ? (
            <div className="mt-8 overflow-hidden" style={{ borderRadius: 20 }}>
              <iframe
                key={mapSrc}
                src={mapSrc}
                className="h-96 w-full border-0"
                style={{ borderRadius: 20, minHeight: 360 }}
                loading="eager"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
                title="Mapa"
              />
            </div>
          ) : (
            <div className="mt-8 flex h-64 flex-col items-center justify-center gap-2 text-sm opacity-50" style={{ borderRadius: 20, border: "2px dashed currentColor" }}>
              <span>Pega un enlace de Google Maps o la dirección en el builder</span>
              <span className="text-xs opacity-80">Los links cortos (maps.app.goo.gl) no funcionan: usa el enlace largo o la dirección</span>
            </div>
          )}
          {mapSrc && openHref && (
            <p className="mt-3 text-sm opacity-70">
              <a href={openHref} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
                Abrir en Google Maps ↗
              </a>
            </p>
          )}
        </div>
      );
    }

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

export type GalleryImage = {
  url: string;
  caption?: string;
  /** Cuántas columnas del grid ocupa (1 = celda normal). */
  colSpan?: number;
  /** Cuántas filas del grid ocupa (1 = celda normal). */
  rowSpan?: number;
  /** cover = rellena recortando; contain = caber entera */
  objectFit?: "cover" | "contain";
  /** Posición horizontal del recorte/encuadre */
  posX?: "left" | "center" | "right";
  /** Posición vertical del recorte/encuadre */
  posY?: "top" | "center" | "bottom";
};

/** Acepta el formato viejo (string[]) y el nuevo ([{ url, caption, colSpan, rowSpan, … }]). */
export function normalizeGalleryImages(raw: any, maxCols = 10): GalleryImage[] {
  const out: GalleryImage[] = [];
  for (const i of (raw as any[]) ?? []) {
    if (typeof i === "string") {
      if (i) out.push({ url: i, colSpan: 1, rowSpan: 1, objectFit: "cover", posX: "center", posY: "center" });
      continue;
    }
    if (!i?.url) continue;
    out.push({
      url: String(i.url),
      caption: i.caption ? String(i.caption) : "",
      colSpan: Math.min(maxCols, Math.max(1, Number(i.colSpan) || 1)),
      rowSpan: Math.min(maxCols, Math.max(1, Number(i.rowSpan) || 1)),
      objectFit: normalizeObjectFit(i.objectFit),
      posX: normalizePosX(i.posX),
      posY: normalizePosY(i.posY),
    });
  }
  return out;
}

function GallerySection({ section, heading }: { section: Section; heading: React.CSSProperties }) {
  const c = section.content;
  const cols = Math.min(10, Math.max(2, Number(c.columns) || 3));
  // Hasta 24 fotos; el tamaño real lo marcan colSpan/rowSpan (layout tipo bento)
  const images = normalizeGalleryImages(c.images, cols).slice(0, 24).map((img) => ({
    ...img,
    colSpan: Math.min(cols, img.colSpan ?? 1),
    rowSpan: Math.min(cols, img.rowSpan ?? 1),
  }));
  const gapX = Number(c.gapX ?? 12);
  const gapY = Number(c.gapY ?? 12);
  const borderWidth = Number(c.borderWidth ?? 0);
  const borderColor = c.borderColor || "#ffffff";
  const radius = Number(c.radius ?? 16);
  const effect = c.hoverEffect ?? "zoom";
  const capMode = c.captionMode ?? "hover";
  const id = section.id;
  // 0 / full / ausente = 100% del contenedor (galerías viejas no se achican).
  // Galerías nuevas traen maxWidth: 960 por defecto.
  const maxWidthRaw = c.maxWidth;
  const maxWidth =
    maxWidthRaw === undefined ||
    maxWidthRaw === null ||
    maxWidthRaw === "" ||
    maxWidthRaw === "full" ||
    maxWidthRaw === 0 ||
    maxWidthRaw === "0"
      ? 0
      : Math.min(1400, Math.max(320, Number(maxWidthRaw) || 960));
  // Default 300px; 0 = sin tope (reparte el ancho del contenedor)
  const maxCell = Math.min(600, Math.max(0, Number(c.maxCell ?? 300)));
  // Alto de una fila del grid (= celda 1×1). Con maxCell se alinea al ancho de celda.
  const rowTrack = maxCell > 0 ? maxCell : Math.min(220, Math.max(100, Number(c.rowHeight ?? 160) || 160));

  // Reglas dinámicas (hover/caption/spans) con alcance por sección
  const css = [
    `#${id} .g-cell{min-width:0;min-height:0}`,
    `#${id} .g-item{position:relative;overflow:hidden;border-radius:${radius}px;width:100%;height:100%;margin:0;background:rgba(0,0,0,.06)}`,
    `#${id} .g-item img{width:100%;height:100%;display:block;border-radius:${radius}px;transition:transform .35s ease,filter .35s ease;${
      borderWidth ? `border:${borderWidth}px solid ${borderColor};` : ""
    }}`,
    `#${id} .g-cap{position:absolute;left:0;right:0;bottom:0;padding:.9rem;color:#fff;font-size:.85rem;background:linear-gradient(transparent,rgba(0,0,0,.75));border-radius:0 0 ${radius}px ${radius}px;transition:opacity .3s}`,
    capMode === "hover" ? `#${id} .g-cap{opacity:0} #${id} .g-item:hover .g-cap{opacity:1}` : "",
    capMode === "none" ? `#${id} .g-cap{display:none}` : "",
    effect === "zoom" ? `#${id} .g-item:hover img{transform:scale(1.07)}` : "",
    effect === "lift" ? `#${id} .g-item{transition:transform .3s,box-shadow .3s} #${id} .g-item:hover{transform:translateY(-6px);box-shadow:0 16px 32px rgba(0,0,0,.25)}` : "",
    effect === "gray" ? `#${id} .g-item img{filter:grayscale(1)} #${id} .g-item:hover img{filter:grayscale(0)}` : "",
    effect === "dark" ? `#${id} .g-item img{filter:brightness(.72)} #${id} .g-item:hover img{filter:brightness(1)}` : "",
    // Móvil: 2 columnas y celdas 1×1 (el bento completo se ve en desktop)
    maxCell
      ? `@media (max-width:640px){ #${id} .g-grid{grid-template-columns:repeat(2, minmax(0, ${maxCell}px))!important; grid-auto-rows:${Math.min(rowTrack, maxCell)}px!important; justify-content:center} #${id} .g-cell{grid-column:span 1!important;grid-row:span 1!important} }`
      : `@media (max-width:640px){ #${id} .g-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important; grid-auto-rows:${rowTrack}px!important} #${id} .g-cell{grid-column:span 1!important;grid-row:span 1!important} }`,
  ].join("\n");

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: maxCell
      ? `repeat(${cols}, minmax(0, ${maxCell}px))`
      : `repeat(${cols}, minmax(0, 1fr))`,
    gridAutoRows: `${rowTrack}px`,
    gridAutoFlow: "dense",
    columnGap: gapX,
    rowGap: gapY,
    justifyContent: maxCell ? "center" : undefined,
    width: "100%",
    maxWidth: maxWidth > 0 ? maxWidth : undefined,
    marginLeft: "auto",
    marginRight: "auto",
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-24">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <Reveal>
        <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
          {c.title}
        </h2>
      </Reveal>
      {images.length > 0 ? (
        <div className="g-grid mt-12" style={gridStyle}>
          {images.map((img, i) => {
            const cs = img.colSpan ?? 1;
            const rs = img.rowSpan ?? 1;
            return (
              <Reveal
                key={i}
                delay={Math.min(i * 0.04, 0.4)}
                className="g-cell"
                style={{
                  gridColumn: `span ${cs}`,
                  gridRow: `span ${rs}`,
                  minHeight: 0,
                }}
              >
                <figure className="g-item">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.caption || ""}
                    style={{
                      objectFit: normalizeObjectFit(img.objectFit),
                      objectPosition: cssObjectPosition(normalizePosX(img.posX), normalizePosY(img.posY)),
                    }}
                  />
                  {img.caption && <figcaption className="g-cap">{img.caption}</figcaption>}
                </figure>
              </Reveal>
            );
          })}
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
              <div key={i} className="relative w-full shrink-0 bg-black/10" style={{ height }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.caption || ""}
                  className="h-full w-full"
                  style={{
                    objectFit: normalizeObjectFit(img.objectFit),
                    objectPosition: cssObjectPosition(normalizePosX(img.posX), normalizePosY(img.posY)),
                  }}
                />
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

type QuoteProduct = { name: string; price: number; description?: string };
type QuoteCategory = { name: string; mode?: "multi" | "single"; products: QuoteProduct[] };

function quoteCategoriesFromContent(c: Record<string, any>): QuoteCategory[] {
  if (Array.isArray(c.categories) && c.categories.length > 0) {
    return c.categories.map((cat: any) => ({
      name: String(cat?.name ?? "Categoría"),
      mode: cat?.mode === "single" ? "single" : "multi",
      products: Array.isArray(cat?.products)
        ? cat.products.map((p: any) => ({
            name: String(p?.name ?? "Producto"),
            price: Number(p?.price) || 0,
            description: String(p?.description ?? ""),
          }))
        : [],
    }));
  }
  const options = Array.isArray(c.options) ? c.options : [];
  if (options.length > 0) {
    return [
      {
        name: "Opciones",
        mode: "multi" as const,
        products: options.map((o: any) => ({
          name: String(o?.label ?? o?.name ?? "Opción"),
          price: Number(o?.price) || 0,
          description: "",
        })),
      },
    ];
  }
  return [];
}

function QuoteSection({ section, tpl, accent, heading }: { section: Section; tpl: TemplateConfig; accent: string; heading: React.CSSProperties }) {
  const c = section.content;
  const currency = String(c.currency ?? "$");
  const base = Number(c.basePrice) || 0;
  const categories = quoteCategoriesFromContent(c);
  // qty[catIndex][productIndex] = cantidad
  const [qty, setQty] = useState<Record<string, number>>({});

  function key(ci: number, pi: number) {
    return `${ci}:${pi}`;
  }
  function getQty(ci: number, pi: number) {
    return Math.max(0, Number(qty[key(ci, pi)]) || 0);
  }
  function setProductQty(ci: number, pi: number, mode: "multi" | "single", next: number) {
    const n = Math.max(0, Math.min(99, Math.floor(next)));
    setQty((prev) => {
      const copy = { ...prev };
      if (mode === "single") {
        // Solo un producto del grupo puede tener cantidad > 0
        const cat = categories[ci];
        cat?.products.forEach((_, j) => {
          copy[key(ci, j)] = j === pi ? n : 0;
        });
      } else {
        copy[key(ci, pi)] = n;
      }
      return copy;
    });
  }

  let total = base;
  const lines: { name: string; qty: number; unit: number; sub: number }[] = [];
  categories.forEach((cat, ci) => {
    cat.products.forEach((p, pi) => {
      const q = getQty(ci, pi);
      if (q > 0) {
        const unit = Number(p.price) || 0;
        const sub = unit * q;
        total += sub;
        lines.push({ name: p.name, qty: q, unit, sub });
      }
    });
  });

  const money = (n: number) => `${currency}${n.toLocaleString("es-MX")}`;

  return (
    <div className="mx-auto max-w-2xl px-6 py-24">
      <Reveal>
        <h2 className="text-center text-3xl font-bold md:text-4xl" style={heading}>
          {c.title}
        </h2>
        {c.subtitle && <p className="mx-auto mt-3 max-w-lg text-center text-sm opacity-75">{c.subtitle}</p>}
      </Reveal>
      <Reveal delay={0.1}>
        <div className="mt-10 space-y-8 p-6 md:p-8" style={cardStyle(section, tpl)}>
          {base > 0 && (
            <p className="text-sm opacity-70">
              Precio base: <b>{money(base)}</b>
            </p>
          )}

          {categories.length === 0 && (
            <p className="text-sm opacity-50">Agrega tipos de producto y precios en el builder.</p>
          )}

          {categories.map((cat, ci) => (
            <div key={ci}>
              <h3 className="text-sm font-semibold tracking-wide opacity-80">{cat.name}</h3>
              <p className="mt-0.5 text-xs opacity-50">
                {cat.mode === "single" ? "Elige un producto" : "Puedes combinar varios y definir cantidades"}
              </p>
              <div className="mt-3 space-y-2">
                {cat.products.map((p, pi) => {
                  const q = getQty(ci, pi);
                  const mode = cat.mode === "single" ? "single" : "multi";
                  return (
                    <div
                      key={pi}
                      className={`flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${
                        q > 0 ? "border-current/30 bg-current/5" : "border-current/15"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2 sm:justify-start sm:gap-3">
                          <span className="text-sm font-medium">{p.name}</span>
                          <span className="shrink-0 text-sm font-semibold" style={{ color: accent }}>
                            {money(Number(p.price) || 0)}
                            <span className="text-xs font-normal opacity-60"> c/u</span>
                          </span>
                        </div>
                        {p.description ? <p className="mt-0.5 text-xs opacity-60">{p.description}</p> : null}
                      </div>
                      <div className="flex items-center gap-2">
                        {mode === "single" ? (
                          <label className="flex cursor-pointer items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`quote-cat-${section.id}-${ci}`}
                              checked={q > 0}
                              onChange={() => setProductQty(ci, pi, "single", 1)}
                            />
                            <span className="opacity-70">Elegir</span>
                            {q > 0 && (
                              <button
                                type="button"
                                className="text-xs opacity-50 underline"
                                onClick={() => setProductQty(ci, pi, "single", 0)}
                              >
                                Quitar
                              </button>
                            )}
                          </label>
                        ) : (
                          <div className="flex items-center rounded-lg border border-current/20">
                            <button
                              type="button"
                              aria-label="Menos"
                              className="px-3 py-1.5 text-lg leading-none opacity-70 hover:opacity-100 disabled:opacity-30"
                              disabled={q <= 0}
                              onClick={() => setProductQty(ci, pi, "multi", q - 1)}
                            >
                              −
                            </button>
                            <span className="min-w-[2rem] text-center text-sm font-semibold tabular-nums">{q}</span>
                            <button
                              type="button"
                              aria-label="Más"
                              className="px-3 py-1.5 text-lg leading-none opacity-70 hover:opacity-100"
                              onClick={() => setProductQty(ci, pi, "multi", q + 1)}
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {lines.length > 0 && (
            <ul className="space-y-1 border-t border-current/10 pt-4 text-xs opacity-70">
              {base > 0 && (
                <li className="flex justify-between">
                  <span>Precio base</span>
                  <span>{money(base)}</span>
                </li>
              )}
              {lines.map((l, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>
                    {l.name} ×{l.qty}
                  </span>
                  <span>{money(l.sub)}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between border-t border-current/10 pt-4">
            <span className="font-semibold">Total estimado</span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: accent }}>
              {money(total)}
            </span>
          </div>
        </div>
      </Reveal>
    </div>
  );
}
