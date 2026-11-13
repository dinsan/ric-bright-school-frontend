import { getDb } from "@/server/db";
import { json, route } from "@/server/http/route";

/** Liveness and readiness: 200 when the database answers, 503 otherwise (used by the Docker healthcheck). */
export const GET = route(async () => {
  await getDb().$queryRaw`select 1`;
  return json({ status: "ok" });
});
