import type { LessonProgressResult } from "../contract";

/**
 * Progress sync that survives poor connections (FE-STU-05). The lesson player records progress here
 * instead of calling the API; the queue saves it, sends it, and retries until the server has it.
 *
 * - Coalesced: reports for the same lesson merge while they wait (status only moves forward, seconds
 *   add up, video positions merge), so a slow connection means fewer requests, not a backlog.
 * - Exactly once: a send carries a `report_id` that is reused for every retry of that same payload, and
 *   the server ignores ids it has already applied (progress_receipts). What was recorded during a send
 *   waits and goes in the next one.
 * - Durable: the queue is kept in localStorage, per student, so closing the tab or losing the connection
 *   loses nothing, and on a shared classroom device one child's progress is never sent under another
 *   child's session.
 * - Patient: retries back off (1 s, 2 s, 4 s … 30 s), pause while the browser is offline, and resume on
 *   "online". A refusal that can't get better (not enrolled, lesson gone) is dropped and reported.
 *
 * No React, no DOM apart from what is injected: tested with fake timers and an in-memory store.
 */

export interface ProgressPayload {
  status: "started" | "completed";
  seconds: number;
  media: Record<string, number>;
}

interface Sending extends ProgressPayload {
  reportId: string;
}

export interface QueueEntry {
  lessonId: string;
  /** Waiting to be sent (recorded after the current send started, or nothing is being sent). */
  queued: ProgressPayload | null;
  /** Sent and not yet confirmed: retried as is, with the same report id. */
  sending: Sending | null;
  attempts: number;
  /** When the next try may happen (ms since epoch). */
  retryAt: number;
}

export type SyncStatus = "idle" | "saving" | "saved" | "offline" | "retrying" | "failed";

export interface SyncState {
  status: SyncStatus;
  /** Lessons with something not yet on the server. */
  pending: number;
  /** The last permanent failure, shown once ("This progress couldn't be saved: …"). */
  lastError: string | null;
  /** Goes up whenever what the queue holds changes (a new record merged into a waiting one included). */
  revision: number;
}

/** Where the queue is kept. localStorage in the browser; a Map in tests. */
export interface QueueStorage {
  read(): string | null;
  write(value: string | null): void;
}

export interface QueueOptions {
  studentId: string;
  send: (lessonId: string, payload: Sending, options: { keepalive: boolean }) => Promise<LessonProgressResult>;
  storage: QueueStorage;
  isOnline?: () => boolean;
  now?: () => number;
  newId?: () => string;
  /** Classifies a failure: true when retrying can't help (4xx other than 408/429). */
  isPermanent?: (error: unknown) => boolean;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

const MAX_BACKOFF_MS = 30_000;
export const backoffMs = (attempts: number) => Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.max(0, attempts - 1));

const rank = { started: 0, completed: 1 } as const;

/** Two reports as one: the further status, the sum of seconds, the latest video positions. */
export function mergePayload(a: ProgressPayload | null, b: ProgressPayload): ProgressPayload {
  if (!a) return { status: b.status, seconds: b.seconds, media: { ...b.media } };
  return {
    status: rank[b.status] > rank[a.status] ? b.status : a.status,
    seconds: a.seconds + b.seconds,
    media: { ...a.media, ...b.media },
  };
}

type Listener = () => void;
type ResultListener = (lessonId: string, result: LessonProgressResult) => void;

export class ProgressQueue {
  private entries = new Map<string, QueueEntry>();
  private state: SyncState = { status: "idle", pending: 0, lastError: null, revision: 0 };
  private revision = 0;
  private listeners = new Set<Listener>();
  private resultListeners = new Set<ResultListener>();
  private inFlight = new Set<string>();
  private timer: unknown = null;
  private readonly o: Required<QueueOptions>;

  constructor(options: QueueOptions) {
    this.o = {
      isOnline: () => true,
      now: () => Date.now(),
      newId: () => crypto.randomUUID(),
      isPermanent: () => false,
      setTimer: (run, ms) => setTimeout(run, ms),
      clearTimer: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
      ...options,
    };
    this.load();
  }

  // --- Public API ---------------------------------------------------------------------------------

  /** Record progress in a lesson; it is saved locally at once and sent as soon as possible. */
  record(lessonId: string, update: { status?: "started" | "completed"; seconds?: number; media?: Record<string, number> }) {
    const payload: ProgressPayload = { status: update.status ?? "started", seconds: Math.max(0, Math.round(update.seconds ?? 0)), media: update.media ?? {} };
    const entry = this.entries.get(lessonId) ?? { lessonId, queued: null, sending: null, attempts: 0, retryAt: 0 };
    entry.queued = mergePayload(entry.queued, payload);
    this.entries.set(lessonId, entry);
    this.revision += 1;
    this.persist();
    this.update();
    void this.flush();
  }

  /** Send everything that may be sent now. Safe to call any time (online event, a button, a timer). */
  async flush(): Promise<void> {
    if (!this.o.isOnline()) {
      this.update();
      return;
    }
    const now = this.o.now();
    const due = [...this.entries.values()].filter((entry) => !this.inFlight.has(entry.lessonId) && (entry.sending || entry.queued) && entry.retryAt <= now);
    await Promise.all(due.map((entry) => this.sendEntry(entry, false)));
    this.schedule();
  }

  /**
   * The page is going away: send what's left with `keepalive` (it can finish after the page is gone).
   * The entries stay stored; if the request doesn't arrive, the next visit retries with the same ids.
   */
  flushOnExit() {
    if (!this.o.isOnline()) return;
    for (const entry of this.entries.values()) {
      if (this.inFlight.has(entry.lessonId)) continue;
      if (!entry.sending && entry.queued) {
        entry.sending = { ...entry.queued, reportId: this.o.newId() };
        entry.queued = null;
      }
      if (entry.sending) void this.o.send(entry.lessonId, entry.sending, { keepalive: true }).catch(() => {});
    }
    this.persist();
  }

  getState = (): SyncState => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Every confirmed report's answer (for the celebration and to refresh cached data). */
  onResult(listener: ResultListener) {
    this.resultListeners.add(listener);
    return () => this.resultListeners.delete(listener);
  }

  /** What is waiting for a lesson, merged (sending + queued): lets the UI show a lesson as done before the server agrees. */
  pendingFor(lessonId: string): ProgressPayload | null {
    const entry = this.entries.get(lessonId);
    if (!entry) return null;
    return entry.sending ? mergePayload(entry.sending, entry.queued ?? { status: "started", seconds: 0, media: {} }) : entry.queued;
  }

  dispose() {
    if (this.timer !== null) this.o.clearTimer(this.timer);
    this.listeners.clear();
    this.resultListeners.clear();
  }

  // --- Internals ------------------------------------------------------------------------------------

  private async sendEntry(entry: QueueEntry, keepalive: boolean) {
    if (!entry.sending) {
      if (!entry.queued) return;
      entry.sending = { ...entry.queued, reportId: this.o.newId() };
      entry.queued = null;
      this.persist();
    }
    const sending = entry.sending;
    this.inFlight.add(entry.lessonId);
    this.update();
    try {
      const result = await this.o.send(entry.lessonId, sending, { keepalive });
      entry.sending = null;
      entry.attempts = 0;
      entry.retryAt = 0;
      if (!entry.queued) this.entries.delete(entry.lessonId);
      this.state = { ...this.state, lastError: null };
      this.revision += 1;
      this.persist();
      for (const listener of this.resultListeners) listener(entry.lessonId, result);
    } catch (error) {
      if (this.o.isPermanent(error)) {
        // Can't succeed (not enrolled any more, lesson removed): drop this payload, keep anything newer.
        entry.sending = null;
        entry.attempts = 0;
        if (!entry.queued) this.entries.delete(entry.lessonId);
        this.state = { ...this.state, lastError: error instanceof Error ? error.message : "This progress couldn't be saved." };
      } else {
        entry.attempts += 1;
        entry.retryAt = this.o.now() + backoffMs(entry.attempts);
      }
      this.persist();
    } finally {
      this.inFlight.delete(entry.lessonId);
      this.update();
    }
  }

  private schedule() {
    if (this.timer !== null) {
      this.o.clearTimer(this.timer);
      this.timer = null;
    }
    const waiting = [...this.entries.values()].filter((entry) => (entry.sending || entry.queued) && !this.inFlight.has(entry.lessonId));
    if (waiting.length === 0 || !this.o.isOnline()) return;
    const next = Math.min(...waiting.map((entry) => entry.retryAt));
    this.timer = this.o.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, Math.max(0, next - this.o.now()));
  }

  private update() {
    const pending = [...this.entries.values()].filter((entry) => entry.sending || entry.queued).length;
    const retrying = [...this.entries.values()].some((entry) => entry.attempts > 0);
    let status: SyncStatus;
    if (pending === 0) status = this.state.lastError ? "failed" : this.state.status === "idle" ? "idle" : "saved";
    else if (!this.o.isOnline()) status = "offline";
    else status = retrying ? "retrying" : "saving";
    const next: SyncState = { status, pending, lastError: this.state.lastError, revision: this.revision };
    if (next.status !== this.state.status || next.pending !== this.state.pending || next.lastError !== this.state.lastError || next.revision !== this.state.revision) {
      this.state = next;
      for (const listener of this.listeners) listener();
    }
  }

  /** Stored as { "<student id>": QueueEntry[] }: other students' entries are kept untouched. */
  private readAll(): Record<string, QueueEntry[]> {
    try {
      const parsed = JSON.parse(this.o.storage.read() ?? "{}") as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, QueueEntry[]>) : {};
    } catch {
      return {};
    }
  }

  private load() {
    const mine = this.readAll()[this.o.studentId];
    if (!Array.isArray(mine)) return;
    for (const entry of mine) {
      if (entry && typeof entry.lessonId === "string" && (entry.queued || entry.sending)) {
        this.entries.set(entry.lessonId, { lessonId: entry.lessonId, queued: entry.queued ?? null, sending: entry.sending ?? null, attempts: 0, retryAt: 0 });
      }
    }
    this.update();
  }

  private persist() {
    const all = this.readAll();
    const mine = [...this.entries.values()].filter((entry) => entry.queued || entry.sending);
    if (mine.length) all[this.o.studentId] = mine;
    else delete all[this.o.studentId];
    try {
      this.o.storage.write(Object.keys(all).length ? JSON.stringify(all) : null);
    } catch {
      // Storage full or blocked: the queue still works for this visit.
    }
  }
}
