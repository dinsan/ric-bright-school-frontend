import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch } from "@/lib/api-client";

/** The browser's API client, with fetch replaced. */
describe("apiFetch", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("window", { location: { origin: "http://lumina.test" } });
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("calls this site's /api with the CSRF header and the session cookie, and drops empty query values", async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true }));
    await expect(apiFetch("/courses", { searchParams: { grade_level: 4, q: "", subject: undefined, page: null } })).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://lumina.test/api/courses?grade_level=4");
    expect(init.credentials).toBe("same-origin");
    expect(init.headers).toMatchObject({ Accept: "application/json", "X-Requested-With": "lumina" });
    expect(init.body).toBeUndefined();
  });

  it("sends JSON bodies", async () => {
    fetchMock.mockResolvedValue(Response.json({}));
    await apiFetch("/me", { method: "PATCH", json: { display_name: "Ada" } });
    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.method).toBe("PATCH");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe('{"display_name":"Ada"}');
  });

  it("returns undefined for 204 No Content", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(apiFetch("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
  });

  it("turns the error envelope into a typed ApiError", async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { code: "validation_error", message: "Check the highlighted answers.", details: [{ field: "body.email", message: "Enter an email." }], request_id: "req-1" } },
        { status: 422 },
      ),
    );
    const error = await apiFetch("/auth/register", { method: "POST", json: {} }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "validation_error", message: "Check the highlighted answers.", requestId: "req-1" });
    expect((error as ApiError).details).toEqual([{ field: "body.email", message: "Enter an email." }]);
  });

  it("copes with error responses that aren't JSON", async () => {
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));
    const error = (await apiFetch("/courses").catch((caught: unknown) => caught)) as ApiError;
    expect(error).toMatchObject({ status: 502, code: "unknown_error", message: "Request failed with status 502", details: [] });
  });

  it("lets network failures through as they are (forms explain them)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(apiFetch("/courses")).rejects.toBeInstanceOf(TypeError);
  });
});
