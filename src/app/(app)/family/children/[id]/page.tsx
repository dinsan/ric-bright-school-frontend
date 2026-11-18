import type { Metadata } from "next";
import { ChildProgressView } from "@/features/family/components/child-progress";
import { childProgress } from "@/server/family/progress";
import { loadChild } from "./child";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { child } = await loadChild((await params).id);
  return { title: `${child.display_name}: progress` };
}

/**
 * /family/children/{id}: one child's learning for their parent (FE-PAR-02). The layout has already checked
 * it is this parent's child (404 otherwise).
 */
export default async function ChildProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { auth } = await loadChild(id);
  const progress = await childProgress(auth, id, { days: 14 });
  return <ChildProgressView progress={progress} timeZone={auth.user.timezone} controlsHref={`/family/children/${id}/controls`} />;
}
