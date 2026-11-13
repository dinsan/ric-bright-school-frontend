import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchButton } from "@/features/search/components/search-button";
import type { SearchHit, SearchResults } from "@/features/search/types";
import { resetNavigation, router } from "../support/next-navigation";
import { mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));
beforeEach(() => resetNavigation());

const maths = { slug: "mathematics", name: "Mathematics" };
const courseHit: SearchHit = { kind: "course", id: "c1", title: "Fractions Made Simple", summary: "Halves and quarters.", url: "/courses/fractions", grade_level: 4, subject: maths };
const lessonHit: SearchHit = {
  kind: "lesson",
  id: "l1",
  title: "Equivalent fractions",
  summary: "One half is two quarters.",
  url: "/courses/fractions#lesson-equivalent-fractions",
  grade_level: 4,
  subject: maths,
  course: { slug: "fractions", title: "Fractions Made Simple" },
  duration_minutes: 15,
};

function results(overrides: Partial<SearchResults> = {}): SearchResults {
  return { query: "frac", grade: null, courses: [courseHit], lessons: [lessonHit], more: { courses: false, lessons: false }, approximate: false, ...overrides };
}

function setup(answer: (q: string) => SearchResults = () => results()) {
  const fetchMock = mockApi({ "GET /api/search": ({ url }) => Response.json(answer(url.searchParams.get("q") ?? "")) });
  return { fetchMock, ...renderWithProviders(<SearchButton />) };
}

const combobox = () => screen.getByRole("combobox", { name: "Search courses and lessons" });

describe("global search", () => {
  it("is a link to the search page (works before JavaScript), opening the dialog with focus in the box", async () => {
    const { user } = setup();
    expect(screen.getByRole("link", { name: /Search/ })).toHaveAttribute("href", "/search");
    await user.click(screen.getByRole("link", { name: /Search/ }));
    expect(screen.getByRole("dialog", { name: "Search courses and lessons" })).toBeInTheDocument();
    expect(combobox()).toHaveFocus();
    expect(screen.getByRole("button", { name: "python" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("link", { name: /Search/ })).toHaveFocus();
  });

  it("opens with Ctrl+K and with '/', but not when '/' is typed in a field", async () => {
    const { user } = setup();
    const link = document.createElement("a");
    link.href = "/somewhere";
    link.textContent = "A link on the page";
    document.body.append(link);
    link.focus();
    await user.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(combobox()).toHaveFocus();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    // Back where you were.
    expect(link).toHaveFocus();
    link.remove();

    await user.keyboard("/");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.keyboard("{Escape}");

    const field = document.createElement("input");
    document.body.append(field);
    field.focus();
    await user.keyboard("/");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(field).toHaveValue("/");
    field.remove();
  });

  it("shows courses and lessons while typing, grouped, with the matching words marked", async () => {
    const { user, fetchMock } = setup();
    await user.click(screen.getByRole("link", { name: /Search/ }));
    await user.type(combobox(), "frac");
    await screen.findByRole("option", { name: /^Fractions Made Simple/ });
    const listbox = screen.getByRole("listbox", { name: "Search results" });
    const courses = within(listbox).getByRole("group", { name: "Courses" });
    const lessons = within(listbox).getByRole("group", { name: "Lessons" });
    expect(within(courses).getByRole("option", { name: /^Fractions Made Simple/ })).toBeInTheDocument();
    expect(within(lessons).getByRole("option", { name: /Equivalent fractions.*Lesson in Fractions Made Simple.*15 min/ })).toBeInTheDocument();
    expect(within(listbox).getAllByText("Frac", { selector: "mark" }).length).toBeGreaterThan(0);
    expect(within(listbox).getByRole("option", { name: /See all results for “frac”/ })).toBeInTheDocument();
    // Debounced: one request for the whole word, not one per key.
    expect(fetchMock.mock.calls.map(([url]) => new URL(String(url)).searchParams.get("q"))).toEqual(["frac"]);
    expect(await screen.findByText("1 course and 1 lesson")).toBeInTheDocument();
  });

  it("moves through the options with the arrow keys (focus stays in the box) and opens one with Enter", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("link", { name: /Search/ }));
    await user.type(combobox(), "frac");
    const first = await screen.findByRole("option", { name: /^Fractions Made Simple/ });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(combobox()).toHaveAttribute("aria-activedescendant", first.id);

    await user.keyboard("{ArrowDown}");
    const lesson = screen.getByRole("option", { name: /Equivalent fractions/ });
    expect(lesson).toHaveAttribute("aria-selected", "true");
    expect(combobox()).toHaveAttribute("aria-activedescendant", lesson.id);
    expect(combobox()).toHaveFocus();

    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(first).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}");
    expect(screen.getByRole("option", { name: /See all results/ })).toHaveAttribute("aria-selected", "true");
    await user.keyboard("{ArrowUp}{Enter}");
    expect(router.push).toHaveBeenCalledWith("/courses/fractions#lesson-equivalent-fractions");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("opens a result with a click, and the full results page from 'See all'", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("link", { name: /Search/ }));
    await user.type(combobox(), "frac");
    await user.click(await screen.findByRole("option", { name: /See all results/ }));
    expect(router.push).toHaveBeenCalledWith("/search?q=frac");
  });

  it("fills in a suggestion, says when nothing matches, and marks close matches", async () => {
    const { user } = setup((q) =>
      q === "python" ? results({ query: q, courses: [], lessons: [] }) : results({ query: q, approximate: true, lessons: [] }),
    );
    await user.click(screen.getByRole("link", { name: /Search/ }));
    await user.click(screen.getByRole("button", { name: "python" }));
    expect(combobox()).toHaveValue("python");
    expect(await screen.findByText("No courses or lessons match “python”")).toBeInTheDocument();
    expect(screen.getByText("No results", { selector: "[aria-live]" })).toBeInTheDocument();

    await user.clear(combobox());
    await user.type(combobox(), "fracton");
    expect(await screen.findByText(/these are close matches/)).toBeInTheDocument();
    expect(await screen.findByText("1 course and 0 lessons, close matches")).toBeInTheDocument();
  });

  it("doesn't search for a single letter, and starts empty after closing", async () => {
    const { user, fetchMock } = setup();
    await user.click(screen.getByRole("link", { name: /Search/ }));
    await user.type(combobox(), "f");
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("option")).toBeNull();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("link", { name: /Search/ }));
    expect(combobox()).toHaveValue("");
  });
});

describe("landing on a lesson", () => {
  it("highlights and focuses the lesson named in the URL, also when the hash changes later", async () => {
    const { CourseOutline } = await import("@/features/catalog/components/course-outline");
    window.location.hash = "#lesson-equivalent-fractions";
    renderWithProviders(
      <CourseOutline
        lessons={[
          { id: "1", slug: "what-is-a-fraction", title: "What is a fraction?", summary: "Parts.", position: 1, durationMinutes: 12 },
          { id: "2", slug: "equivalent-fractions", title: "Equivalent fractions", summary: "Same amount.", position: 2, durationMinutes: 15 },
        ]}
      />,
    );
    const second = document.getElementById("lesson-equivalent-fractions")!;
    await waitFor(() => expect(second).toHaveAttribute("data-targeted", "true"));
    expect(second).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Lesson 2: Equivalent fractions" })).toBeInTheDocument();
    expect(screen.getByText("2 lessons, about 27 minutes in all")).toBeInTheDocument();

    window.location.hash = "#lesson-what-is-a-fraction";
    const first = document.getElementById("lesson-what-is-a-fraction")!;
    await waitFor(() => expect(first).toHaveAttribute("data-targeted", "true"));
    expect(second).not.toHaveAttribute("data-targeted");
    window.location.hash = "";
  });
});
