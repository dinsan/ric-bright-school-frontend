import "server-only";

import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { OAUTH_CALLBACK_PATH, roleHome, type OAuthIntent, type OAuthProvider } from "@/features/auth/contract";
import { safeNextPath } from "@/lib/safe-redirect";
import { findUserByEmail, findUserById } from "@/server/accounts/queries";
import { getAuth } from "@/server/auth/context";
import { randomToken } from "@/server/auth/crypto";
import { completeSignIn, type SignInOutcome } from "@/server/auth/sign-in";
import { consumeToken, issueToken } from "@/server/auth/tokens";
import { getDb, isUniqueViolation, type UserRow } from "@/server/db";
import { notFound } from "@/server/http/errors";
import { publicOrigin } from "@/server/http/request";
import { providerConfig, type IdTokenClaims, type Identity, type ProviderConfig } from "./providers";

/**
 * The OAuth round trip, done by this server (no separate backend):
 * 1. start:    a state (bound to this browser by an httpOnly cookie), a PKCE verifier and a nonce are
 *              stored as a one-time token; the browser goes to the provider.
 * 2. callback: the state must match the cookie and is used once; the code is exchanged for an ID token
 *              directly with the provider over TLS (so, per OpenID Connect Core 3.1.3.7, the TLS
 *              connection authenticates the issuer); issuer, audience, expiry and nonce are checked.
 * 3. outcome:  sign in (a linked identity), sign up (intent=signup, with a role and a verified email), or
 *              link to the signed-in account (intent=link). Never links to an existing account just because
 *              the email matches: that would let whoever controls the provider account take it over.
 */

export interface StartOptions {
  intent: OAuthIntent;
  next?: string | null;
  role?: "parent" | "teacher" | null;
}

function callbackUrl(request: Request) {
  return `${publicOrigin(request)}${OAUTH_CALLBACK_PATH}`;
}

export async function startOAuth(request: NextRequest, provider: OAuthProvider, { intent, next, role }: StartOptions): Promise<{ url: string; state: string } | { signInFirst: true }> {
  const config = providerConfig(provider);
  if (!config) throw notFound("That sign-in option");
  let userId: string | null = null;
  if (intent === "link") {
    const auth = await getAuth(request);
    if (!auth) return { signInFirst: true };
    userId = auth.user.id;
  }
  const state = randomToken();
  const codeVerifier = randomToken(32);
  const nonce = randomToken(16);
  const redirectUri = callbackUrl(request);
  await issueToken("oauth_state", {
    raw: state,
    userId,
    replace: false,
    data: { provider, intent, next: safeNextPath(next), role: intent === "signup" ? role : null, codeVerifier, nonce, redirectUri },
  });

  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", config.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  if (config.responseMode) url.searchParams.set("response_mode", config.responseMode);
  if (config.pkce) {
    url.searchParams.set("code_challenge", createHash("sha256").update(codeVerifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
  }
  if (provider === "google") url.searchParams.set("prompt", "select_account");
  return { url: url.toString(), state };
}

/** Where the browser goes after the callback, and what to store in its cookies. */
export interface CallbackResult {
  redirect: string;
  signIn?: SignInOutcome;
}

interface StateData {
  provider: OAuthProvider;
  intent: OAuthIntent;
  next: string | null;
  role: "parent" | "teacher" | null;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

export interface CallbackParams {
  code: string | null;
  state: string | null;
  error: string | null;
  /** Apple sends the person's name once, on first sign-up. */
  name?: string | null;
}

export async function finishOAuth(request: NextRequest, params: CallbackParams, cookieState: string | undefined): Promise<CallbackResult> {
  const signInError = (reason = "oauth") => ({ redirect: `/sign-in?error=${reason}` });
  if (!params.state || !cookieState || params.state !== cookieState) return signInError();
  const token = await consumeToken("oauth_state", params.state);
  if (!token) return signInError();
  const data = token.data as unknown as StateData;
  const linkFailed = { redirect: `/account/security?link=failed&provider=${data.provider}` };
  const config = providerConfig(data.provider);
  if (!config || params.error || !params.code) return data.intent === "link" ? linkFailed : signInError();

  let identity: Identity;
  try {
    identity = await exchangeCode(config, params.code, data);
  } catch (error) {
    console.error(`[oauth] ${data.provider} code exchange failed`, error);
    return data.intent === "link" ? linkFailed : signInError();
  }
  if (params.name && !identity.name) identity.name = params.name.slice(0, 80);

  const db = getDb();
  const existing = await db.oAuthAccount.findUnique({
    where: { provider_subject: { provider: data.provider, subject: identity.subject } },
  });

  if (data.intent === "link") {
    const auth = await getAuth(request);
    if (!auth || auth.user.id !== token.userId) return linkFailed;
    if (existing) return existing.userId === auth.user.id ? { redirect: `/account/security?link=done&provider=${data.provider}` } : linkFailed;
    try {
      await db.oAuthAccount.create({ data: { userId: auth.user.id, provider: data.provider, subject: identity.subject, email: identity.email } });
    } catch (error) {
      if (isUniqueViolation(error)) return linkFailed; // already has an account of this provider
      throw error;
    }
    return { redirect: `/account/security?link=done&provider=${data.provider}` };
  }

  let user: UserRow | null = existing ? await findUserById(existing.userId) : null;
  if (!user) {
    if (data.intent !== "signup" || !data.role) return signInError("oauth_no_account");
    if (!identity.email || !identity.emailVerified) return signInError("oauth_email_unverified");
    if (await findUserByEmail(identity.email)) return signInError("oauth_email_taken");
    user = await createOAuthUser(data.role, identity, data.provider);
    if (!user) return signInError("oauth_email_taken");
  }
  if (!user.isActive) return signInError("account_disabled");

  const outcome = await completeSignIn(user, request);
  if (outcome.kind === "mfa") {
    const next = data.next ? `&next=${encodeURIComponent(data.next)}` : "";
    return { redirect: `/sign-in?step=mfa${next}`, signIn: outcome };
  }
  return { redirect: data.next ?? roleHome[user.role], signIn: outcome };
}

async function createOAuthUser(role: "parent" | "teacher", identity: Identity, provider: OAuthProvider): Promise<UserRow | null> {
  const displayName = (identity.name ?? identity.email!.split("@")[0] ?? "Lumina user").slice(0, 80);
  try {
    // The user, their teacher profile and the linked identity: one nested create, one transaction.
    return await getDb().user.create({
      data: {
        role,
        displayName,
        email: identity.email,
        emailVerifiedAt: new Date(),
        language: "en",
        ...(role === "teacher" ? { teacherProfile: { create: {} } } : {}),
        oauthAccounts: { create: { provider, subject: identity.subject, email: identity.email } },
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

async function exchangeCode(config: ProviderConfig, code: string, data: StateData): Promise<Identity> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: data.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret(),
  });
  if (config.pkce) body.set("code_verifier", data.codeVerifier);
  const response = await fetch(config.tokenUrl, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`token endpoint answered ${response.status}`);
  const tokens = (await response.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("no id_token in the token response");
  const claims = decodeIdToken(tokens.id_token);
  validateClaims(config, claims, data.nonce);
  return config.identity(claims);
}

export function decodeIdToken(idToken: string): IdTokenClaims {
  const payload = idToken.split(".")[1];
  if (!payload) throw new Error("malformed id_token");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as IdTokenClaims;
}

export function validateClaims(config: Pick<ProviderConfig, "clientId" | "issuerMatches">, claims: IdTokenClaims, nonce: string) {
  if (!config.issuerMatches(claims)) throw new Error("unexpected issuer");
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(config.clientId)) throw new Error("unexpected audience");
  if (typeof claims.exp !== "number" || claims.exp * 1000 < Date.now() - 60_000) throw new Error("expired id_token");
  if (claims.nonce !== nonce) throw new Error("nonce mismatch");
  if (typeof claims.sub !== "string" || !claims.sub) throw new Error("no subject");
}
