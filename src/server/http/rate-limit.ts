import "server-only";

import { getDb } from "@/server/db";
import { tooManyRequests } from "./errors";
import { clientIp } from "./request";

/**
 * Fixed-window counters in PostgreSQL, shared by every server instance. For abuse protection on public
 * endpoints (sign-in, class codes, emails); per-account lockouts live on the users table.
 *
 * One atomic upsert (raw SQL: Prisma's upsert can't compute the new values from the stored row).
 */
export async function hitRateLimit(key: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfter: number }> {
  const db = getDb();
  const [row] = await db.$queryRaw<{ count: number; window_start: Date }[]>`
    insert into rate_limits as r (key, window_start, count)
    values (${key}, now(), 1)
    on conflict (key) do update set
      count = case when r.window_start < now() - make_interval(secs => ${windowSeconds}) then 1 else r.count + 1 end,
      window_start = case when r.window_start < now() - make_interval(secs => ${windowSeconds}) then now() else r.window_start end
    returning r.count, r.window_start`;

  // Now and then, drop counters nobody has touched for a day.
  if (Math.random() < 0.01) {
    await db.$executeRaw`delete from rate_limits where window_start < now() - interval '1 day'`;
  }

  const count = row?.count ?? 1;
  const windowStart = row?.window_start ?? new Date();
  const retryAfter = Math.max(1, windowSeconds - (Date.now() - windowStart.getTime()) / 1000);
  return { allowed: count <= limit, retryAfter };
}

/** Throws 429 (with Retry-After) when `key` went over `limit` requests in `windowSeconds`. */
export async function enforceRateLimit(key: string, limit: number, windowSeconds: number, message?: string) {
  const { allowed, retryAfter } = await hitRateLimit(key, limit, windowSeconds);
  if (!allowed) throw tooManyRequests(retryAfter, message);
}

/**
 * A per-IP limit. Without a client IP (no X-Forwarded-For / X-Real-IP: the app isn't behind a proxy),
 * every visitor would share one counter and a busy classroom could lock out the whole site, so the limit
 * is skipped; per-account lockouts still protect each account.
 */
export async function enforceIpRateLimit(request: Request, bucket: string, limit: number, windowSeconds: number, message?: string) {
  const ip = clientIp(request);
  if (!ip) return;
  await enforceRateLimit(`${bucket}:ip:${ip}`, limit, windowSeconds, message);
}
