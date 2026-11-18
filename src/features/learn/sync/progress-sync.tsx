"use client";

import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, CloudOff, RefreshCw } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { learnApi } from "../api";
import type { LessonProgressResult } from "../contract";
import { learnKeys } from "../hooks";
import { ProgressQueue, type SyncState } from "./progress-queue";

/**
 * The offline-safe progress queue for the student area (one per tab, shared by every page under /learn)
 * and the glue to the rest of the app: browser online/offline and page-hide events, refreshing cached
 * learning data when the server confirms, and result listeners for celebrations.
 */

const QueueContext = createContext<ProgressQueue | null>(null);

/** 4xx answers won't get better by retrying (408 and 429 will). Network errors and 5xx will. */
function isPermanent(error: unknown) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

const localStore = {
  read: () => {
    try {
      return window.localStorage.getItem(STORAGE_KEYS.progressQueue);
    } catch {
      return null;
    }
  },
  write: (value: string | null) => {
    if (value === null) window.localStorage.removeItem(STORAGE_KEYS.progressQueue);
    else window.localStorage.setItem(STORAGE_KEYS.progressQueue, value);
  },
};

export function ProgressSyncProvider({ studentId, children }: { studentId: string; children: ReactNode }) {
  const queryClient = useQueryClient();
  const [queue] = useState(
    () =>
      new ProgressQueue({
        studentId,
        storage: typeof window === "undefined" ? { read: () => null, write: () => {} } : localStore,
        isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
        isPermanent,
        send: (lessonId, payload, { keepalive }) =>
          learnApi.reportLesson(lessonId, { status: payload.status, seconds: payload.seconds, media: payload.media, report_id: payload.reportId }, { keepalive }),
      }),
  );

  useEffect(() => {
    const flush = () => void queue.flush();
    const exit = () => queue.flushOnExit();
    const hidden = () => document.visibilityState === "hidden" && queue.flushOnExit();
    window.addEventListener("online", flush);
    window.addEventListener("offline", flush); // updates the status to "offline"
    window.addEventListener("pagehide", exit);
    document.addEventListener("visibilitychange", hidden);
    // What the last visit couldn't send goes now.
    flush();
    // Once the server has it, what it changes is refreshed wherever it is shown.
    const stop = queue.onResult(() => void queryClient.invalidateQueries({ queryKey: learnKeys.all, refetchType: "active" }));
    return () => {
      window.removeEventListener("online", flush);
      window.removeEventListener("offline", flush);
      window.removeEventListener("pagehide", exit);
      document.removeEventListener("visibilitychange", hidden);
      stop();
    };
  }, [queue, queryClient]);

  useEffect(() => () => queue.dispose(), [queue]);

  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>;
}

function useQueue(): ProgressQueue {
  const queue = useContext(QueueContext);
  if (!queue) throw new Error("useProgressSync() needs <ProgressSyncProvider> (the student layouts provide it).");
  return queue;
}

const serverState: SyncState = { status: "idle", pending: 0, lastError: null, revision: 0 };

/** Record progress (it is saved even offline) and read the sync state for the "saved" indicator. */
export function useProgressSync() {
  const queue = useQueue();
  const state = useSyncExternalStore(queue.subscribe, queue.getState, () => serverState);
  return {
    state,
    record: (lessonId: string, update: { status?: "started" | "completed"; seconds?: number; media?: Record<string, number> }) => queue.record(lessonId, update),
    flush: () => queue.flush(),
    pendingFor: (lessonId: string) => queue.pendingFor(lessonId),
  };
}

/** Runs `listener` with every confirmed progress report (celebrations). */
export function useProgressResults(listener: (lessonId: string, result: LessonProgressResult) => void) {
  const queue = useQueue();
  const current = useRef(listener);
  useEffect(() => {
    current.current = listener;
  });
  useEffect(() => {
    const stop = queue.onResult((lessonId, result) => current.current(lessonId, result));
    return () => void stop();
  }, [queue]);
}

const statusText: Record<SyncState["status"], string> = {
  idle: "",
  saving: "Saving…",
  saved: "Saved",
  offline: "Offline: saved on this device",
  retrying: "Trying to save again…",
  failed: "Not saved",
};

/** The quiet "saved" indicator (FE-STU-05). Announced politely, never in the way. */
export function SaveStatus({ className }: { className?: string }) {
  const { state } = useProgressSync();
  const icon =
    state.status === "saving" ? (
      <Spinner label="" className="size-3.5" />
    ) : state.status === "saved" ? (
      <Check aria-hidden className="size-4 text-success" />
    ) : state.status === "offline" ? (
      <CloudOff aria-hidden className="size-4" />
    ) : state.status === "retrying" ? (
      <RefreshCw aria-hidden className="size-4" />
    ) : state.status === "failed" ? (
      <AlertTriangle aria-hidden className="size-4 text-danger-text" />
    ) : null;
  return (
    <p role="status" aria-live="polite" className={cn("flex min-h-5 items-center gap-1.5 text-caption font-bold text-fg-muted", className)}>
      {icon}
      <span>{state.status === "failed" && state.lastError ? `Not saved: ${state.lastError}` : statusText[state.status]}</span>
    </p>
  );
}
