"use client";

import { Award, PartyPopper, Trophy } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Button, ButtonLink, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { usePreferences } from "@/hooks/use-preferences";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { certificatePdfUrl } from "../api";
import type { Certificate, LessonProgressResult } from "../contract";
import { useProgressResults } from "../sync/progress-sync";

/**
 * Gamification moments (FE-STU-07): a new badge, a level-up, a finished course with its certificate.
 *
 * - Optional: students turn celebrations off in their dashboard (stored on the device). Off, the same news
 *   still arrives, as a plain message: nothing is hidden, only the fuss.
 * - Quieter for older students: Grades 9–12 get a calm message; younger grades get the bouncing icon.
 * - Motion collapses under prefers-reduced-motion (global rule), and nothing flashes or plays sound.
 */

const listeners = new Set<() => void>();
function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEYS.celebrations) !== "off";
  } catch {
    return true;
  }
}

/** Whether the student wants celebrations, and a setter (remembered on this device). */
export function useCelebrations(): [boolean, (enabled: boolean) => void] {
  const enabled = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    readEnabled,
    () => true,
  );
  const set = (value: boolean) => {
    try {
      if (value) window.localStorage.removeItem(STORAGE_KEYS.celebrations);
      else window.localStorage.setItem(STORAGE_KEYS.celebrations, "off");
    } catch {
      // storage blocked: the choice lasts until the page is reloaded
    }
    for (const listener of listeners) listener();
  };
  return [enabled, set];
}

/** The switch for the dashboard and Display settings. */
export function CelebrationsSwitch() {
  const [enabled, setEnabled] = useCelebrations();
  return (
    <Switch
      checked={enabled}
      onChange={(event) => setEnabled(event.target.checked)}
      label="Celebrations"
      description="A short animation when you finish a lesson, earn a badge or reach a new level."
    />
  );
}

/** True when the playful version fits: celebrations on, and not the calm Grades 9–12 presentation. */
export function usePlayful(): boolean {
  const [enabled] = useCelebrations();
  const { band } = usePreferences();
  return enabled && band !== "high";
}

/**
 * Listens to confirmed progress reports and celebrates what they earned. Mounted once in each student
 * layout (inside the progress sync provider).
 */
export function CelebrationCenter() {
  const playful = usePlayful();
  const [finished, setFinished] = useState<{ certificate: Certificate } | null>(null);

  useProgressResults((_lessonId, result: LessonProgressResult) => {
    if (result.duplicate) return;
    for (const badge of result.new_badges) {
      toast({ title: `New badge: ${badge.name}`, description: badge.description, tone: "success" });
    }
    if (result.level.after > result.level.before) {
      toast({ title: `Level ${result.level.after}!`, description: "You reached a new level. Keep going!", tone: "success" });
    }
    if (result.certificate) setFinished({ certificate: result.certificate });
  });

  return (
    <Dialog open={finished !== null} onOpenChange={(open) => !open && setFinished(null)}>
      {finished && (
        <DialogContent
          title={`You finished ${finished.certificate.course_title}!`}
          description="Every lesson is done. Your certificate is ready: look at it, download it, print it."
        >
          <div className="grid justify-items-center gap-3 py-2 text-center">
            <span
              aria-hidden
              className={
                playful
                  ? "inline-flex size-20 animate-celebrate items-center justify-center rounded-full border-2 border-line bg-accent text-accent-fg shadow-sticker"
                  : "inline-flex size-14 items-center justify-center rounded-full border-2 border-line bg-surface-sunken"
              }
            >
              {playful ? <PartyPopper className="size-10" /> : <Trophy className="size-7" />}
            </span>
            <p className="text-small text-fg-muted">Certificate number {finished.certificate.code}</p>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button>Close</Button>
            </DialogClose>
            {/* A plain link: the server answers with the PDF file (no client-side navigation). */}
            <a href={certificatePdfUrl(finished.certificate.id)} download className={buttonVariants({ variant: "secondary" })}>
              Download PDF
            </a>
            <ButtonLink href={`/learn/certificates#certificate-${finished.certificate.id}`} variant="primary">
              <Award aria-hidden />
              See my certificate
            </ButtonLink>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}

/** "+10 XP" style note after finishing a lesson (playful only; older grades get the plain "Done"). */
export function lessonDoneToast(title: string, playful: boolean) {
  if (playful) toast({ title: "Lesson done! +10 XP", description: title, tone: "success" });
}

