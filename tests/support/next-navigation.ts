import { vi } from "vitest";

/**
 * Stand-in for next/navigation in component tests. In a test file:
 *   vi.mock("next/navigation", () => import("../support/next-navigation"));
 * then inspect `router.push` / `router.replace`, or call `setLocation("/courses?grade=4")`.
 */
let pathname = "/";
let searchParams = new URLSearchParams();

export const router = {
  push: vi.fn((href: string) => setLocation(href)),
  replace: vi.fn((href: string) => setLocation(href)),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

export function setLocation(href: string) {
  const url = new URL(href, "http://localhost");
  pathname = url.pathname;
  searchParams = url.searchParams;
}

export function resetNavigation() {
  setLocation("/");
  Object.values(router).forEach((fn) => fn.mockClear());
}

export const useRouter = () => router;
export const usePathname = () => pathname;
export const useSearchParams = () => searchParams;
export const redirect = vi.fn();
export const notFound = vi.fn();
