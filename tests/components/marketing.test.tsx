import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Faq } from "@/features/marketing/components/faq";
import { LessonPreview } from "@/features/marketing/components/lesson-preview";
import { renderWithProviders } from "../support/render";

describe("sample lesson (home page)", () => {
  it("goes learn → try → done, with feedback and focus following each step", async () => {
    const { user } = renderWithProviders(<LessonPreview />);
    const steps = screen.getByRole("list", { name: "Lesson steps" });
    expect(within(steps).getByText("Learn").closest("li")).toHaveAttribute("aria-current", "step");
    // Not focused on first render: the page must not jump to the lesson.
    expect(screen.getByRole("heading", { name: /the more parts, the smaller/ })).not.toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Try a question" }));
    expect(screen.getByRole("heading", { name: "Who eats more pizza?" })).toHaveFocus();
    const finish = screen.getByRole("button", { name: "Finish the lesson" });
    expect(finish).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Leo/ }));
    expect(screen.getByRole("button", { name: /^Leo/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Not quite.")).toBeInTheDocument();
    expect(finish).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /^Maya/ }));
    expect(screen.getByText("Yes!")).toBeInTheDocument();
    await user.click(finish);
    expect(screen.getByRole("heading", { name: "Lesson complete!" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "See Grade 4 courses" })).toHaveAttribute("href", "/grades/4");

    await user.click(screen.getByRole("button", { name: /Start again/ }));
    expect(screen.getByRole("heading", { name: /the more parts, the smaller/ })).toHaveFocus();
  });

  it("reads fractions as words and names the bars for screen readers", () => {
    renderWithProviders(<LessonPreview />);
    expect(screen.getByRole("img", { name: "A bar cut into 3 equal parts, with 1 part shaded" })).toBeInTheDocument();
    expect(screen.getAllByText("one half", { selector: ".sr-only" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText("one third", { selector: ".sr-only" }).length).toBeGreaterThan(0);
  });
});

describe("FAQ", () => {
  it("opens answers with the keyboard, without any script", async () => {
    const { user } = renderWithProviders(<Faq />);
    const question = screen.getByText("Does my child need an email address?");
    const details = question.closest("details")!;
    expect(details).not.toHaveAttribute("open");
    await user.click(question);
    expect(details).toHaveAttribute("open");
    expect(within(details).getByText(/A parent or the school makes the account/)).toBeVisible();
  });
});
