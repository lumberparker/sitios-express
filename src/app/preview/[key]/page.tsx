import { notFound } from "next/navigation";
import { getSiteByKey } from "@/lib/sites";
import { SiteConfigSchema, TemplateConfigSchema } from "@/lib/site-config";
import { SiteRenderer } from "@/components/site/SiteRenderer";

export default async function PreviewPage({ params }: { params: { key: string } }) {
  const site = await getSiteByKey(params.key);
  if (!site) notFound();

  const config = SiteConfigSchema.parse(site.config);
  const templateConfig = TemplateConfigSchema.parse(site.template.config);

  return <SiteRenderer config={config} templateConfig={templateConfig} />;
}
