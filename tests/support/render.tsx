import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Renders a component with the app's providers (TanStack Query without retries, tooltips, toasts) and
 * returns a user-event instance for realistic typing and clicking.
 */
export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
  return { user: userEvent.setup(), queryClient, ...render(ui, { wrapper: Wrapper, ...options }) };
}

/**
 * Replaces fetch with a handler keyed by "METHOD /path" (query string ignored); unknown requests fail
 * the test with a clear message. Returns the mock, to inspect calls.
 */
export function mockApi(routes: Record<string, (request: { url: URL; body: unknown }) => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init?.method ?? "GET").toUpperCase();
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) throw new Error(`Unexpected request in test: ${method} ${url.pathname}`);
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    return handler({ url, body });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** An API error response in the app's envelope. */
export function apiErrorResponse(status: number, code: string, message: string, details: Array<{ field: string; message: string }> = []) {
  return Response.json({ error: { code, message, details, request_id: "test" } }, { status });
}
