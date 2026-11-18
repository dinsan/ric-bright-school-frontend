import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoursesPricing } from "@/features/admin/components/courses-pricing";
import { CourseCard } from "@/features/catalog/components/course-card";
import type { AdminCourse } from "@/features/catalog/types";
import { course, maths, page } from "../support/fixtures";
import { resetNavigation, setLocation } from "../support/next-navigation";
import { apiErrorResponse, mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));

beforeEach(() => {
  resetNavigation();
  setLocation("/admin/courses");
});

function adminCourse(overrides: Partial<AdminCourse> = {}): AdminCourse {
  return {
    id: "c1",
    slug: "fractions",
    title: "Fractions Made Simple",
    grade_level: 4,
    price_cents: 1250,
    status: "published",
    updated_at: "2025-01-15T09:00:00Z",
    subject: maths,
    ...overrides,
  };
}

describe("course price badge (public)", () => {
  it("shows Free for free courses and the price for paid ones", () => {
    const { unmount } = renderWithProviders(<CourseCard course={course()} />);
    expect(screen.getByText("Free")).toBeInTheDocument();
    unmount();
    renderWithProviders(<CourseCard course={course({ price_cents: 1250 })} />);
    expect(screen.getByText("$12.50")).toBeInTheDocument();
  });
});

describe("CoursesPricing (admin)", () => {
  it("lists courses with their price and saves a new one", async () => {
    let saved: unknown = null;
    mockApi({
      "GET /api/admin/courses": () => Response.json(page([adminCourse(), adminCourse({ id: "c2", slug: "counting", title: "Counting to 100", grade_level: 1, price_cents: 0 })])),
      "PATCH /api/admin/courses/c1": ({ body }) => {
        saved = body;
        return Response.json(adminCourse({ price_cents: (body as { price_cents: number }).price_cents }));
      },
    });
    const { user } = renderWithProviders(<CoursesPricing />);
    expect(await screen.findByText("Fractions Made Simple")).toBeInTheDocument();
    expect(screen.getByText("2 courses")).toBeInTheDocument();
    // The free course is marked Free.
    expect(screen.getByText("Free")).toBeInTheDocument();

    const input = screen.getByLabelText("Price of Fractions Made Simple (dollars)");
    expect(input).toHaveValue("12.50");
    await user.clear(input);
    await user.type(input, "19.99");
    const form = input.closest("form")!;
    await user.click(within(form as HTMLElement).getByRole("button", { name: "Save" }));
    await waitFor(() => expect(saved).toEqual({ price_cents: 1999 }));
    expect(await screen.findByText("Fractions Made Simple is now $19.99")).toBeInTheDocument();
  });

  it("explains a price that isn't a price without calling the API", async () => {
    const fetchMock = mockApi({
      "GET /api/admin/courses": () => Response.json(page([adminCourse()])),
    });
    const { user } = renderWithProviders(<CoursesPricing />);
    const input = await screen.findByLabelText("Price of Fractions Made Simple (dollars)");
    await user.clear(input);
    await user.type(input, "abc");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Enter a price from 0 to 999.99 (0 = free).")).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH")).toHaveLength(0);
  });

  it("reports a failed save and keeps the typed price", async () => {
    mockApi({
      "GET /api/admin/courses": () => Response.json(page([adminCourse()])),
      "PATCH /api/admin/courses/c1": () => apiErrorResponse(503, "service_unavailable", "Lumina can't reach its database right now. Try again in a moment."),
    });
    const { user } = renderWithProviders(<CoursesPricing />);
    const input = await screen.findByLabelText("Price of Fractions Made Simple (dollars)");
    await user.clear(input);
    await user.type(input, "5");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("The price wasn't saved")).toBeInTheDocument();
    expect(input).toHaveValue("5");
  });
});
