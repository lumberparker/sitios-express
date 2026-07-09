import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./wizard";

// Render bajo demanda: los templates salen de la DB, y el build no debe
// depender de que la base esté disponible (ej. primer deploy en Vercel).
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const templates = await prisma.template.findMany({ where: { active: true }, orderBy: { createdAt: "asc" } });
  return (
    <OnboardingWizard
      templates={templates.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        basePrice: t.basePrice,
        config: t.config as any,
      }))}
    />
  );
}
