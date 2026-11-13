import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClassSignIn } from "@/features/auth/components/class-sign-in";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { SocialSignIn } from "@/features/auth/components/social-sign-in";
import { me } from "../support/fixtures";
import { resetNavigation, router } from "../support/next-navigation";
import { apiErrorResponse, mockApi, renderWithProviders } from "../support/render";

vi.mock("next/navigation", () => import("../support/next-navigation"));

beforeEach(() => resetNavigation());

describe("email sign-in", () => {
  it("asks for the two-step code when the account needs it, then goes to the page asked for", async () => {
    const fetchMock = mockApi({
      "GET /api/auth/oauth/providers": () => Response.json({ providers: [] }),
      "GET /api/session": () => Response.json({ user: me({ role: "teacher" }), impersonating: false }),
      "POST /api/auth/login": () => Response.json({ mfa_required: true }),
      "POST /api/auth/login/mfa": ({ body }) =>
        (body as { code: string }).code === "123456" ? Response.json({ signed_in: true, user: me({ role: "teacher" }) }) : apiErrorResponse(400, "invalid_code", "Wrong", [{ field: "body.code", message: "That code didn't work." }]),
    });
    const { user } = renderWithProviders(<SignInForm next="/account/security" />);
    await user.type(screen.getByRole("textbox", { name: /Email address/ }), "t@example.test");
    await user.type(screen.getByLabelText(/^Password/, { selector: "input" }), "secret password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    const code = await screen.findByRole("textbox", { name: /6-digit code/ });
    await user.type(code, "000000");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("That code didn't work.")).toBeInTheDocument();

    await user.clear(code);
    await user.type(code, "123 456");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/account/security"));
    const mfaBodies = fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/login/mfa")).map(([, init]) => JSON.parse(String(init?.body)));
    expect(mfaBodies.at(-1)).toEqual({ code: "123456" });
  });

  it("offers to resend the confirmation email when the address isn't confirmed", async () => {
    mockApi({
      "GET /api/auth/oauth/providers": () => Response.json({ providers: [] }),
      "POST /api/auth/login": () => apiErrorResponse(403, "email_not_verified", "Confirm your email address first."),
      "POST /api/auth/verify-email/resend": () => Response.json({ status: "sent_if_needed" }, { status: 202 }),
    });
    const { user } = renderWithProviders(<SignInForm />);
    await user.type(screen.getByRole("textbox", { name: /Email address/ }), "new@example.test");
    await user.type(screen.getByLabelText(/^Password/, { selector: "input" }), "secret password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Confirm your email first")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Send the link again" }));
    expect(await screen.findByText("We sent a new link")).toBeInTheDocument();
  });
});

describe("classroom sign-in (class code and pictures)", () => {
  const roster = { class_name: "Class 2M", students: [{ id: "s1", display_name: "Maya Lee", avatar_url: null }], pictures: ["cat", "dog", "sun", "tree"] };

  it("finds the class, asks who you are, signs in after the third picture", async () => {
    const fetchMock = mockApi({
      "GET /api/auth/class/MAPLE42": () => Response.json(roster),
      "GET /api/session": () => Response.json({ user: me({ role: "student", grade_level: 2 }), impersonating: false }),
      "POST /api/auth/login/pictures": () => Response.json({ signed_in: true, user: me({ role: "student", grade_level: 2 }) }),
    });
    const { user } = renderWithProviders(<ClassSignIn />);
    await user.type(screen.getByRole("textbox", { name: /Class code/ }), " maple 42 ");
    await user.click(screen.getByRole("button", { name: /Next|Continue|Find/ }));
    await user.click(await screen.findByRole("button", { name: "Maya Lee" }));
    expect(screen.getByRole("heading", { name: "Hi, Maya!" })).toBeInTheDocument();
    for (const picture of ["Cat", "Sun"]) await user.click(screen.getByRole("button", { name: picture }));
    expect(screen.getByText("2 of 3 pictures chosen")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Tree" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/learn"));
    const body = JSON.parse(String(fetchMock.mock.calls.find(([url]) => String(url).endsWith("/login/pictures"))![1]!.body));
    expect(body).toEqual({ class_code: "MAPLE42", student_id: "s1", pictures: ["cat", "sun", "tree"] });
  });

  it("says the class code is wrong on the field, and sends locked-out children to their teacher", async () => {
    mockApi({
      "GET /api/auth/class/NOPE": () => apiErrorResponse(404, "class_not_found", "Not found"),
      "GET /api/auth/class/MAPLE42": () => Response.json(roster),
      "POST /api/auth/login/pictures": () => apiErrorResponse(423, "account_locked", "Locked"),
    });
    const { user } = renderWithProviders(<ClassSignIn />);
    const code = screen.getByRole("textbox", { name: /Class code/ });
    await user.type(code, "nope");
    await user.click(screen.getByRole("button", { name: /Next|Continue|Find/ }));
    expect(await screen.findByText("We can't find that class code. Check it with your teacher.")).toBeInTheDocument();

    await user.clear(code);
    await user.type(code, "MAPLE42");
    await user.click(screen.getByRole("button", { name: /Next|Continue|Find/ }));
    await user.click(await screen.findByRole("button", { name: "Maya Lee" }));
    for (const picture of ["Dog", "Cat", "Sun"]) await user.click(screen.getByRole("button", { name: picture }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That was a lot of tries. Ask your teacher to help you sign in.");
    expect(screen.getByRole("button", { name: "Cat" })).toBeDisabled();
  });
});

describe("social sign-in", () => {
  it("shows only configured providers, and on sign-up waits for a role, then passes it on", async () => {
    mockApi({ "GET /api/auth/oauth/providers": () => Response.json({ providers: ["google", "apple"] }) });
    const { rerender } = renderWithProviders(<SocialSignIn label="Sign up with" intent="signup" role={null} />);
    expect(await screen.findByRole("button", { name: "Sign up with Google" })).toBeDisabled();
    expect(screen.getByText("Choose parent or teacher above first.")).toBeInTheDocument();
    expect(screen.queryByText(/Microsoft/)).toBeNull();
    rerender(<SocialSignIn label="Sign up with" intent="signup" role="teacher" />);
    expect(screen.getByRole("link", { name: "Sign up with Google" })).toHaveAttribute("href", "/api/auth/oauth/google/start?intent=signup&role=teacher");
  });

  it("shows nothing when no provider is configured", async () => {
    const fetchMock = mockApi({ "GET /api/auth/oauth/providers": () => Response.json({ providers: [] }) });
    renderWithProviders(<SocialSignIn next="/family" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText(/Continue with/)).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });
});
