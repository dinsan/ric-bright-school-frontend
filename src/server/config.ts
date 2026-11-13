import { z } from "zod";

/**
 * Server configuration, read from the environment and validated once. Nothing here is ever sent to
 * the browser (no NEXT_PUBLIC_ values). `instrumentation.ts` calls `serverConfig()` when the server
 * starts, so a missing or invalid variable stops the server with a clear message instead of failing
 * on the first request.
 */

const DEV_AUTH_SECRET = "lumina-development-secret-do-not-use-in-production";
const DATABASE_URL_MISSING = "DATABASE_URL is required, for example postgres://lumina:lumina@localhost:5432/lumina";

const optional = z
  .string()
  .optional()
  .transform((value) => (value ? value : undefined));

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    DATABASE_URL: z
      .string({ error: DATABASE_URL_MISSING })
      .min(1, DATABASE_URL_MISSING),
    DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
    /** Encrypts MFA secrets. At least 32 characters; generate with `openssl rand -base64 48`. */
    AUTH_SECRET: optional,
    /** This site's public address, e.g. https://lumina.example. Used in emails and the OAuth callback. */
    APP_URL: optional,
    COOKIE_SECURE: z.enum(["true", "false"]).optional(),
    /** smtp(s)://user:pass@host:port. Without it, emails are printed to the server log. */
    SMTP_URL: optional,
    MAIL_FROM: z.string().default("Lumina <no-reply@lumina.local>"),
    /** "memory" keeps emails in memory (tests); "log" prints them; default: smtp when SMTP_URL is set. */
    MAIL_TRANSPORT: z.enum(["smtp", "log", "memory"]).optional(),
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    MICROSOFT_CLIENT_ID: optional,
    MICROSOFT_CLIENT_SECRET: optional,
    MICROSOFT_TENANT: z.string().default("common"),
    APPLE_CLIENT_ID: optional,
    APPLE_TEAM_ID: optional,
    APPLE_KEY_ID: optional,
    /** The .p8 key (PEM). Literal "\n" sequences are turned into line breaks. */
    APPLE_PRIVATE_KEY: optional,
  })
  .transform((env, context) => {
    let authSecret = env.AUTH_SECRET;
    // `next build` runs with NODE_ENV=production but needs no secrets (it may read the catalog).
    const building = process.env.NEXT_PHASE === "phase-production-build";
    if (!authSecret) {
      if (env.NODE_ENV === "production" && !building) {
        context.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "AUTH_SECRET is required in production (openssl rand -base64 48)" });
        return z.NEVER;
      }
      authSecret = DEV_AUTH_SECRET;
    } else if (authSecret.length < 32) {
      context.addIssue({ code: "custom", path: ["AUTH_SECRET"], message: "AUTH_SECRET must be at least 32 characters" });
      return z.NEVER;
    }
    return {
      ...env,
      AUTH_SECRET: authSecret,
      APP_URL: env.APP_URL?.replace(/\/$/, ""),
      APPLE_PRIVATE_KEY: env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      MAIL_TRANSPORT: env.MAIL_TRANSPORT ?? (env.SMTP_URL ? "smtp" : env.NODE_ENV === "test" ? "memory" : "log"),
    };
  });

export type ServerConfig = z.output<typeof schema>;

let cached: ServerConfig | null = null;

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function serverConfig(): ServerConfig {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues.map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`).join("\n");
    throw new ConfigError(`Invalid server configuration:\n${problems}`);
  }
  cached = result.data;
  return cached;
}

/** For tests that change the environment. */
export function resetServerConfig() {
  cached = null;
}
