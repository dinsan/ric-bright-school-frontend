import { screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { QuizAttempt, QuizResult, QuizSummary, QuizView } from "@/features/learn/contract";
import { CourseQuizzes } from "@/features/learn/components/course-quizzes";
import { QuizPlayer } from "@/features/learn/components/quiz-player";
import { parseQuestions, toQuizQuestion, type QuizLayout } from "@/features/learn/quiz";
import { StudentArea } from "@/features/learn/student-area";
import { me } from "../support/fixtures";
import { resetNavigation } from "../support/next-navigation";
import { QUESTIONS, RIGHT_ANSWERS } from "../support/quiz";
import { apiErrorResponse, mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));
beforeEach(() => resetNavigation());

const leo = me({ id: "s1", role: "student", display_name: "Leo", grade_level: 5, email: null, username: "leo10", timezone: "UTC" });
const inStudentArea = (ui: ReactNode) => renderWithProviders(<StudentArea user={leo}>{ui}</StudentArea>);
const questions = parseQuestions(QUESTIONS).questions.map(toQuizQuestion);
const NOW = "2026-11-16T10:00:00.000Z";

function view(overrides: Partial<QuizView> = {}, layout: QuizLayout = "one_at_a_time"): QuizView {
  return {
    course: { id: "c1", slug: "fractions", title: "Fractions Made Simple" },
    quiz: { id: "q1", slug: "check-up", title: "Fractions check-up", description: "Nine questions.", layout, question_count: questions.length, points_total: 12 },
    enrolled: true,
    questions,
    attempt: null,
    last_result: null,
    ...overrides,
  };
}

const attempt = (overrides: Partial<QuizAttempt> = {}): QuizAttempt => ({ id: "a1", status: "in_progress", answers: {}, flagged: [], started_at: NOW, updated_at: NOW, ...overrides });
const result = (overrides: Partial<QuizResult> = {}): QuizResult => ({
  attempt_id: "a1",
  score: 7,
  max_score: 9,
  pending_review: 1,
  pending_points: 3,
  answered: 8,
  question_count: 9,
  submitted_at: NOW,
  ...overrides,
});

/** The quiz API: start, autosave (recorded), submit (recorded). */
function quizApi({ submitted = result(), started = attempt() } = {}) {
  const saves: unknown[] = [];
  const submits: unknown[] = [];
  const fetchMock = mockApi({
    "POST /api/learn/quizzes/q1/attempts": () => Response.json(started, { status: 201 }),
    "PUT /api/learn/quiz-attempts/a1": ({ body }) => {
      saves.push(body);
      return Response.json({ saved_at: NOW });
    },
    "POST /api/learn/quiz-attempts/a1/submit": ({ body }) => {
      submits.push(body);
      return Response.json(submitted);
    },
  });
  return { saves, submits, fetchMock };
}

const navigator = () => screen.getByRole("navigation", { name: "Questions" });

describe("quiz player: one question at a time", () => {
  it("starts from the intro, moves between questions, flags one, and finishes with a confirmation", async () => {
    const api = quizApi();
    const { user } = inStudentArea(<QuizPlayer initial={view()} exitHref="/learn/courses/fractions" />);

    // Intro: what the quiz is and how it works.
    expect(screen.getByRole("heading", { level: 1, name: "Fractions check-up" })).toBeInTheDocument();
    expect(screen.getByText("9 questions · 12 points")).toBeInTheDocument();
    expect(screen.getByText("One question at a time.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start the quiz" }));

    // The first question, focused, with its hint; the navigator shows nothing answered yet.
    const first = await screen.findByRole("heading", { level: 1, name: "Which fraction is one half?" });
    await waitFor(() => expect(first).toHaveFocus());
    expect(screen.getByText("Question 1 of 9")).toBeInTheDocument();
    expect(screen.getByText("0 of 9 answered")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(within(navigator()).getByRole("button", { name: "Question 1, not answered" })).toHaveAttribute("aria-current", "step");

    await user.click(screen.getByRole("radio", { name: "1/2" }));
    expect(within(navigator()).getByRole("button", { name: "Question 1, answered" })).toBeInTheDocument();
    expect(screen.getByText("1 of 9 answered")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Next" }));
    const second = await screen.findByRole("heading", { level: 1, name: "Which fractions equal one half?" });
    await waitFor(() => expect(second).toHaveFocus());

    // Flag it for review: a badge, the navigator says so, and screen readers hear it.
    await user.click(screen.getByRole("button", { name: "Flag for review" }));
    expect(within(screen.getByRole("region", { name: /^Question 2 of 9/ })).getByText("Flagged")).toBeInTheDocument();
    expect(within(navigator()).getByRole("button", { name: "Question 2, not answered, flagged" })).toBeInTheDocument();
    expect(screen.getByText("Question 2 flagged for review.")).toBeInTheDocument();
    expect(screen.getByText("1 of 9 answered · 1 flagged")).toBeInTheDocument();

    // Jump with the navigator.
    await user.click(within(navigator()).getByRole("button", { name: "Question 9, not answered" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Explain why 2/4 is the same as 1/2." })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next" })).not.toBeInTheDocument();

    // Finish asks first, listing what isn't answered and what is flagged; focus starts on "Keep working".
    await user.click(within(screen.getByRole("contentinfo")).getByRole("button", { name: "Finish quiz" }));
    const dialog = await screen.findByRole("dialog", { name: "Finish the quiz?" });
    expect(within(dialog).getByText("You answered 1 of 9 questions.")).toBeInTheDocument();
    expect(within(dialog).getByText("Not answered yet (8)")).toBeInTheDocument();
    expect(within(dialog).getByText("Flagged for review (1)")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Keep working" })).toHaveFocus();
    expect(api.submits).toEqual([]);

    // "Go to question 2" closes the dialog and takes the student (and focus) there.
    const flaggedList = within(dialog).getByRole("list", { name: "Flagged for review (1)" });
    const goTo2 = within(flaggedList).getByRole("button", { name: "Go to question 2" });
    expect(goTo2).toHaveTextContent(/^2$/);
    await user.click(goTo2);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.getByRole("heading", { level: 1, name: "Which fractions equal one half?" })).toHaveFocus());
    await user.click(screen.getByRole("checkbox", { name: "2/4" }));
    await user.click(screen.getByRole("button", { name: "Remove flag" }));
    expect(screen.getByText("Flag removed from question 2.")).toBeInTheDocument();

    // Finish for real: the answers and flags go with the submit, and the result appears.
    await user.click(within(navigator()).getByRole("button", { name: "Finish quiz" }));
    const confirm = await screen.findByRole("dialog", { name: "Finish the quiz?" });
    expect(within(confirm).queryByText(/Flagged for review/)).not.toBeInTheDocument();
    await user.click(within(confirm).getByRole("button", { name: "Finish and submit" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Quiz finished" })).toHaveFocus();
    expect(api.submits).toEqual([{ answers: { mc: "a", ms: ["two-quarters"] }, flagged: [] }]);
    expect(screen.getByText(/You got/)).toHaveTextContent("You got 7 of 9 points.");
    expect(screen.getByText("You answered 8 of 9 questions.")).toBeInTheDocument();
    expect(screen.getByText("Your written answer isn't marked yet (3 points not counted yet).")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to the course" })).toHaveAttribute("href", "/learn/courses/fractions");
  });

  it("saves answers as the student goes", async () => {
    const api = quizApi();
    const { user } = inStudentArea(<QuizPlayer initial={view({ attempt: attempt() })} exitHref="/learn/courses/fractions" />);
    await user.click(screen.getByRole("radio", { name: "1/4" }));
    await waitFor(() => expect(api.saves).toEqual([{ answers: { mc: "b" }, flagged: [] }]), { timeout: 3000 });
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  it("carries on where the student stopped, with their answers and flags", async () => {
    quizApi();
    inStudentArea(<QuizPlayer initial={view({ attempt: attempt({ answers: { mc: "b", ms: ["one-third"] }, flagged: ["mc"] }) })} exitHref="/learn/courses/fractions" />);
    // Straight to the first question not answered yet.
    expect(screen.getByRole("heading", { level: 1, name: "1/4 is bigger than 1/2." })).toBeInTheDocument();
    expect(within(navigator()).getByRole("button", { name: "Question 1, answered, flagged" })).toBeInTheDocument();
    expect(screen.getByText("2 of 9 answered · 1 flagged")).toBeInTheDocument();
  });

  it("keeps the answers when sending them fails, and lets the student try again", async () => {
    let fail = true;
    const submits: unknown[] = [];
    mockApi({
      "PUT /api/learn/quiz-attempts/a1": () => Response.json({ saved_at: NOW }),
      "POST /api/learn/quiz-attempts/a1/submit": ({ body }) => {
        submits.push(body);
        return fail ? apiErrorResponse(503, "service_unavailable", "Lumina can't reach its database right now.") : Response.json(result({ score: 1, max_score: 1 }));
      },
    });
    const { user } = inStudentArea(<QuizPlayer initial={view({ attempt: attempt({ answers: { mc: "a" } }) })} exitHref="/x" />);
    await user.click(within(navigator()).getByRole("button", { name: "Finish quiz" }));
    const dialog = await screen.findByRole("dialog", { name: "Finish the quiz?" });
    await user.click(within(dialog).getByRole("button", { name: "Finish and submit" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Your answers weren't sent");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Lumina can't reach its database right now.");

    fail = false;
    await user.click(within(dialog).getByRole("button", { name: "Finish and submit" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Every answer right!" })).toBeInTheDocument();
    expect(submits).toHaveLength(2);
    expect(submits[1]).toEqual({ answers: { mc: "a" }, flagged: [] });
  });

  it("says so when the quiz was finished in another window", async () => {
    mockApi({ "PUT /api/learn/quiz-attempts/a1": () => apiErrorResponse(409, "attempt_submitted", "This quiz is already finished, so its answers can't change.") });
    const { user } = inStudentArea(<QuizPlayer initial={view({ attempt: attempt() })} exitHref="/x" />);
    await user.click(screen.getByRole("radio", { name: "1/2" }));
    expect(await screen.findByText("Not saved: This quiz is already finished, so its answers can't change.", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See your result" })).toBeInTheDocument();
  });
});

describe("quiz player: answer inputs for every question type", () => {
  it("turns each kind of input into the answer the server expects (all on one page)", async () => {
    const api = quizApi({ submitted: result({ score: 9, max_score: 9, answered: 9 }) });
    const { user } = inStudentArea(<QuizPlayer initial={view({ attempt: attempt() }, "all_on_one_page")} exitHref="/x" />);

    // All on one page: the quiz title is the page heading, every question an h2.
    expect(screen.getByRole("heading", { level: 1, name: "Fractions check-up" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(9);
    const choices = (name: string) => screen.getByRole("radiogroup", { name });
    const checks = (name: string) => screen.getByRole("group", { name });

    await user.click(within(choices("Which fraction is one half?")).getByRole("radio", { name: "1/2" }));
    await user.click(within(checks("Which fractions equal one half?")).getByRole("checkbox", { name: "3/6" }));
    await user.click(within(checks("Which fractions equal one half?")).getByRole("checkbox", { name: "2/4" }));
    await user.click(within(choices("1/4 is bigger than 1/2.")).getByRole("radio", { name: "False" }));
    await user.type(screen.getByRole("textbox", { name: "What is the bottom number of a fraction called?" }), "denominator");
    const numeric = screen.getByRole("textbox", { name: "What is half of 10? apples" });
    expect(numeric).toHaveAttribute("inputmode", "decimal");
    await user.type(numeric, "five");
    await user.tab();
    expect(screen.getByText(/That isn't a number yet/)).toBeInTheDocument();
    expect(numeric).toHaveAttribute("aria-invalid", "true");
    await user.clear(numeric);
    await user.type(numeric, "5");
    expect(screen.queryByText(/That isn't a number yet/)).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Blank 1 of 2" }), "numerator");
    await user.type(screen.getByRole("textbox", { name: "Blank 2 of 2" }), "denominator");
    // Regression: the matching group keeps its list (role="group" on the <ul> itself dropped it; axe "listitem").
    expect(within(within(checks("Match each picture to its fraction.")).getByRole("list")).getAllByRole("listitem")).toHaveLength(2);
    await user.selectOptions(screen.getByRole("combobox", { name: "Half a pizza" }), "1/2");
    await user.selectOptions(screen.getByRole("combobox", { name: "A quarter of a cake" }), "1/4");

    // Ordering: move buttons, focus stays with the item, the new place is announced.
    const order = screen.getByRole("list", { name: "Put these from smallest to largest." });
    const shown = () => within(order).getAllByRole("listitem").map((item) => item.textContent?.replace(/^\d/, ""));
    const target = ["1/8", "1/4", "1/2"];
    for (let position = 0; position < target.length; position++) {
      while (shown()[position] !== target[position]) {
        const up = within(order).getByRole("button", { name: `Move “${target[position]}” up` });
        await user.click(up);
      }
    }
    expect(shown()).toEqual(target);
    expect(screen.getByText(/“1\/\d” is now number \d of 3\./)).toBeInTheDocument();
    expect(within(order).getByRole("button", { name: "Move “1/8” up" })).toBeDisabled();

    const open = screen.getByRole("textbox", { name: "Explain why 2/4 is the same as 1/2." });
    await user.type(open, "Same size.");
    expect(screen.getByText("10 / 500 characters")).toBeInTheDocument();

    expect(within(navigator()).getByText("9 of 9 answered")).toBeInTheDocument();
    expect(within(screen.getByRole("contentinfo")).getByText("9 of 9 answered")).toBeInTheDocument();
    await user.click(within(screen.getByRole("contentinfo")).getByRole("button", { name: "Finish quiz" }));
    const dialog = await screen.findByRole("dialog", { name: "Finish the quiz?" });
    expect(within(dialog).getByText(/Everything is answered/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Finish and submit" }));
    await screen.findByRole("heading", { level: 1, name: "Every answer right!" });
    expect(api.submits).toEqual([
      {
        answers: {
          mc: "a",
          ms: ["two-quarters", "three-sixths"],
          tf: false,
          short: "denominator",
          num: "5",
          blank: { top: "numerator", bottom: "denominator" },
          match: { "half-pizza": "f-half", "quarter-cake": "f-quarter" },
          order: ["eighth", "quarter", "half"],
          open: "Same size.",
        },
        flagged: [],
      },
    ]);
    // A long flow with a lot of typing: give it room on a busy machine.
  }, 15_000);

  it("moves an ordering item with the keyboard, keeping focus when it reaches the top", async () => {
    quizApi();
    const orderAt = questions.findIndex((question) => question.id === "order");
    const before = Object.fromEntries(questions.slice(0, orderAt).map((question) => [question.id, RIGHT_ANSWERS[question.id]!]));
    const { user } = inStudentArea(<QuizPlayer initial={view({ attempt: attempt({ answers: before }) })} exitHref="/x" />);
    await screen.findByRole("heading", { level: 1, name: "Put these from smallest to largest." });
    const order = screen.getByRole("list", { name: "Put these from smallest to largest." });
    const items = within(order).getAllByRole("listitem");
    const second = items[1]!.textContent!.replace(/^\d/, "");
    within(order).getByRole("button", { name: `Move “${second}” up` }).focus();
    await user.keyboard("{Enter}");
    // At the top, "up" is disabled: focus moves to the same item's "down" button.
    await waitFor(() => expect(within(order).getByRole("button", { name: `Move “${second}” down` })).toHaveFocus());
    expect(screen.getByText(`“${second}” is now number 1 of 3.`)).toBeInTheDocument();
  });
});

describe("quiz player: before starting", () => {
  it("asks a student who hasn't started the course to start it first", () => {
    inStudentArea(<QuizPlayer initial={view({ enrolled: false, questions: [] })} exitHref="/learn/courses/fractions" />);
    expect(screen.getByText("Start the course first")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to Fractions Made Simple" })).toHaveAttribute("href", "/learn/courses/fractions");
    expect(screen.queryByRole("button", { name: /Start the quiz/ })).not.toBeInTheDocument();
  });

  it("shows the last result and offers the quiz again", async () => {
    const api = quizApi({ started: attempt({ id: "a1" }) });
    const { user } = inStudentArea(<QuizPlayer initial={view({ last_result: result() })} exitHref="/x" />);
    expect(screen.getByText("Last time you got 7 of 9 points. Your written answer isn't marked yet.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Take the quiz again" }));
    expect(await screen.findByRole("heading", { level: 1, name: "Which fraction is one half?" })).toBeInTheDocument();
    expect(api.fetchMock).toHaveBeenCalledTimes(1);
  });

  it("says when the quiz can't start", async () => {
    mockApi({ "POST /api/learn/quizzes/q1/attempts": () => apiErrorResponse(409, "quiz_empty", "This quiz has no questions yet.") });
    const { user } = inStudentArea(<QuizPlayer initial={view()} exitHref="/x" />);
    await user.click(screen.getByRole("button", { name: "Start the quiz" }));
    expect(await screen.findByText("The quiz didn't start")).toBeInTheDocument();
    expect(screen.getByText("This quiz has no questions yet.")).toBeInTheDocument();
  });
});

describe("course quizzes list", () => {
  const summary = (overrides: Partial<QuizSummary>): QuizSummary => ({
    id: "q1",
    slug: "check-up",
    title: "Fractions check-up",
    description: null,
    question_count: 9,
    layout: "one_at_a_time",
    in_progress: null,
    last_result: null,
    ...overrides,
  });

  it("lists each quiz with the student's progress, as links once the course is started", () => {
    const quizzes = [
      summary({}),
      summary({ id: "q2", slug: "halfway", title: "Halfway", layout: "all_on_one_page", in_progress: { answered: 3, started_at: NOW } }),
      summary({ id: "q3", slug: "done", title: "Done", last_result: result() }),
    ];
    mockApi({ "GET /api/learn/courses/c1/quizzes": () => Response.json(quizzes) });
    inStudentArea(<CourseQuizzes course={{ id: "c1", slug: "fractions" }} enrolled initial={quizzes} />);
    expect(screen.getByRole("heading", { level: 2, name: "Quizzes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Fractions check-up/ })).toHaveAttribute("href", "/learn/courses/fractions/quizzes/check-up");
    expect(screen.getByRole("link", { name: /Fractions check-up/ })).toHaveTextContent("9 questions · One question at a time · Not started");
    expect(screen.getByRole("link", { name: /Halfway/ })).toHaveTextContent("All on one page · In progress: 3 of 9 answered");
    expect(screen.getByRole("link", { name: /Done/ })).toHaveTextContent("Last time: 7 of 9 points (+ 1 written, not marked yet)");
  });

  it("shows quizzes without links before the course is started, and nothing when there are none", () => {
    mockApi({ "GET /api/learn/courses/c1/quizzes": () => Response.json([summary({})]) });
    const { unmount } = inStudentArea(<CourseQuizzes course={{ id: "c1", slug: "fractions" }} enrolled={false} initial={[summary({})]} />);
    expect(screen.getByText("Fractions check-up")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText("Start the course to take its quizzes.")).toBeInTheDocument();
    unmount();
    mockApi({ "GET /api/learn/courses/c1/quizzes": () => Response.json([]) });
    inStudentArea(<CourseQuizzes course={{ id: "c1", slug: "fractions" }} enrolled initial={[]} />);
    expect(screen.queryByRole("heading", { name: "Quizzes" })).not.toBeInTheDocument();
  });
});
