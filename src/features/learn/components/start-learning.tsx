"use client";

import { Play } from "lucide-react";
import { useSyncExternalStore } from "react";
import { ButtonLink } from "@/components/ui/button";
import { useSessionHint } from "@/features/auth/session";

/**
 * The course page's way in (FE-PUB-05's enrol button): students go to the course in their learning area
 * (start or continue there); signed-out visitors sign in as a student first and come back. Parents,
 * teachers and admins don't take courses, so they see nothing. The role comes from the session hint
 * cookie: a UI hint only, the learning area checks the real session.
 */
export function StartLearning({ courseSlug }: { courseSlug: string }) {
  const role = useSessionHint();
  // The page is cached for everyone: decide only in the browser (a same-size placeholder until then, no flash).
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const target = `/learn/courses/${courseSlug}`;
  if (!hydrated) return <div aria-hidden className="min-h-control" />;
  if (role === "student") {
    return (
      <ButtonLink href={target} className="w-full">
        <Play aria-hidden />
        Start learning
      </ButtonLink>
    );
  }
  if (role === null) {
    return (
      <ButtonLink href={`/sign-in/student?next=${encodeURIComponent(target)}`} variant="secondary" className="w-full">
        Students: sign in to start
      </ButtonLink>
    );
  }
  return null;
}
