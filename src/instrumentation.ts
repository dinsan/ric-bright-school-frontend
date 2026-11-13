/**
 * Runs once when a Next.js server starts (not for each request). Checks the server configuration so a
 * missing DATABASE_URL (or, in production, AUTH_SECRET) stops the server with a clear message, instead of
 * failing on the first request. Development uses a built-in AUTH_SECRET, so it needs no setup. Builds are
 * skipped: `next build` needs no database or secrets.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { serverConfig } = await import("@/server/config");
  const config = serverConfig();
  if (config.NODE_ENV === "production" && config.MAIL_TRANSPORT === "log") {
    console.warn("[config] SMTP_URL is not set: emails (sign-up links, password resets) are only written to the log.");
  }
}
