import { prisma } from "@/lib/prisma";
import { OnboardingWizard } from "./wizard";

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
