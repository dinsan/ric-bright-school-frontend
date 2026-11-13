import "server-only";

import { createPrivateKey, sign } from "node:crypto";
import { OAUTH_PROVIDERS, type OAuthProvider } from "@/features/auth/contract";
import { serverConfig } from "@/server/config";

/**
 * Google, Microsoft and Apple sign-in (OpenID Connect, authorization code flow). A provider is offered
 * only when its credentials are configured (see .env.example and docs/backend.md).
 */

export type IdTokenClaims = Record<string, unknown> & { iss?: string; aud?: string | string[]; sub?: string; exp?: number; nonce?: string };

export interface Identity {
  subject: string;
  email: string | null;
  /** The provider vouches that this person controls the email address. */
  emailVerified: boolean;
  name: string | null;
}

export interface ProviderConfig {
  id: OAuthProvider;
  authorizeUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: () => string;
  scope: string;
  pkce: boolean;
  /** Apple posts the answer back (form_post) when asking for the name and email. */
  responseMode?: "form_post";
  issuerMatches: (claims: IdTokenClaims) => boolean;
  identity: (claims: IdTokenClaims) => Identity;
}

const str = (value: unknown) => (typeof value === "string" && value ? value : null);
const truthy = (value: unknown) => value === true || value === "true";

/** Personal Microsoft accounts (outlook.com…) all sign in through this tenant; their email is the account name. */
const MICROSOFT_CONSUMER_TENANT = "9188040d-6c67-4c5b-b112-36a304b66dad";

/** Apple wants its client secret as a short-lived JWT signed with the team's private key (ES256). */
function appleClientSecret(): string {
  const config = serverConfig();
  const header = { alg: "ES256", kid: config.APPLE_KEY_ID };
  const now = Math.floor(Date.now() / 1000);
  const payload = { iss: config.APPLE_TEAM_ID, iat: now, exp: now + 300, aud: "https://appleid.apple.com", sub: config.APPLE_CLIENT_ID };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode(header)}.${encode(payload)}`;
  const signature = sign("sha256", Buffer.from(input), { key: createPrivateKey(config.APPLE_PRIVATE_KEY!), dsaEncoding: "ieee-p1363" });
  return `${input}.${signature.toString("base64url")}`;
}

export function providerConfig(id: OAuthProvider): ProviderConfig | null {
  const config = serverConfig();
  switch (id) {
    case "google":
      if (!config.GOOGLE_CLIENT_ID || !config.GOOGLE_CLIENT_SECRET) return null;
      return {
        id,
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        clientId: config.GOOGLE_CLIENT_ID,
        clientSecret: () => config.GOOGLE_CLIENT_SECRET!,
        scope: "openid email profile",
        pkce: true,
        issuerMatches: (claims) => claims.iss === "https://accounts.google.com" || claims.iss === "accounts.google.com",
        identity: (claims) => ({
          subject: String(claims.sub),
          email: str(claims.email)?.toLowerCase() ?? null,
          emailVerified: truthy(claims.email_verified),
          name: str(claims.name),
        }),
      };
    case "microsoft": {
      if (!config.MICROSOFT_CLIENT_ID || !config.MICROSOFT_CLIENT_SECRET) return null;
      const base = `https://login.microsoftonline.com/${encodeURIComponent(config.MICROSOFT_TENANT)}/oauth2/v2.0`;
      return {
        id,
        authorizeUrl: `${base}/authorize`,
        tokenUrl: `${base}/token`,
        clientId: config.MICROSOFT_CLIENT_ID,
        clientSecret: () => config.MICROSOFT_CLIENT_SECRET!,
        scope: "openid email profile",
        pkce: true,
        // Multi-tenant apps get an issuer per tenant: https://login.microsoftonline.com/{tid}/v2.0
        issuerMatches: (claims) => typeof claims.tid === "string" && claims.iss === `https://login.microsoftonline.com/${claims.tid}/v2.0`,
        identity: (claims) => ({
          subject: String(claims.sub),
          email: (str(claims.email) ?? null)?.toLowerCase() ?? null,
          // Work accounts' `email` is not verified by Microsoft unless the domain is (optional claim xms_edov).
          emailVerified: Boolean(str(claims.email)) && (claims.tid === MICROSOFT_CONSUMER_TENANT || truthy(claims.xms_edov)),
          name: str(claims.name),
        }),
      };
    }
    case "apple":
      if (!config.APPLE_CLIENT_ID || !config.APPLE_TEAM_ID || !config.APPLE_KEY_ID || !config.APPLE_PRIVATE_KEY) return null;
      return {
        id,
        authorizeUrl: "https://appleid.apple.com/auth/authorize",
        tokenUrl: "https://appleid.apple.com/auth/token",
        clientId: config.APPLE_CLIENT_ID,
        clientSecret: appleClientSecret,
        scope: "name email",
        pkce: false,
        responseMode: "form_post",
        issuerMatches: (claims) => claims.iss === "https://appleid.apple.com",
        identity: (claims) => ({
          subject: String(claims.sub),
          email: str(claims.email)?.toLowerCase() ?? null,
          emailVerified: truthy(claims.email_verified),
          name: null, // Apple sends the name once, in the form post (see the callback route).
        }),
      };
  }
}

export function configuredProviders(): OAuthProvider[] {
  return OAUTH_PROVIDERS.filter((id) => providerConfig(id) !== null);
}
