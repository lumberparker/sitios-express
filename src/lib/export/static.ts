// Generador de exportación estática: SiteConfig → { archivo: contenido }.
// Produce HTML/CSS/JS puro, sin dependencias, listo para cualquier hosting.
// Convención de clases: BEM (bloque__elemento--modificador, estados .is-*).
// Las imágenes subidas (/uploads/...) se reescriben a assets/ y el endpoint
// de export las incluye en el .zip.

import type { SiteConfig, Section, TemplateConfig } from "@/lib/site-config";
import { SECTION_LABELS, businessWhatsAppUrl, cardRadiusPx, effectiveFonts, resolveCtaLink } from "@/lib/site-config";

const ROUNDED: Record<string, string> = { none: "0", md: "10px", xl: "20px", full: "32px" };

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "pagina"
  );
}

// Imágenes subidas: en dev viven en /uploads/, en producción en Vercel Blob.
// Ambas se reescriben a assets/ y el endpoint de export las mete al .zip
// para que el sitio descargado sea autocontenido.
const BLOB_URL_RE = /^https:\/\/[^/]+\.public\.blob\.vercel-storage\.com\//;

export function isUploadedAsset(url: string): boolean {
  return url.startsWith("/uploads/") || BLOB_URL_RE.test(url);
}

/** /uploads/foo.png o URL de Blob → assets/foo.png */
export function assetPath(url: string): string {
  if (!isUploadedAsset(url)) return url;
  return `assets/${url.split("/").pop()}`;
}

export function collectUploads(config: SiteConfig): string[] {
  const urls = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string" && isUploadedAsset(v)) urls.add(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(config);
  return [...urls];
}

type ExtraPage = { title: string; content: string; file: string };

function extraPages(config: SiteConfig): ExtraPage[] {
  const entry = config.widgets.find((w) => w.widgetId === "pagina-adicional");
  const pages: { title: string; content: string }[] = (entry?.config as any)?.pages ?? [];
  return pages
    .filter((p) => p.title || p.content)
    .map((p, i) => ({
      title: p.title || `Página ${i + 1}`,
      content: p.content || "",
      file: `${slugify(p.title || `pagina-${i + 1}`)}.html`,
    }));
}

function bgStyle(section: Section, tpl: TemplateConfig, index: number): string {
  const bg = section.style.background;
  let css = "";
  if (bg.type === "image" && bg.value) {
    css = `background:${bg.overlay ? `linear-gradient(${bg.overlay}, ${bg.overlay}),` : ""}url('${assetPath(bg.value)}') center/cover;`;
  } else if (bg.value) {
    css = `background:${bg.value};`;
  } else if (section.type === "hero") {
    const hb = tpl.heroBackground;
    if (hb.type === "image" && hb.value) {
      css = `background:${hb.overlay ? `linear-gradient(${hb.overlay}, ${hb.overlay}),` : ""}url('${assetPath(hb.value)}') center/cover;`;
    } else {
      css = `background:${hb.value};`;
    }
  } else {
    css = `background:${index % 2 === 0 ? "var(--bg)" : "var(--surface)"};`;
  }
  if (section.style.textColor) css += `color:${section.style.textColor};`;
  return css;
}

function cardVars(section: Section): string {
  const c = section.style.card;
  return `--card-radius:${cardRadiusPx(c)}px;--card-shadow:${c.shadow ? "0 12px 32px rgba(0,0,0,.12)" : "none"};--card-border:${
    c.border ? "1px solid color-mix(in srgb, var(--accent) 25%, transparent)" : "none"
  };${section.style.accentColor ? `--accent:${section.style.accentColor};` : ""}`;
}

function renderSection(section: Section, tpl: TemplateConfig, index: number, config: SiteConfig): string {
  const c = section.content;
  const attrs = `id="${section.id}" style="${bgStyle(section, tpl, index)}${cardVars(section)}"`;

  switch (section.type) {
    case "hero": {
      const ctaHref = resolveCtaLink(c.ctaLink, config);
      const ctaTarget = ctaHref.startsWith("http") ? ` target="_blank" rel="noreferrer"` : "";
      return `<section ${attrs} class="hero">
  <div class="container hero__inner reveal">
    <h1 class="hero__title">${esc(c.title)}</h1>
    <p class="hero__subtitle">${esc(c.subtitle)}</p>
    ${String(c.ctaText ?? "").trim() ? `<a class="button hero__cta" href="${esc(ctaHref)}"${ctaTarget}>${esc(String(c.ctaText).trim())}</a>` : ""}
  </div>
</section>`;
    }

    case "about":
      return `<section ${attrs} class="about">
  <div class="container about__grid">
    <div class="about__text reveal">
      <h2 class="section__title">${esc(c.title)}</h2><div class="section__rule"></div>
      <p class="about__prose">${esc(c.text)}</p>
    </div>
    ${c.imageUrl ? `<img class="about__image reveal" src="${assetPath(c.imageUrl)}" alt="${esc(c.title)}">` : ""}
  </div>
</section>`;

    case "products":
      return `<section ${attrs} class="products">
  <div class="container">
    <h2 class="section__title section__title--center reveal">${esc(c.title)}</h2>
    <div class="cards">
      ${(c.items ?? [])
        .map(
          (item: any) => `<article class="card reveal">
        ${item.imageUrl ? `<img class="card__image" src="${assetPath(item.imageUrl)}" alt="${esc(item.name)}">` : `<div class="card__placeholder"></div>`}
        <div class="card__body">
          <h3 class="card__title">${esc(item.name)}</h3>
          <p class="card__text">${esc(item.description)}</p>
          ${item.price ? `<p class="card__price">${esc(item.price)}</p>` : ""}
        </div>
      </article>`
        )
        .join("\n")}
    </div>
  </div>
</section>`;

    case "testimonials":
      return `<section ${attrs} class="testimonials">
  <div class="container">
    <h2 class="section__title section__title--center reveal">${esc(c.title)}</h2>
    <div class="cards cards--two">
      ${(c.items ?? [])
        .map(
          (t: any) => `<figure class="card card__body testimonial reveal">
        <div class="testimonial__mark">“</div>
        <blockquote class="testimonial__text">${esc(t.text)}</blockquote>
        <figcaption class="testimonial__author"><b>${esc(t.name)}</b>${t.role ? ` · <span>${esc(t.role)}</span>` : ""}</figcaption>
      </figure>`
        )
        .join("\n")}
    </div>
  </div>
</section>`;

    case "gallery": {
      const cols = Math.min(10, Math.max(2, Number(c.columns) || 3));
      const images: { url: string; caption?: string }[] = ((c.images as any[]) ?? [])
        .map((i: any) => (typeof i === "string" ? { url: i } : i))
        .filter((i: any) => i?.url)
        .slice(0, cols * cols);
      const gapX = Number(c.gapX ?? 12);
      const gapY = Number(c.gapY ?? 12);
      const borderWidth = Number(c.borderWidth ?? 0);
      const borderColor = c.borderColor || "#ffffff";
      const fx = ["zoom", "lift", "gray", "dark"].includes(c.hoverEffect) ? c.hoverEffect : c.hoverEffect === "none" ? "none" : "zoom";
      const cap = ["none", "always"].includes(c.captionMode) ? c.captionMode : "hover";
      const radius = Number(c.radius ?? 16);
      const gridStyle = `grid-template-columns:repeat(${cols},1fr);column-gap:${gapX}px;row-gap:${gapY}px;`;
      const imgStyle = ` style="border-radius:${radius}px;${borderWidth ? `border:${borderWidth}px solid ${borderColor};` : ""}"`;
      return `<section ${attrs} class="gallery-section">
  <div class="container">
    <h2 class="section__title section__title--center reveal">${esc(c.title)}</h2>
    <div class="gallery gallery--fx-${fx} gallery--cap-${cap}" style="${gridStyle}">
      ${images
        .map(
          (img) => `<figure class="gallery__item reveal" style="border-radius:${radius}px">
        <img class="gallery__image" src="${assetPath(img.url)}" alt="${esc(img.caption ?? "")}" loading="lazy"${imgStyle}>
        ${img.caption ? `<figcaption class="gallery__caption" style="border-radius:0 0 ${radius}px ${radius}px">${esc(img.caption)}</figcaption>` : ""}
      </figure>`
        )
        .join("\n")}
    </div>
  </div>
</section>`;
    }

    case "carousel": {
      const images: { url: string; caption?: string }[] = ((c.images as any[]) ?? [])
        .map((i: any) => (typeof i === "string" ? { url: i } : i))
        .filter((i: any) => i?.url)
        .slice(0, 15);
      if (images.length === 0) return "";
      const interval = Math.min(10, Math.max(2, Number(c.interval) || 4)) * 1000;
      const height = Math.min(640, Math.max(200, Number(c.height) || 400));
      const radius = Number(c.radius ?? 16);
      return `<section ${attrs} class="carousel-section">
  <div class="container">
    ${c.title ? `<h2 class="section__title section__title--center reveal">${esc(c.title)}</h2>` : ""}
    <div class="carousel reveal" data-carousel data-interval="${interval}" style="border-radius:${radius}px">
      <div class="carousel__track">
        ${images
          .map(
            (img) => `<div class="carousel__slide" style="height:${height}px">
          <img class="carousel__image" src="${assetPath(img.url)}" alt="${esc(img.caption ?? "")}" loading="lazy">
          ${img.caption ? `<p class="carousel__caption">${esc(img.caption)}</p>` : ""}
        </div>`
          )
          .join("\n")}
      </div>
      ${
        images.length > 1
          ? `<button class="carousel__arrow carousel__arrow--prev" aria-label="Anterior">‹</button>
      <button class="carousel__arrow carousel__arrow--next" aria-label="Siguiente">›</button>
      <div class="carousel__dots">
        ${images.map((_, i) => `<button class="carousel__dot${i === 0 ? " is-active" : ""}" aria-label="Foto ${i + 1}"></button>`).join("\n        ")}
      </div>`
          : ""
      }
    </div>
  </div>
</section>`;
    }

    case "map":
      return `<section ${attrs} class="map">
  <div class="container container--center">
    <h2 class="section__title reveal">${esc(c.title)}</h2>
    ${c.address ? `<p class="section__lead">${esc(c.address)}</p>` : ""}
    ${c.embedUrl ? `<iframe class="map__frame reveal" src="${esc(c.embedUrl)}" loading="lazy" title="Mapa"></iframe>` : ""}
  </div>
</section>`;

    case "faq":
      return `<section ${attrs} class="faq">
  <div class="container container--narrow">
    <h2 class="section__title section__title--center reveal">${esc(c.title)}</h2>
    ${(c.items ?? [])
      .map(
        (f: any) => `<details class="card card__body faq__item reveal">
      <summary class="faq__question"><span class="faq__plus">+</span>${esc(f.q)}</summary>
      <p class="faq__answer">${esc(f.a)}</p>
    </details>`
      )
      .join("\n")}
  </div>
</section>`;

    case "contact":
      return `<section ${attrs} class="contact">
  <div class="container container--narrow">
    <h2 class="section__title section__title--center reveal">${esc(c.title)}</h2>
    ${c.subtitle ? `<p class="section__lead section__lead--center">${esc(c.subtitle)}</p>` : ""}
    <form class="card card__body form reveal" onsubmit="event.preventDefault();alert('¡Gracias! Te contactaremos pronto.')">
      <input class="form__input" required placeholder="Tu nombre">
      <input class="form__input" required type="email" placeholder="Tu correo">
      <textarea class="form__textarea" rows="4" placeholder="Mensaje"></textarea>
      <button class="button form__submit" type="submit">Enviar mensaje</button>
    </form>
  </div>
</section>`;

    case "quote": {
      const options: any[] = c.options ?? [];
      return `<section ${attrs} class="quote">
  <div class="container container--narrow">
    <h2 class="section__title section__title--center reveal">${esc(c.title)}</h2>
    <div class="card card__body quote__box reveal" data-quote data-base="${Number(c.basePrice) || 0}">
      <p class="quote__base">Precio base: $${Number(c.basePrice) || 0}</p>
      ${options
        .map(
          (o: any) => `<label class="quote__option"><span class="quote__option-label"><input type="checkbox" data-price="${Number(o.price) || 0}"> ${esc(o.label)}</span><b class="quote__option-price">+$${Number(o.price) || 0}</b></label>`
        )
        .join("\n")}
      <div class="quote__total"><span>Total estimado</span><span class="quote__total-amount" data-total>$${Number(c.basePrice) || 0}</span></div>
    </div>
  </div>
</section>`;
    }

    default:
      return "";
  }
}

function headerHtml(config: SiteConfig, sections: Section[], pages: ExtraPage[], onSubpage: boolean): string {
  const prefix = onSubpage ? "index.html" : "";
  const navLinks = [
    ...sections.filter((s) => s.inMenu).map((s) => ({
      href: `${prefix}#${s.id}`,
      label: (s.content.title as string) || SECTION_LABELS[s.type],
    })),
    ...pages.map((p) => ({ href: p.file, label: p.title })),
  ];
  const links = () => navLinks.map((l) => `<a class="nav__link" href="${esc(l.href)}">${esc(l.label)}</a>`).join(`\n        `);

  const showName = config.business.showNameInHeader !== false || !config.business.logoUrl;
  const logo =
    (config.business.logoUrl
      ? `<img src="${assetPath(config.business.logoUrl)}" alt="${esc(config.business.name)}" class="header__logo">`
      : "") + (showName ? `<span class="header__logo-text">${esc(config.business.name)}</span>` : "");

  return `<header class="header">
    <div class="container header__inner">
      <a class="header__brand" href="${onSubpage ? "index.html" : "#"}">${logo}</a>
      <nav class="nav nav--desktop">
        ${links()}
      </nav>
      <button class="header__burger" aria-label="Abrir menú" aria-expanded="false">
        <span class="header__burger-line"></span><span class="header__burger-line"></span><span class="header__burger-line"></span>
      </button>
    </div>
    <nav class="nav nav--mobile">
      ${links()}
    </nav>
  </header>`;
}

function footerHtml(config: SiteConfig): string {
  const social = Object.entries(config.social)
    .filter(([, url]) => url)
    .map(([net, url]) => `<a class="footer__social-link" href="${esc(url)}" target="_blank" rel="noreferrer">${net}</a>`)
    .join("\n        ");
  return `<footer class="footer">
    <div class="container footer__inner">
      <div class="footer__info">
        <p class="footer__name">${esc(config.business.name)}</p>
        ${config.business.address ? `<p>${esc(config.business.address)}</p>` : ""}
        ${config.business.email ? `<p>${esc(config.business.email)}</p>` : ""}
        ${config.business.phone ? `<p>${esc(config.business.phone)}</p>` : ""}
      </div>
      <div class="footer__social">
        ${social}
      </div>
      <p class="footer__copyright">© ${new Date().getFullYear()} ${esc(config.business.name)}</p>
    </div>
  </footer>`;
}

function whatsappHtml(config: SiteConfig): string {
  if (!config.whatsapp.enabled) return "";
  const href = businessWhatsAppUrl(config);
  if (!href) return "";
  return `<a class="wa-button" aria-label="WhatsApp" target="_blank" rel="noreferrer" href="${esc(href)}">
    <svg viewBox="0 0 32 32" width="30" height="30" fill="#fff" aria-hidden="true"><path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.8 5 2.3 7L4.5 28l6.3-1.7c1.6.9 3.4 1.3 5.2 1.3 6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-1.6 0-3.2-.4-4.6-1.2l-.3-.2-3.7 1 1-3.6-.2-.3c-1.3-1.7-2-3.7-2-5.7C6.2 9.5 10.6 5.2 16 5.2s9.8 4.3 9.8 9.7-4.4 9.9-9.8 9.9zm5.4-7.3c-.3-.1-1.7-.9-2-1s-.5-.1-.7.1c-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1s-1.2-.5-2.4-1.5c-.9-.8-1.5-1.8-1.6-2-.2-.3 0-.5.1-.6l.4-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c-.1-.1-.7-1.6-.9-2.2-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4z"/></svg>
  </a>`;
}

function htmlShell(config: SiteConfig, tpl: TemplateConfig, title: string, body: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(config.business.tagline || config.business.name)}">
  ${config.business.faviconUrl ? `<link rel="icon" type="image/png" href="${assetPath(config.business.faviconUrl)}">` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${tpl.fonts.googleUrl}" rel="stylesheet">
  <link rel="stylesheet" href="styles.css">
</head>
<body>
${body}
  <script src="script.js"></script>
</body>
</html>`;
}

export function generateStaticSite(config: SiteConfig, tplBase: TemplateConfig): Record<string, string> {
  // Tipografía: overrides del usuario (config.theme) sobre la del template
  const tpl: TemplateConfig = { ...tplBase, fonts: effectiveFonts(config, tplBase) };
  const sections = [...config.sections].sort((a, b) => a.order - b.order);
  const pages = extraPages(config);

  const indexBody = `  ${headerHtml(config, sections, pages, false)}

${sections.map((s, i) => renderSection(s, tpl, i, config)).join("\n\n")}

  ${footerHtml(config)}

  ${whatsappHtml(config)}`;

  const files: Record<string, string> = {
    "index.html": htmlShell(config, tpl, config.business.name, indexBody),
  };

  // Páginas adicionales (widget "pagina-adicional")
  for (const page of pages) {
    const body = `  ${headerHtml(config, sections, pages, true)}

<section class="page">
  <div class="container container--narrow">
    <h1 class="page__title reveal">${esc(page.title)}</h1>
    <div class="page__content reveal">${esc(page.content).replace(/\n/g, "<br>")}</div>
  </div>
</section>

  ${footerHtml(config)}

  ${whatsappHtml(config)}`;
    files[page.file] = htmlShell(config, tpl, `${page.title} — ${config.business.name}`, body);
  }

  files["styles.css"] = buildCss(config, tpl);
  files["script.js"] = buildJs();
  return files;
}

function buildCss(config: SiteConfig, tpl: TemplateConfig): string {
  return `/* ${esc(config.business.name)} — generado por Sitios Web Express
   Convención de clases: BEM (bloque__elemento--modificador, estados .is-*) */
:root {
  --primary: ${tpl.palette.primary};
  --secondary: ${tpl.palette.secondary};
  --bg: ${tpl.palette.background};
  --surface: ${tpl.palette.surface};
  --text: ${tpl.palette.text};
  --muted: ${tpl.palette.muted};
  --accent: ${tpl.palette.primary};
  --font-heading: '${tpl.fonts.heading}', serif;
  --font-body: '${tpl.fonts.body}', system-ui, sans-serif;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { font-family: var(--font-body); background: var(--bg); color: var(--text); line-height: 1.6; }
img { max-width: 100%; display: block; }
h1, h2, h3 { font-family: var(--font-heading); line-height: 1.15; letter-spacing: -0.01em; }
section { padding: 6rem 0; }

/* Layout */
.container { max-width: 1100px; margin: 0 auto; padding: 0 1.5rem; }
.container--narrow { max-width: 720px; }
.container--center { text-align: center; }

/* Bloque: section (títulos comunes) */
.section__title { font-size: clamp(1.8rem, 4vw, 2.6rem); }
.section__title--center { text-align: center; }
.section__lead { font-size: 1.15rem; opacity: .8; max-width: 42rem; margin: 1.2rem auto 0; }
.section__lead--center { text-align: center; }
.section__rule { width: 64px; height: 4px; border-radius: 2px; background: var(--accent); margin-top: .6rem; }

/* Bloque: button */
.button { display: inline-block; padding: 1rem 2.6rem; border: 0; border-radius: 999px; background: var(--accent); color: #fff; font-family: var(--font-body); font-size: 1.05rem; font-weight: 600; text-decoration: none; cursor: pointer; box-shadow: 0 10px 30px color-mix(in srgb, var(--accent) 35%, transparent); transition: transform .2s; }
.button:hover, .button:focus-visible { transform: scale(1.05); }

/* Bloque: header */
.header { position: sticky; top: 0; z-index: 40; background: color-mix(in srgb, var(--bg) 90%, transparent); backdrop-filter: blur(10px); border-bottom: 1px solid color-mix(in srgb, var(--text) 8%, transparent); }
.header__inner { display: flex; align-items: center; justify-content: space-between; padding-top: .9rem; padding-bottom: .9rem; }
.header__brand { text-decoration: none; }
.header__logo { height: 42px; width: auto; object-fit: contain; }
.header__logo-text { font-family: var(--font-heading); font-weight: 700; font-size: 1.2rem; color: var(--primary); }
.header__burger { display: none; background: none; border: 0; cursor: pointer; width: 42px; height: 42px; flex-direction: column; align-items: center; justify-content: center; gap: 5px; }
.header__burger-line { width: 24px; height: 2px; background: var(--text); transition: transform .3s, opacity .3s; }
.header__burger[aria-expanded="true"] .header__burger-line:nth-child(1) { transform: translateY(7px) rotate(45deg); }
.header__burger[aria-expanded="true"] .header__burger-line:nth-child(2) { opacity: 0; }
.header__burger[aria-expanded="true"] .header__burger-line:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }

/* Bloque: nav */
.nav--desktop { display: flex; gap: 1.6rem; }
.nav__link { color: var(--text); text-decoration: none; font-size: .92rem; font-weight: 500; opacity: .8; transition: opacity .2s; }
.nav__link:hover, .nav__link:focus-visible { opacity: 1; }
.nav--mobile { display: none; flex-direction: column; background: var(--surface); max-height: 0; overflow: hidden; transition: max-height .35s ease; }
.nav--mobile.is-open { max-height: 420px; }
.nav--mobile .nav__link { padding: .9rem 1.5rem; border-top: 1px solid color-mix(in srgb, var(--text) 6%, transparent); }
@media (max-width: 768px) {
  .nav--desktop { display: none; }
  .header__burger { display: flex; }
  .nav--mobile { display: flex; }
  section { padding: 4rem 0; }
}

/* Bloque: hero */
.hero { padding: 9rem 0; }
.hero__inner { text-align: center; }
.hero__title { font-size: clamp(2.5rem, 7vw, 4.5rem); }
.hero__subtitle { font-size: 1.15rem; opacity: .8; max-width: 42rem; margin: 1.2rem auto 0; }
.hero__cta { margin-top: 2.2rem; }

/* Bloque: about */
.about__grid { display: grid; gap: 3rem; align-items: center; }
@media (min-width: 768px) { .about__grid { grid-template-columns: 1fr 1fr; } }
.about__prose { margin-top: 1.4rem; white-space: pre-line; opacity: .88; }
.about__image { border-radius: 24px; object-fit: cover; max-height: 420px; width: 100%; }

/* Bloque: cards / card */
.cards { display: grid; gap: 2rem; margin-top: 3rem; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); }
.cards--two { grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.card { background: var(--surface); color: var(--text); border-radius: var(--card-radius, 20px); box-shadow: var(--card-shadow); border: var(--card-border); overflow: hidden; transition: transform .25s; }
.card:hover { transform: translateY(-4px); }
.card__image { height: 180px; width: 100%; object-fit: cover; }
.card__placeholder { height: 180px; background: linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, transparent), color-mix(in srgb, var(--accent) 35%, transparent)); }
.card__body { padding: 1.6rem; }
.card__title { font-size: 1.15rem; }
.card__text { margin-top: .5rem; font-size: .92rem; opacity: .78; }
.card__price { margin-top: 1rem; font-size: 1.3rem; font-weight: 700; color: var(--accent); }

/* Bloque: testimonial */
.testimonial__mark { font-size: 2.6rem; line-height: 1; color: var(--accent); }
.testimonial__text { font-style: italic; opacity: .88; }
.testimonial__author { margin-top: 1rem; font-size: .9rem; }

/* Bloque: gallery (cuadrícula, espaciados y borde van inline desde el builder) */
.gallery { display: grid; margin-top: 3rem; }
.gallery__item { position: relative; overflow: hidden; border-radius: 16px; margin: 0; }
.gallery__image { aspect-ratio: 1; width: 100%; object-fit: cover; display: block; border-radius: 16px; transition: transform .35s ease, filter .35s ease; }
.gallery__caption { position: absolute; left: 0; right: 0; bottom: 0; padding: .9rem; color: #fff; font-size: .85rem; background: linear-gradient(transparent, rgba(0,0,0,.75)); border-radius: 0 0 16px 16px; transition: opacity .3s; }
/* Modificadores: texto sobre la imagen */
.gallery--cap-hover .gallery__caption { opacity: 0; }
.gallery--cap-hover .gallery__item:hover .gallery__caption { opacity: 1; }
.gallery--cap-none .gallery__caption { display: none; }
/* Modificadores: efecto hover */
.gallery--fx-zoom .gallery__item:hover .gallery__image { transform: scale(1.07); }
.gallery--fx-lift .gallery__item { transition: transform .3s, box-shadow .3s; }
.gallery--fx-lift .gallery__item:hover { transform: translateY(-6px); box-shadow: 0 16px 32px rgba(0,0,0,.25); }
.gallery--fx-gray .gallery__image { filter: grayscale(1); }
.gallery--fx-gray .gallery__item:hover .gallery__image { filter: grayscale(0); }
.gallery--fx-dark .gallery__image { filter: brightness(.72); }
.gallery--fx-dark .gallery__item:hover .gallery__image { filter: brightness(1); }
@media (max-width: 640px) { .gallery { grid-template-columns: repeat(2, 1fr) !important; } }

/* Bloque: carousel (autoplay via script.js) */
.carousel { position: relative; overflow: hidden; margin-top: 2rem; }
.carousel__track { display: flex; transition: transform .7s ease; }
.carousel__slide { position: relative; min-width: 100%; }
.carousel__image { width: 100%; height: 100%; object-fit: cover; display: block; }
.carousel__caption { position: absolute; left: 0; right: 0; bottom: 0; padding: 1.2rem; color: #fff; font-size: .9rem; background: linear-gradient(transparent, rgba(0,0,0,.75)); }
.carousel__arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,.4); color: #fff; border: 0; border-radius: 999px; padding: .4rem .8rem; font-size: 1.2rem; cursor: pointer; transition: background .2s; }
.carousel__arrow:hover { background: rgba(0,0,0,.6); }
.carousel__arrow--prev { left: .8rem; }
.carousel__arrow--next { right: .8rem; }
.carousel__dots { position: absolute; left: 0; right: 0; bottom: .6rem; display: flex; justify-content: center; gap: .4rem; }
.carousel__dot { width: 8px; height: 8px; border-radius: 999px; border: 0; padding: 0; background: rgba(255,255,255,.45); cursor: pointer; transition: all .25s; }
.carousel__dot.is-active { width: 16px; background: #fff; }
@media (max-width: 640px) { .carousel__slide { height: 240px !important; } }

/* Bloque: map */
.map__frame { width: 100%; height: 380px; border: 0; border-radius: 20px; margin-top: 2rem; }

/* Bloque: faq */
.faq__item { margin-top: 1rem; }
.faq__question { cursor: pointer; font-weight: 600; list-style: none; }
.faq__plus { color: var(--accent); margin-right: .5rem; }
.faq__answer { margin-top: .8rem; }

/* Bloque: form */
.form { display: grid; gap: 1rem; margin-top: 2.5rem; }
.form__input, .form__textarea { width: 100%; padding: .85rem 1rem; border-radius: 10px; border: 1px solid color-mix(in srgb, var(--text) 20%, transparent); background: transparent; color: inherit; font-family: inherit; font-size: .95rem; }
.form__input:focus, .form__textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
.form__submit { margin-top: .4rem; width: 100%; }

/* Bloque: quote (cotizador) */
.quote__box { margin-top: 2.5rem; }
.quote__base { color: var(--muted); font-size: .9rem; }
.quote__option { display: flex; justify-content: space-between; align-items: center; padding: .8rem 1rem; margin-top: .7rem; border: 1px solid color-mix(in srgb, var(--text) 14%, transparent); border-radius: 10px; cursor: pointer; font-size: .95rem; }
.quote__total { display: flex; justify-content: space-between; align-items: center; margin-top: 1.4rem; padding-top: 1rem; border-top: 1px solid color-mix(in srgb, var(--text) 10%, transparent); font-weight: 600; }
.quote__total-amount { font-size: 1.5rem; font-weight: 700; color: var(--accent); }

/* Bloque: page (páginas adicionales) */
.page { min-height: 55vh; }
.page__title { font-size: clamp(2rem, 5vw, 3.2rem); }
.page__content { margin-top: 1.6rem; opacity: .88; }

/* Bloque: footer */
.footer { background: color-mix(in srgb, var(--text) 92%, black); color: var(--bg); font-size: .9rem; }
.footer__inner { display: flex; flex-direction: column; align-items: center; gap: 1.4rem; padding: 3rem 1.5rem; text-align: center; }
@media (min-width: 768px) { .footer__inner { flex-direction: row; justify-content: space-between; text-align: left; } }
.footer__name { font-family: var(--font-heading); font-weight: 700; font-size: 1.05rem; }
.footer__social { display: flex; gap: 1.2rem; }
.footer__social-link { color: inherit; text-transform: capitalize; }
.footer__copyright { opacity: .6; }

/* Bloque: wa-button (WhatsApp flotante) */
.wa-button { position: fixed; bottom: 1.5rem; right: 1.5rem; z-index: 50; width: 56px; height: 56px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #25D366; box-shadow: 0 8px 24px rgba(0,0,0,.3); transition: transform .2s; }
.wa-button:hover { transform: scale(1.1); }

/* Utilidad: reveal (animación al hacer scroll) */
.reveal { opacity: 0; transform: translateY(24px); transition: opacity .6s ease, transform .6s ease; }
.reveal.is-visible { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .reveal { opacity: 1; transform: none; transition: none; } }
`;
}

function buildJs(): string {
  return `// Interacciones — generado por Sitios Web Express (clases BEM)
(function () {
  // Menú hamburguesa
  var burger = document.querySelector('.header__burger');
  var mobileNav = document.querySelector('.nav--mobile');
  if (burger && mobileNav) {
    burger.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
    mobileNav.querySelectorAll('.nav__link').forEach(function (a) {
      a.addEventListener('click', function () {
        mobileNav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Animaciones al hacer scroll
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); }
    });
  }, { rootMargin: '-60px' });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });

  // Carruseles con autoplay
  document.querySelectorAll('[data-carousel]').forEach(function (root) {
    var track = root.querySelector('.carousel__track');
    var slides = root.querySelectorAll('.carousel__slide');
    var dots = root.querySelectorAll('.carousel__dot');
    if (!track || slides.length < 2) return;
    var idx = 0;
    var interval = Number(root.getAttribute('data-interval')) || 4000;
    var timer;
    function go(i) {
      idx = (i + slides.length) % slides.length;
      track.style.transform = 'translateX(-' + idx * 100 + '%)';
      dots.forEach(function (d, j) { d.classList.toggle('is-active', j === idx); });
    }
    function play() { timer = setInterval(function () { go(idx + 1); }, interval); }
    function reset() { clearInterval(timer); play(); }
    var prev = root.querySelector('.carousel__arrow--prev');
    var next = root.querySelector('.carousel__arrow--next');
    if (prev) prev.addEventListener('click', function () { go(idx - 1); reset(); });
    if (next) next.addEventListener('click', function () { go(idx + 1); reset(); });
    dots.forEach(function (d, j) { d.addEventListener('click', function () { go(j); reset(); }); });
    root.addEventListener('mouseenter', function () { clearInterval(timer); });
    root.addEventListener('mouseleave', play);
    play();
  });

  // Calculadora de cotización
  document.querySelectorAll('[data-quote]').forEach(function (box) {
    var base = Number(box.getAttribute('data-base')) || 0;
    var total = box.querySelector('[data-total]');
    function recalc() {
      var sum = base;
      box.querySelectorAll('input[type=checkbox]:checked').forEach(function (cb) {
        sum += Number(cb.getAttribute('data-price')) || 0;
      });
      if (total) total.textContent = '$' + sum;
    }
    box.querySelectorAll('input[type=checkbox]').forEach(function (cb) { cb.addEventListener('change', recalc); });
  });
})();
`;
}
