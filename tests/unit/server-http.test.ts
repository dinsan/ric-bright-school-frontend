import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { escapeLike, isDatabaseUnavailable, isUniqueViolation, pgErrorCode } from "@/server/db";
import { fieldError, HttpError, tooManyRequests } from "@/server/http/errors";
import { clientIp, isSecureRequest, publicOrigin } from "@/server/http/request";
import { json, route } from "@/server/http/route";
import { parseBody, parseId, parseQuery } from "@/server/http/validation";
import { resetServerConfig } from "@/server/config";

const post = (body: string, headers: Record<string, string> = {}) =>
  new NextRequest("http://lumina.test/api/x", {
    method: "POST",
    body,
    headers: { host: "lumina.test", origin: "http://lumina.test", "x-requested-with": "lumina", "content-type": "application/json", ...headers },
  });

describe("request validation", () => {
  const schema = z.object({ email: z.email(), age: z.number().int().min(5) });

  it("accepts valid JSON, and an empty body as {}", async () => {
    await expect(parseBody(post('{"email":"a@b.co","age":9}'), schema)).resolves.toEqual({ email: "a@b.co", age: 9 });
    await expect(parseBody(post(""), z.object({ note: z.string().optional() }))).resolves.toEqual({});
  });

  it("answers 422 with body.<field> details and friendly messages", async () => {
    const error = (await parseBody(post('{"email":"nope","age":2}'), schema).catch((caught: unknown) => caught)) as HttpError;
    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(422);
    expect(error.details).toEqual([
      { field: "body.email", message: "Enter an email address like name@example.com." },
      { field: "body.age", message: "Enter a number that is 5 or more." },
    ]);
  });

  it("refuses broken JSON (400) and oversized bodies (413)", async () => {
    await expect(parseBody(post("{not json"), schema)).rejects.toMatchObject({ status: 400, code: "invalid_json" });
    await expect(parseBody(post(JSON.stringify({ text: "x".repeat(70_000) })), z.object({}))).rejects.toMatchObject({ status: 413 });
  });

  it("validates query strings with query.<field> details, ignoring empty values", () => {
    const querySchema = z.object({ grade: z.coerce.number().int().max(12).optional(), q: z.string().optional() });
    expect(parseQuery(new Request("http://x/api?grade=4&q="), querySchema)).toEqual({ grade: 4 });
    expect(() => parseQuery(new Request("http://x/api?grade=13"), querySchema)).toThrow(expect.objectContaining({ details: [expect.objectContaining({ field: "query.grade" })] }));
  });

  it("treats ids that aren't UUIDs as not found", () => {
    expect(parseId("6f1f0d3e-8a4c-4e55-9c2b-3b0e7c1d2a10")).toBe("6f1f0d3e-8a4c-4e55-9c2b-3b0e7c1d2a10");
    expect(() => parseId("1 or 1=1", "That user")).toThrow(expect.objectContaining({ status: 404, message: "That user was not found." }));
  });
});

describe("the route wrapper", () => {
  const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

  it("answers errors in the envelope, with the request id", async () => {
    const handler = route(async () => {
      throw fieldError("email", "This email is taken.", { status: 409, code: "email_taken" });
    });
    const response = await handler(post("{}", { "x-request-id": "req-42" }), {});
    expect(response.status).toBe(409);
    expect(response.headers.get("x-request-id")).toBe("req-42");
    expect(await response.json()).toEqual({
      error: { code: "email_taken", message: "This email is taken.", details: [{ field: "body.email", message: "This email is taken." }], request_id: "req-42" },
    });
  });

  it("passes Retry-After through for rate limits", async () => {
    const response = await route(async () => {
      throw tooManyRequests(42.2);
    })(post("{}"), {});
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("43");
  });

  it("refuses cross-site writes before running the handler", async () => {
    const handler = vi.fn(async () => json({ ran: true }));
    const response = await route(handler)(post("{}", { origin: "https://evil.example" }), {});
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it("turns an unreachable database into 503 (try again), never a sign-out", async () => {
    quiet();
    const outage = Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:5432"), { code: "ECONNREFUSED" });
    const response = await route(async () => {
      throw new Error("Failed query", { cause: outage });
    })(post("{}"), {});
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("30");
    expect((await response.json()).error.code).toBe("service_unavailable");
  });

  it("hides unexpected errors behind a 500 without internals", async () => {
    quiet();
    const response = await route(async () => {
      throw new Error("secret stack detail");
    })(post("{}"), {});
    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain("secret stack detail");
    expect(JSON.parse(text).error.request_id).toBeTruthy();
  });

  it("marks answers uncacheable unless the handler says otherwise", async () => {
    const plain = await route(async () => json({}))(new NextRequest("http://lumina.test/api/x"), {});
    expect(plain.headers.get("cache-control")).toBe("no-store");
    const cached = await route(async () => json({}, { headers: { "cache-control": "public, max-age=60" } }))(new NextRequest("http://lumina.test/api/x"), {});
    expect(cached.headers.get("cache-control")).toBe("public, max-age=60");
  });
});

describe("database errors", () => {
  /** A Prisma error as the pg driver adapter reports it (shapes observed with Prisma 7 + @prisma/adapter-pg). */
  const prismaError = (code: string, cause: Record<string, unknown>) =>
    new Prisma.PrismaClientKnownRequestError("Invalid invocation", {
      code,
      clientVersion: "7",
      meta: { driverAdapterError: { name: "DriverAdapterError", cause } },
    });

  it("tell an outage apart from a bad query, for Prisma errors", () => {
    expect(isDatabaseUnavailable(prismaError("P1001", { kind: "DatabaseNotReachable", host: "db", port: 5432 }))).toBe(true);
    // $queryRaw reports every failure as P2010; the cause tells.
    expect(isDatabaseUnavailable(prismaError("P2010", { kind: "DatabaseNotReachable", host: "db", port: 5432 }))).toBe(true);
    expect(isDatabaseUnavailable(prismaError("P2039", { kind: "postgres", code: "57P01", originalCode: "57P01" }))).toBe(true);
    expect(isDatabaseUnavailable(prismaError("P2010", { kind: "ConnectionClosed" }))).toBe(true);
    expect(isDatabaseUnavailable(new Prisma.PrismaClientInitializationError("Can't reach database server", "7"))).toBe(true);
    expect(isDatabaseUnavailable(prismaError("P2002", { kind: "UniqueConstraintViolation", originalCode: "23505" }))).toBe(false);
    expect(isDatabaseUnavailable(prismaError("P2010", { kind: "postgres", code: "22012", originalCode: "22012" }))).toBe(false);
  });

  it("tell an outage apart from a bad query, for driver and network errors", () => {
    expect(isDatabaseUnavailable(Object.assign(new Error("x"), { code: "ECONNREFUSED" }))).toBe(true);
    expect(isDatabaseUnavailable(new Error("Failed query", { cause: Object.assign(new Error("x"), { code: "57P01" }) }))).toBe(true);
    expect(isDatabaseUnavailable(new AggregateError([Object.assign(new Error("x"), { code: "ETIMEDOUT" })]))).toBe(true);
    expect(isDatabaseUnavailable(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(false);
  });

  it("find the PostgreSQL error code, never mistaking a Prisma code for one", () => {
    expect(pgErrorCode(prismaError("P2002", { kind: "UniqueConstraintViolation", originalCode: "23505" }))).toBe("23505");
    expect(pgErrorCode(prismaError("P2010", { kind: "postgres", code: "23514", originalCode: "23514" }))).toBe("23514");
    expect(pgErrorCode(new Prisma.PrismaClientKnownRequestError("x", { code: "P2002", clientVersion: "7" }))).toBe("23505");
    expect(pgErrorCode(new Prisma.PrismaClientKnownRequestError("x", { code: "P2025", clientVersion: "7" }))).toBeUndefined();
    expect(pgErrorCode(new Error("Failed query", { cause: Object.assign(new Error("dup"), { code: "23505" }) }))).toBe("23505");
    expect(pgErrorCode(new Error("plain"))).toBeUndefined();
    expect(isUniqueViolation(prismaError("P2002", { kind: "UniqueConstraintViolation", originalCode: "23505" }))).toBe(true);
    expect(isUniqueViolation(prismaError("P2003", { kind: "ForeignKeyConstraintViolation", originalCode: "23503" }))).toBe(false);
  });

  it("escape LIKE wildcards typed in a search", () => {
    expect(escapeLike("100% fun_x")).toBe("100\\% fun\\_x");
    expect(escapeLike("back\\slash")).toBe("back\\\\slash");
  });
});

describe("proxy headers", () => {
  afterEach(() => {
    delete process.env.APP_URL;
    delete process.env.COOKIE_SECURE;
    resetServerConfig();
  });
  const request = (headers: Record<string, string>, url = "http://0.0.0.0:3000/x") => new Request(url, { headers });

  it("reads the client IP from the first X-Forwarded-For entry, or X-Real-IP", () => {
    expect(clientIp(request({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(request({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(request({}))).toBeNull();
  });

  it("builds the public origin from APP_URL, else the forwarded host and protocol", () => {
    expect(publicOrigin(request({ host: "internal:3000", "x-forwarded-host": "lumina.example", "x-forwarded-proto": "https" }))).toBe("https://lumina.example");
    process.env.APP_URL = "https://app.lumina.example/";
    resetServerConfig();
    expect(publicOrigin(request({ host: "internal:3000" }))).toBe("https://app.lumina.example");
  });

  it("uses Secure cookies on HTTPS (also behind a TLS proxy), unless forced", () => {
    expect(isSecureRequest(request({ "x-forwarded-proto": "https" }))).toBe(true);
    expect(isSecureRequest(request({}))).toBe(false);
    process.env.COOKIE_SECURE = "true";
    resetServerConfig();
    expect(isSecureRequest(request({}))).toBe(true);
  });
});
