# Sitios Web Express

SaaS donde un cliente captura la información de su negocio, elige un template, personaliza secciones y widgets, ve su factura en tiempo real y descarga su sitio como HTML/CSS/JS estático en un `.zip`.

## Stack

- **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Framer Motion.** El backend son API routes de Next.js: un solo deploy, tipos compartidos entre cliente y servidor, y Prisma corre en el mismo proceso — un backend Express separado no aporta nada a esta escala.
- **PostgreSQL + Prisma.** La config de cada sitio es un documento JSONB (`Site.config`) validado con Zod — fuente de verdad única para el preview y el exportador. `SiteVersion` guarda el historial.
- **Sin cuentas para clientes.** Cada sitio se accede con su `editKey`: una URL secreta (`/builder/<key>`) que funciona como llave de edición. NextAuth (credenciales + JWT) protege únicamente `/superadmin`.
- **Imágenes:** en dev se guardan en `public/uploads/` vía `/api/upload` (el contrato no cambia al migrar a S3/Cloudinary). El favicon se genera automáticamente del logo con `sharp`.
- **Exportación:** `src/lib/export/static.ts` genera HTML/CSS/JS puro sin dependencias, empaquetado con JSZip, listo para cualquier hosting.

## Arranque

```bash
brew services start postgresql@16   # si no está corriendo
npm install
npx prisma db push && npm run db:seed
npm run dev                          # http://localhost:3000
```

Super admin sembrado: `rodney@berriesandmango.com` / `superadmin123` (**cámbiala**). Panel en `/superadmin`.

## Estructura

```
prisma/                 esquema + seed (templates, widgets, super admin)
src/
  lib/
    site-config.ts      Zod schema del JSON del sitio (fuente de verdad)
    pricing.ts          cálculo de factura (line items + total)
    export/static.ts    generador HTML/CSS/JS estático
    payments.ts         stub de Stripe (fase futura)
    auth.ts, prisma.ts, superadmin.ts
  components/
    ui.tsx              primitivas estilo shadcn
    site/SiteRenderer.tsx  renderiza SiteConfig (preview + builder)
  app/
    page.tsx            landing
    (auth)/login, (auth)/register
    onboarding/         wizard 3 pasos + selección de template (sin registro)
    builder/[key]/      editor + factura en vivo + pagar (acceso por editKey)
    preview/[key]/      vista previa del sitio
    superadmin/         CRUD widgets/templates, sitios, ingresos (con login)
    api/                auth, register, upload, sites, superadmin
  middleware.ts         protección por rol
```

## Flujo

1. `/onboarding` (sin registro): negocio + logo → contacto + WhatsApp → template → redirige a `/builder/<editKey>`.
2. `/builder/<editKey>`: secciones (contenido, fondo sólido/degradado/imagen, colores, estilo de tarjetas), widgets con precio (toggle), factura lateral en tiempo real, descarga `.zip` y botón **Pagar** (placeholder: registra el pedido; Stripe se conecta en `src/lib/payments.ts`). El enlace es la llave de acceso: el cliente lo guarda y puede volver, editar y pagar cuando quiera.
3. `/superadmin` (con login): CRUD de widgets/templates y precios, listado de todos los sitios con contacto, estado y total, reporte de ingresos.

## Onboarding por WhatsApp (wapisimo.dev)

El cliente puede llenar el formulario de onboarding conversando por WhatsApp:

1. Configura `WAPISIMO_API_KEY`, `WAPISIMO_PHONE_ID` y `WAPISIMO_WEBHOOK_SECRET` en `.env`.
2. Registra el webhook: `POST https://api.wapisimo.dev/v1/{phone_id}/webhook` con `{"url": "https://<dominio>/api/webhooks/wapisimo?secret=<WAPISIMO_WEBHOOK_SECRET>"}` (en local, expón el puerto con ngrok o similar).
3. El bot ([onboarding-bot.ts](src/lib/whatsapp/onboarding-bot.ts)) pregunta nombre → eslogan → correo → dirección → número de WhatsApp → template, crea el sitio y responde con su enlace privado `/builder/<editKey>`. Comandos: `saltar`, `reiniciar`.

Sin credenciales de wapisimo el bot corre en modo dev: las respuestas se loguean y el webhook las devuelve en el JSON, así se prueba con `curl`.

## Pendiente (por diseño)

- Pasarela de pago real (stub listo), hosting automático, multi-idioma del builder.
