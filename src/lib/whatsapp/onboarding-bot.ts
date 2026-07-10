// Bot de onboarding por WhatsApp: máquina de estados que llena el mismo
// formulario del onboarding web, pregunta por pregunta. Al terminar crea el
// sitio (sin dueño) y envía un enlace de reclamo para editarlo en el builder.

import { prisma } from "@/lib/prisma";
import { createOnboardedSite } from "@/lib/sites";

type BotData = {
  businessName?: string;
  tagline?: string;
  email?: string;
  address?: string;
  whatsappNumber?: string;
};

const SKIP_WORDS = new Set(["saltar", "skip", "no", "omitir", "ninguno", "ninguna"]);
const RESET_WORDS = new Set(["reiniciar", "reset", "empezar", "cancelar"]);

function isSkip(text: string) {
  return SKIP_WORDS.has(text.trim().toLowerCase());
}

function appUrl() {
  return (process.env.NEXTAUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

async function templateMenu(): Promise<{ menu: string; slugs: string[] }> {
  const templates = await prisma.template.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  const menu = templates
    .map((t, i) => `*${i + 1}. ${t.name}* — ${t.description} ($${t.basePrice} MXN base)`)
    .join("\n");
  return { menu, slugs: templates.map((t) => t.id) };
}

/**
 * Procesa un mensaje entrante y devuelve la respuesta a enviar.
 * `phone` ya viene normalizado (+521...).
 */
export async function handleIncomingMessage(phone: string, text: string): Promise<string> {
  const trimmed = text.trim();

  let convo = await prisma.whatsappConversation.findUnique({ where: { phone } });

  if (!convo || RESET_WORDS.has(trimmed.toLowerCase())) {
    convo = await prisma.whatsappConversation.upsert({
      where: { phone },
      update: { state: "name", data: {}, siteId: null },
      create: { phone, state: "name", data: {} },
    });
    return (
      "¡Hola! 👋 Soy el asistente de *Sitios Web Express*. Te haré unas preguntas rápidas y al final tendrás tu sitio web listo — sin registros ni contraseñas.\n\n" +
      "Puedes escribir *saltar* en las preguntas opcionales, o *reiniciar* para empezar de nuevo.\n\n" +
      "1️⃣ ¿Cómo se llama tu negocio?"
    );
  }

  const data = (convo.data ?? {}) as BotData;

  async function advance(state: string, patch: Partial<BotData> = {}) {
    await prisma.whatsappConversation.update({
      where: { phone },
      data: { state, data: { ...data, ...patch } },
    });
  }

  switch (convo.state) {
    case "name": {
      if (!trimmed) return "¿Cómo se llama tu negocio?";
      await advance("tagline", { businessName: trimmed });
      return `¡Perfecto, *${trimmed}*! 🎉\n\n2️⃣ ¿Tienes un eslogan o descripción corta? (o escribe *saltar*)`;
    }

    case "tagline": {
      await advance("email", isSkip(trimmed) ? {} : { tagline: trimmed });
      return "3️⃣ ¿Cuál es el correo de contacto de tu negocio? (o *saltar*)";
    }

    case "email": {
      if (!isSkip(trimmed) && !/^\S+@\S+\.\S+$/.test(trimmed)) {
        return "Ese correo no se ve válido 🤔 Intenta de nuevo o escribe *saltar*.";
      }
      await advance("address", isSkip(trimmed) ? {} : { email: trimmed });
      return "4️⃣ ¿Cuál es la dirección de tu negocio? (o *saltar*)";
    }

    case "address": {
      await advance("whatsapp", isSkip(trimmed) ? {} : { address: trimmed });
      return `5️⃣ Tu sitio incluye un botón de WhatsApp para que te contacten. ¿Uso este número (*${phone}*)?\n\nResponde *sí*, o envíame otro número con código de país.`;
    }

    case "whatsapp": {
      // Nota: sin \b — no funciona tras caracteres acentuados ("sí")
      const yes = /^(s[ií]|ok|dale|claro|correcto)[.!\s]*$/i.test(trimmed);
      const digits = trimmed.replace(/\D/g, "");
      let waNumber: string;
      if (yes) waNumber = phone.replace(/\D/g, "");
      else if (digits.length >= 10) waNumber = digits;
      else return "No entendí 🤔 Responde *sí* para usar tu número, o envíame otro número con código de país (ej. 5215512345678).";

      const { menu } = await templateMenu();
      await advance("template", { whatsappNumber: waNumber });
      return `6️⃣ ¡Última pregunta! Elige el estilo de tu sitio (responde con el número):\n\n${menu}`;
    }

    case "template": {
      const { slugs, menu } = await templateMenu();
      const choice = parseInt(trimmed, 10);
      if (!choice || choice < 1 || choice > slugs.length) {
        return `Responde con el número del estilo que prefieras:\n\n${menu}`;
      }

      const site = await createOnboardedSite({
        templateId: slugs[choice - 1],
        businessName: data.businessName ?? "Mi negocio",
        tagline: data.tagline,
        email: data.email,
        address: data.address,
        whatsappNumber: data.whatsappNumber,
      });

      await prisma.whatsappConversation.update({
        where: { phone },
        data: { state: "done", siteId: site.id },
      });

      return (
        `🚀 ¡Listo! Tu sitio *${data.businessName}* ya está creado.\n\n` +
        `Este es tu enlace privado para verlo y personalizarlo cuando quieras (al confirmar tu pago podrás descargar el código):\n${appUrl()}/builder/${site.editKey}\n\n` +
        `⚠️ *Guarda este enlace*: es tu llave de acceso al sitio (no necesitas cuenta ni contraseña). Escribe *reiniciar* si quieres crear otro sitio.`
      );
    }

    case "done":
      return (
        `Tu sitio ya fue creado ✅ Revisa el enlace que te envié, o escribe *reiniciar* para crear uno nuevo.`
      );

    default: {
      await advance("name");
      return "¿Cómo se llama tu negocio?";
    }
  }
}
