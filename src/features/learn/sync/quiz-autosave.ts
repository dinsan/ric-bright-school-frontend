/**
 * Saves a quiz attempt as the student answers (FE-ASM-01 autosave). Pure logic, no React: the quiz player
 * wraps it (components/quiz-player.tsx).
 *
 * - Debounced: a burst of typing is one save, `delayMs` after the last change.
 * - One save at a time, always the newest state: what changes during a save is sent right after it, so
 *   an older save can never land after a newer one and undo it.
 * - The whole state each time (answers and flags), so a retry or a repeat is harmless.
 * - Retries with a growing pause when the connection fails; stops on a refusal that won't get better
 *   (the attempt was finished elsewhere, an answer the server can't take) and says why.
 */

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved" | "retrying" | "failed";

export interface AutosaveState {
  status: AutosaveStatus;
  /** Why saving stopped (status "failed"). */
  error: unknown;
}

export interface QuizAutosaveOptions<T> {
  send: (state: T, options: { keepalive: boolean }) => Promise<unknown>;
  /** Whether a failed save is worth retrying (network trouble, the server busy). */
  isRetryable: (error: unknown) => boolean;
  onChange?: (state: AutosaveState) => void;
  delayMs?: number;
  /** Pauses between retries; the last one repeats. */
  retryMs?: readonly number[];
}

export class QuizAutosave<T> {
  private latest: T | null = null;
  private dirty = false;
  private inFlight: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private paused = false;
  private disposed = false;
  private current: AutosaveState = { status: "idle", error: null };
  private readonly delayMs: number;
  private readonly retryMs: readonly number[];

  constructor(private readonly options: QuizAutosaveOptions<T>) {
    this.delayMs = options.delayMs ?? 800;
    this.retryMs = options.retryMs ?? [1000, 2000, 5000, 10_000, 30_000];
  }

  get state(): AutosaveState {
    return this.current;
  }

  /** Unsaved changes are waiting (or being sent). */
  get hasUnsaved(): boolean {
    return this.dirty || this.inFlight !== null;
  }

  /** The newest state: saved after the pause, or straight after the save in flight. */
  update(state: T) {
    if (this.disposed) return;
    this.latest = state;
    this.dirty = true;
    this.failures = 0;
    if (this.current.status !== "saving") this.set({ status: "pending", error: null });
    this.schedule(this.delayMs);
  }

  /**
   * The page is going away (closed, hidden, or the player left for another page): send what is waiting
   * with `keepalive`, so it arrives after the page is gone. Nothing to wait for, and no retries.
   */
  flushOnHide() {
    if (this.disposed || this.paused || this.latest === null || (!this.dirty && !this.inFlight)) return;
    this.clearTimer();
    const latest = this.latest;
    const send = () => void this.options.send(latest, { keepalive: true }).catch(() => undefined);
    if (this.dirty && this.inFlight) {
      // Newer than the save in flight: send it after that one, so the older save can't land last.
      this.dirty = false;
      void this.inFlight.then(send);
    } else {
      // Nothing newer than the save in flight (the same state again, in case the page's requests are
      // cancelled), or nothing in flight: order doesn't matter.
      this.dirty = false;
      send();
    }
  }

  /** Stop saving for a while (while the attempt is being submitted with the same answers). */
  pause() {
    this.paused = true;
    this.clearTimer();
  }

  resume() {
    this.paused = false;
    if (this.dirty) this.schedule(0);
  }

  /** Try again after a failure the student chose to retry. */
  retry() {
    if (this.disposed) return;
    this.failures = 0;
    if (this.latest !== null) this.dirty = true;
    this.set({ status: "pending", error: null });
    this.schedule(0);
  }

  dispose() {
    this.disposed = true;
    this.clearTimer();
  }

  private schedule(ms: number) {
    if (this.paused || this.disposed) return;
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run();
    }, ms);
  }

  private clearTimer() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private run() {
    if (this.inFlight || !this.dirty || this.latest === null || this.paused || this.disposed) return;
    const snapshot = this.latest;
    this.dirty = false;
    this.set({ status: "saving", error: null });
    this.inFlight = this.options
      .send(snapshot, { keepalive: false })
      .then(
        () => {
          this.failures = 0;
          if (this.disposed) return;
          if (this.dirty) {
            this.set({ status: "pending", error: null });
            this.schedule(0);
          } else {
            this.set({ status: "saved", error: null });
          }
        },
        (error: unknown) => {
          if (this.disposed) return;
          if (!this.options.isRetryable(error)) {
            this.set({ status: "failed", error });
            return;
          }
          // Not saved: send again (the newest state, if the student kept going).
          this.dirty = true;
          const wait = this.retryMs[Math.min(this.failures, this.retryMs.length - 1)]!;
          this.failures += 1;
          this.set({ status: "retrying", error });
          this.schedule(wait);
        },
      )
      .finally(() => {
        this.inFlight = null;
      });
  }

  private set(state: AutosaveState) {
    this.current = state;
    this.options.onChange?.(state);
  }
}
