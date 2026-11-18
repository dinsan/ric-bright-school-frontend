import type { Metadata } from "next";
import { ControlsForm } from "@/features/family/components/controls-form";
import { childControls } from "@/server/family/controls";
import { loadChild } from "../child";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { child } = await loadChild((await params).id);
  return { title: `${child.display_name}: parental controls` };
}

/** /family/children/{id}/controls: learning-time limit, bedtime, and reminder or pause (FE-PAR-03). */
export default async function ChildControlsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { auth, child } = await loadChild(id);
  const controls = await childControls(auth, id);
  const first = child.display_name.split(" ")[0];
  return (
    <div className="grid gap-4">
      <p className="max-w-2xl">
        Help {first} keep learning time healthy. {first} sees the rule in the app: a reminder to take a break, or a break screen on
        lessons and quizzes. Nothing {first} has done is ever lost.
      </p>
      <ControlsForm childId={child.id} name={child.display_name} initial={controls} timeZone={auth.user.timezone} />
    </div>
  );
}
