import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoursesBrowser } from "@/features/catalog/components/courses-browser";
import { GradePicker } from "@/features/catalog/components/grade-picker";
import { course, maths, page, science } from "../support/fixtures";
import { resetNavigation, router, setLocation } from "../support/next-navigation";
import { apiErrorResponse, mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));

beforeEach(() => {
  resetNavigation();
  setLocation("/courses");
});

const subjects = () => Response.json([maths, science]);

describe("CoursesBrowser", () => {
  it("shows courses with their count, and the subjects as a filter", async () => {
    mockApi({
      "GET /api/subjects": subjects,
      "GET /api/courses": () => Response.json(page([course(), course({ slug: "plants", title: "Plants and How They Grow", subject: science })])),
    });
    renderWithProviders(<CoursesBrowser />);
    expect(await screen.findByRole("link", { name: /Fractions Made Simple/ })).toHaveAttribute("href", "/courses/fractions");
    expect(screen.getByRole("heading", { name: "2 courses" })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: "Science" })).toBeInTheDocument();
  });

  it("sends the URL's filters to the API and keeps new filters in the URL", async () => {
    setLocation("/courses?grade=4&subject=science&q=plants&page=2");
    const fetchMock = mockApi({ "GET /api/subjects": subjects, "GET /api/courses": () => Response.json(page([course()], 13, 12)) });
    const { user } = renderWithProviders(<CoursesBrowser />);
    await screen.findByRole("link", { name: /Fractions Made Simple/ });
    const coursesCall = fetchMock.mock.calls.map(([url]) => new URL(String(url))).find((url) => url.pathname === "/api/courses")!;
    expect(Object.fromEntries(coursesCall.searchParams)).toEqual({ grade_level: "4", subject: "science", q: "plants", limit: "12", offset: "12" });

    await user.click(screen.getByRole("button", { name: "Grade 7" }));
    expect(router.replace).toHaveBeenLastCalledWith("/courses?grade=7&subject=science&q=plants", { scroll: false });
  });

  it("explains a failed load and retries", async () => {
    let fail = true;
    mockApi({
      "GET /api/subjects": subjects,
      "GET /api/courses": () => (fail ? apiErrorResponse(503, "service_unavailable", "Lumina can't reach its database right now.") : Response.json(page([course()]))),
    });
    const { user } = renderWithProviders(<CoursesBrowser />);
    expect(await screen.findByRole("heading", { name: "Courses did not load" })).toBeInTheDocument();
    expect(screen.getByText("Lumina can't reach its database right now.")).toBeInTheDocument();
    fail = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: /Fractions Made Simple/ })).toBeInTheDocument();
  });

  it("tells filtered empty results apart from an empty catalog", async () => {
    setLocation("/courses?q=zzz");
    mockApi({ "GET /api/subjects": subjects, "GET /api/courses": () => Response.json(page([])) });
    const { user } = renderWithProviders(<CoursesBrowser />);
    expect(await screen.findByRole("heading", { name: "No courses match these filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(router.replace).toHaveBeenLastCalledWith("/courses", { scroll: false });
  });

  it("R: a page past the end says so and offers the last page, instead of 'No courses yet'", async () => {
    setLocation("/courses?page=99");
    mockApi({ "GET /api/subjects": subjects, "GET /api/courses": () => Response.json(page([], 30, 1176)) });
    const { user } = renderWithProviders(<CoursesBrowser />);
    expect(await screen.findByRole("heading", { name: "There is no page 99" })).toBeInTheDocument();
    expect(screen.queryByText("No courses yet")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Go to page 3" }));
    expect(router.replace).toHaveBeenLastCalledWith("/courses?page=3", { scroll: false });
  });

  it("R: the search box follows the URL when filters are cleared elsewhere", async () => {
    setLocation("/courses?q=plants");
    mockApi({ "GET /api/subjects": subjects, "GET /api/courses": () => Response.json(page([course()])) });
    const { rerender } = renderWithProviders(<CoursesBrowser />);
    const box = screen.getByRole("searchbox", { name: "Search by title" });
    expect(box).toHaveValue("plants");
    setLocation("/courses");
    rerender(<CoursesBrowser />);
    await waitFor(() => expect(box).toHaveValue(""));
  });
});

describe("accessible names", () => {
  it("R: grade tiles are named 'Grade 4' (not 'Grade4'), course cards include grade and subject", async () => {
    renderWithProviders(<GradePicker />);
    expect(screen.getByRole("link", { name: "Grade 4" })).toHaveAttribute("href", "/courses?grade=4");
    expect(screen.getByRole("link", { name: "Grade 12" })).toBeInTheDocument();
    mockApi({ "GET /api/subjects": subjects, "GET /api/courses": () => Response.json(page([course()])) });
    renderWithProviders(<CoursesBrowser />);
    expect(await screen.findByRole("link", { name: /Grade 4, Mathematics/ })).toBeInTheDocument();
  });
});
