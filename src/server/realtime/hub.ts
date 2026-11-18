import "server-only";

import { Client } from "pg";
import { serverConfig } from "@/server/config";
import type { Executor } from "@/server/db";
import type { LiveEvent } from "@/features/messages/contract";

/**
 * Live updates (FE-COM-02) through PostgreSQL LISTEN / NOTIFY: no message broker to run, and every server
 * instance hears every event (they all listen to the same database).
 *
 * - `publish(db, users, event)` runs `pg_notify` in the caller's transaction: the event goes out only when
 *   the message or announcement is committed, never for a write that rolled back.
 * - Each server process keeps one listening connection (created on first use, on globalThis so every server
 *   bundle shares it), and hands events to the open event streams of the users named in it
 *   (/api/me/events). It reconnects by itself; the browser refetches on reconnect, so nothing is missed.
 * - Events only say *what* changed ("a message in conversation X"), never the content: the browser fetches
 *   it through the normal, permission-checked endpoints.
 */

export const CHANNEL = "lumina_events";
/** NOTIFY payloads are limited to 8000 bytes: long recipient lists are sent in several notifications. */
const USERS_PER_NOTIFY = 100;

type Listener = (event: LiveEvent) => void;

export async function publish(db: Executor, users: Iterable<string>, event: LiveEvent): Promise<void> {
  const all = [...new Set(users)];
  for (let start = 0; start < all.length; start += USERS_PER_NOTIFY) {
    const payload = JSON.stringify({ users: all.slice(start, start + USERS_PER_NOTIFY), event });
    await db.$executeRaw`select pg_notify(${CHANNEL}, ${payload})`;
  }
}

class Hub {
  private client: Client | null = null;
  private connecting: Promise<void> | null = null;
  private readonly listeners = new Map<string, Set<Listener>>();
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;
  private closed = false;

  /** Resolves once this process is listening (throws if the database can't be reached). */
  ready(): Promise<void> {
    this.closed = false;
    if (this.client) return Promise.resolve();
    this.connecting ??= this.connect().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  subscribe(userId: string, listener: Listener): () => void {
    const set = this.listeners.get(userId) ?? new Set<Listener>();
    set.add(listener);
    this.listeners.set(userId, set);
    void this.ready().catch(() => this.scheduleReconnect());
    return () => {
      set.delete(listener);
      if (set.size === 0) this.listeners.delete(userId);
    };
  }

  /** How many streams are open (for tests and diagnostics). */
  get subscriberCount(): number {
    let count = 0;
    for (const set of this.listeners.values()) count += set.size;
    return count;
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    const client = this.client;
    this.client = null;
    await client?.end().catch(() => undefined);
  }

  private async connect(): Promise<void> {
    const client = new Client({ connectionString: serverConfig().DATABASE_URL });
    client.on("notification", (message) => this.dispatch(message.payload));
    client.on("error", (error) => {
      console.error("[realtime] listener connection error", error.message);
      this.lost(client);
    });
    client.on("end", () => this.lost(client));
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANNEL}`);
    } catch (error) {
      await client.end().catch(() => undefined);
      throw error;
    }
    this.client = client;
    this.failures = 0;
  }

  private lost(client: Client) {
    if (this.client !== client) return;
    this.client = null;
    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (this.closed || this.retryTimer || this.listeners.size === 0) return;
    const wait = Math.min(30_000, 1000 * 2 ** this.failures);
    this.failures += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      this.ready().catch(() => this.scheduleReconnect());
    }, wait);
    this.retryTimer.unref?.();
  }

  private dispatch(payload: string | undefined) {
    if (!payload) return;
    let parsed: { users?: unknown; event?: LiveEvent };
    try {
      parsed = JSON.parse(payload) as typeof parsed;
    } catch {
      return;
    }
    if (!Array.isArray(parsed.users) || !parsed.event) return;
    for (const userId of parsed.users) {
      for (const listener of this.listeners.get(String(userId)) ?? []) {
        try {
          listener(parsed.event);
        } catch (error) {
          console.error("[realtime] listener failed", error);
        }
      }
    }
  }
}

const globalForHub = globalThis as unknown as { luminaRealtimeHub?: Hub };

export function realtimeHub(): Hub {
  globalForHub.luminaRealtimeHub ??= new Hub();
  return globalForHub.luminaRealtimeHub;
}

/** Closes the listening connection (tests, shutdown). */
export async function closeRealtime(): Promise<void> {
  await globalForHub.luminaRealtimeHub?.close();
}
