import { notFound } from "next/navigation";
import { appNavigation, type AppRole } from "@/config/navigation";
import { AppLayoutDemo } from "@/features/design-system/layout-demos";

export default async function AppLayoutDemoPage({ params }: { params: Promise<{ role: string }> }) {
  const { role } = await params;
  if (!(role in appNavigation)) notFound();
  return <AppLayoutDemo role={role as AppRole} />;
}
