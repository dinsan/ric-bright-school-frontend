import { NextRequest } from "next/server";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Handler = (request: NextRequest, context: any) => Promise<Response> | Response;

export interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** Path and query, e.g. "/api/courses?grade_level=4" (only used to build the request URL). */
  path?: string;
  body?: unknown;
  params?: Record<string, string>;
  headers?: Record<string, string>;
  /** Send the app's CSRF header and a same-site Origin on state-changing requests (default true). */
  sameSite?: boolean;
}

export interface CallResult<T = any> {
  status: number;
  body: T;
  headers: Headers;
}

export const ORIGIN = "http://lumina.test";

/**
 * A minimal browser for API tests: keeps cookies between calls (honouring deletions), and sends the
 * headers the real client sends (lib/api-client.ts).
 */
export class Browser {
  readonly cookies = new Map<string, string>();

  constructor(readonly userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36") {}

  async call<T = any>(handler: Handler, { method = "GET", path = "/api", body, params = {}, headers = {}, sameSite = true }: CallOptions = {}): Promise<CallResult<T>> {
    const requestHeaders = new Headers({ host: new URL(ORIGIN).host, "user-agent": this.userAgent, accept: "application/json", ...headers });
    if (sameSite && method !== "GET") {
      requestHeaders.set("origin", ORIGIN);
      requestHeaders.set("x-requested-with", "lumina");
    }
    if (this.cookies.size) requestHeaders.set("cookie", [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "));
    if (body !== undefined) requestHeaders.set("content-type", "application/json");
    const request = new NextRequest(new URL(path, ORIGIN), {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const response = await handler(request, { params: Promise.resolve(params) });
    this.absorbCookies(response.headers);
    const text = await response.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON (redirects, HTML).
    }
    return { status: response.status, body: parsed as T, headers: response.headers };
  }

  absorbCookies(headers: Headers) {
    for (const line of headers.getSetCookie()) {
      const [pair, ...attributes] = line.split(";").map((part) => part.trim());
      const index = pair!.indexOf("=");
      const name = pair!.slice(0, index);
      const value = decodeURIComponent(pair!.slice(index + 1));
      const expired = attributes.some((attribute) => {
        const [key, val] = attribute.split("=");
        if (key?.toLowerCase() === "max-age") return Number(val) <= 0;
        if (key?.toLowerCase() === "expires") return new Date(val!).getTime() <= Date.now();
        return false;
      });
      if (expired || value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  /** Cookie attributes as set by the last response that set `name` (for checking httpOnly etc.). */
  static cookieLine(headers: Headers, name: string): string | undefined {
    return headers.getSetCookie().find((line) => line.startsWith(`${name}=`));
  }
}
