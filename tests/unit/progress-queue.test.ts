import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LessonProgressResult } from "@/features/learn/contract";
import { backoffMs, mergePayload, ProgressQueue, type QueueStorage } from "@/features/learn/sync/progress-queue";

class MemoryStorage implements QueueStorage {
  value: string | null = null;
  read = () => this.value;
  write = (value: string | null) => {
    this.value = value;
  };
}

const ok = (lessonId: string, status: "started" | "completed" = "started"): LessonProgressResult => ({
  lesson_id: lessonId,
  status,
  seconds_spent: 0,
  completed_at: null,
  media_positions: {},
  course_completed: false,
  duplicate: false,
  new_badges: [],
  level: { before: 1, after: 1 },
  certificate: null,
});

class Permanent extends Error {}

function setup({ online = true, studentId = "s1", storage = new MemoryStorage() } = {}) {
  let isOnline = online;
  let ids = 0;
  const sent: Array<{ lessonId: string; payload: { status: string; seconds: number; media: Record<string, number>; reportId: string }; keepalive: boolean }> = [];
  let behaviour: (lessonId: string) => Promise<LessonProgressResult> = async (lessonId) => ok(lessonId);
  const queue = new ProgressQueue({
    studentId,
    storage,
    isOnline: () => isOnline,
    newId: () => `r${++ids}`,
    isPermanent: (error) => error instanceof Permanent,
    send: (lessonId, payload, { keepalive }) => {
      sent.push({ lessonId, payload: { ...payload, media: { ...payload.media } }, keepalive });
      return behaviour(lessonId);
    },
  });
  return {
    queue,
    sent,
    storage,
    setOnline: (value: boolean) => (isOnline = value),
    respond: (fn: typeof behaviour) => (behaviour = fn),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("progress queue: merging", () => {
  it("keeps the furthest status, adds seconds, and keeps the latest video positions", () => {
    const merged = mergePayload({ status: "completed", seconds: 10, media: { v: 5, w: 1 } }, { status: "started", seconds: 4, media: { v: 9 } });
    expect(merged).toEqual({ status: "completed", seconds: 14, media: { v: 9, w: 1 } });
    expect(mergePayload(null, { status: "started", seconds: 3, media: {} })).toEqual({ status: "started", seconds: 3, media: {} });
  });

  it("backs off 1 s, 2 s, 4 s … up to 30 s", () => {
    expect([1, 2, 3, 4, 5, 6, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 8000, 16000, 30000, 30000]);
  });
});

describe("progress queue: sending", () => {
  it("sends a report at once with a report id, and reports 'saved'", async () => {
    const { queue, sent } = setup();
    const results: string[] = [];
    queue.onResult((lessonId) => results.push(lessonId));
    queue.record("l1", { status: "started", seconds: 5 });
    await vi.runAllTimersAsync();
    expect(sent).toEqual([{ lessonId: "l1", payload: { status: "started", seconds: 5, media: {}, reportId: "r1" }, keepalive: false }]);
    expect(results).toEqual(["l1"]);
    expect(queue.getState()).toMatchObject({ status: "saved", pending: 0 });
  });

  it("merges what's recorded during a send into the next one (never into the one on the wire)", async () => {
    const { queue, sent, respond } = setup();
    let release!: () => void;
    respond((lessonId) => new Promise((resolve) => (release = () => resolve(ok(lessonId)))));
    queue.record("l1", { seconds: 5 });
    await vi.advanceTimersByTimeAsync(0);
    queue.record("l1", { seconds: 7, media: { v: 12 } });
    queue.record("l1", { status: "completed", seconds: 1 });
    expect(queue.getState().status).toBe("saving");
    expect(queue.pendingFor("l1")).toEqual({ status: "completed", seconds: 13, media: { v: 12 } });
    respond(async (lessonId) => ok(lessonId, "completed"));
    release();
    await vi.runAllTimersAsync();
    expect(sent.map((entry) => entry.payload)).toEqual([
      { status: "started", seconds: 5, media: {}, reportId: "r1" },
      { status: "completed", seconds: 8, media: { v: 12 }, reportId: "r2" },
    ]);
    expect(queue.pendingFor("l1")).toBeNull();
  });

  it("retries a failed send with the same report id (so the server can ignore a repeat), backing off", async () => {
    const { queue, sent, respond } = setup();
    let failures = 2;
    respond(async (lessonId) => {
      if (failures-- > 0) throw new TypeError("Failed to fetch");
      return ok(lessonId);
    });
    queue.record("l1", { status: "completed", seconds: 30 });
    await vi.advanceTimersByTimeAsync(0);
    expect(queue.getState().status).toBe("retrying");
    await vi.advanceTimersByTimeAsync(1000); // first retry after 1 s
    await vi.advanceTimersByTimeAsync(2000); // second after 2 s
    expect(sent.map((entry) => entry.payload.reportId)).toEqual(["r1", "r1", "r1"]);
    expect(queue.getState()).toMatchObject({ status: "saved", pending: 0 });
  });

  it("drops a report the server refuses for good (not enrolled), says so, and keeps newer progress", async () => {
    const { queue, respond, sent } = setup();
    respond(async () => {
      throw new Permanent("Start the course first, then its lessons.");
    });
    queue.record("l1", { status: "started" });
    await vi.runAllTimersAsync();
    expect(queue.getState()).toMatchObject({ status: "failed", pending: 0, lastError: "Start the course first, then its lessons." });
    respond(async (lessonId) => ok(lessonId));
    queue.record("l1", { status: "started" });
    await vi.runAllTimersAsync();
    expect(sent).toHaveLength(2);
    expect(queue.getState()).toMatchObject({ status: "saved", lastError: null });
  });
});

describe("progress queue: offline and storage", () => {
  it("waits while offline (saved on the device) and sends when back online", async () => {
    const { queue, sent, storage, setOnline } = setup({ online: false });
    queue.record("l1", { status: "completed", seconds: 20 });
    await vi.runAllTimersAsync();
    expect(sent).toHaveLength(0);
    expect(queue.getState()).toMatchObject({ status: "offline", pending: 1 });
    expect(JSON.parse(storage.value!)).toEqual({ s1: [expect.objectContaining({ lessonId: "l1", queued: { status: "completed", seconds: 20, media: {} } })] });
    setOnline(true);
    await queue.flush();
    expect(sent).toHaveLength(1);
    expect(storage.value).toBeNull();
  });

  // R: a second record merged into a waiting entry changed neither the status nor the pending count, so
  // the UI wasn't told and a lesson marked done offline didn't show as done.
  it("tells listeners about every record, even one merged into a waiting report", async () => {
    const { queue } = setup({ online: false });
    const listener = vi.fn();
    queue.subscribe(listener);
    queue.record("l1", { status: "started" });
    queue.record("l1", { status: "completed" });
    expect(listener.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(queue.getState()).toMatchObject({ status: "offline", pending: 1, revision: 2 });
    expect(queue.pendingFor("l1")?.status).toBe("completed");
  });

  it("picks up what a previous visit left, with the report id it had (a repeat the server will recognise)", async () => {
    const storage = new MemoryStorage();
    storage.value = JSON.stringify({
      s1: [{ lessonId: "l1", queued: null, sending: { status: "completed", seconds: 9, media: {}, reportId: "old-id" }, attempts: 3, retryAt: 0 }],
      s2: [{ lessonId: "l9", queued: { status: "started", seconds: 1, media: {} }, sending: null, attempts: 0, retryAt: 0 }],
    });
    const { queue, sent } = setup({ storage });
    expect(queue.getState().pending).toBe(1);
    await queue.flush();
    expect(sent).toEqual([{ lessonId: "l1", payload: { status: "completed", seconds: 9, media: {}, reportId: "old-id" }, keepalive: false }]);
    // Another student's progress on this shared device is neither sent nor lost.
    expect(JSON.parse(storage.value!)).toEqual({ s2: [expect.objectContaining({ lessonId: "l9" })] });
  });

  it("sends what's left with keepalive when the page goes away, keeping it stored until confirmed", async () => {
    const { queue, sent, storage, setOnline } = setup({ online: false });
    queue.record("l1", { seconds: 12 });
    setOnline(true);
    queue.flushOnExit();
    expect(sent).toEqual([{ lessonId: "l1", payload: { status: "started", seconds: 12, media: {}, reportId: "r1" }, keepalive: true }]);
    expect(JSON.parse(storage.value!).s1[0].sending.reportId).toBe("r1");
  });

  it("survives storage that is full or blocked", async () => {
    const storage: QueueStorage = {
      read: () => {
        throw new Error("blocked");
      },
      write: () => {
        throw new Error("full");
      },
    };
    const { queue, sent } = setup({ storage: storage as MemoryStorage });
    queue.record("l1", { seconds: 3 });
    await vi.runAllTimersAsync();
    expect(sent).toHaveLength(1);
  });
});
