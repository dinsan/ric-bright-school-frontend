import { screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { PasswordInput } from "@/components/ui/password-input";
import { renderWithProviders } from "../support/render";

/** Lines from docs/component-test-plan.md. "R" marks a bug that was fixed once. */

describe("Button", () => {
  it("fires onClick by mouse, Enter and Space", async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    await user.click(button);
    button.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it("ignores clicks while disabled or loading; loading stays focusable and busy", async () => {
    const onClick = vi.fn();
    const { user } = renderWithProviders(
      <>
        <Button disabled onClick={onClick}>
          Disabled
        </Button>
        <Button loading onClick={onClick}>
          Saving
        </Button>
      </>,
    );
    await user.click(screen.getByRole("button", { name: "Disabled" }));
    const loading = screen.getByRole("button", { name: /Saving/ });
    await user.click(loading);
    expect(onClick).not.toHaveBeenCalled();
    expect(loading).toHaveAttribute("aria-busy", "true");
    loading.focus();
    expect(loading).toHaveFocus();
  });

  it("R: asChild + disabled on a link is aria-disabled, out of the tab order and doesn't navigate", async () => {
    const { user } = renderWithProviders(
      <Button asChild disabled>
        <a href="/somewhere">Go</a>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).toHaveAttribute("tabindex", "-1");
    // The browser follows a link only if the click's default isn't prevented; check after React has run.
    let prevented: boolean | null = null;
    const listener = (event: MouseEvent) => {
      prevented = event.defaultPrevented;
      event.preventDefault(); // jsdom doesn't navigate anyway; keep the test page in place
    };
    window.addEventListener("click", listener);
    await user.click(link);
    window.removeEventListener("click", listener);
    expect(prevented).toBe(true);
  });

  it("ButtonLink renders a real link with button styles", () => {
    renderWithProviders(<ButtonLink href="/courses">Courses</ButtonLink>);
    const link = screen.getByRole("link", { name: "Courses" });
    expect(link).toHaveAttribute("href", "/courses");
    expect(link.className).toMatch(/rounded-control/);
  });
});

describe("FormField", () => {
  it("names the control with its label, and describes it with the hint then the error", () => {
    renderWithProviders(
      <FormField label="Email address" hint="We'll send a link." error="Enter an email address." required>
        <Input type="email" />
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: /Email address/ });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("We'll send a link. Enter an email address.");
  });

  it("marks optional fields and has no required or invalid state by default", () => {
    renderWithProviders(
      <FormField label="School" optional>
        <Input />
      </FormField>,
    );
    const input = screen.getByRole("textbox", { name: /School.*optional/ });
    expect(input).not.toBeRequired();
    expect(input).not.toHaveAttribute("aria-invalid");
  });
});

describe("PasswordInput", () => {
  it("shows and hides the password, and says which", async () => {
    const { user } = renderWithProviders(
      <FormField label="Password">
        <PasswordInput />
      </FormField>,
    );
    const input = screen.getByLabelText("Password", { selector: "input" });
    expect(input).toHaveAttribute("type", "password");
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Hide password" })).toHaveAttribute("aria-pressed", "true");
  });
});

describe("Checkbox", () => {
  it("toggles by label click and Space, and exposes its error", async () => {
    const { user } = renderWithProviders(<Checkbox label="I agree" error="Tick the box to agree." />);
    const box = screen.getByRole("checkbox", { name: "I agree" });
    await user.click(screen.getByText("I agree"));
    expect(box).toBeChecked();
    box.focus();
    await user.keyboard(" ");
    expect(box).not.toBeChecked();
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Tick the box to agree.");
  });
});

describe("Breadcrumb", () => {
  it("marks the last item as the current page, not a link", () => {
    renderWithProviders(<Breadcrumb items={[{ label: "Courses", href: "/courses" }, { label: "Fractions" }]} />);
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("href", "/courses");
    expect(screen.queryByRole("link", { name: "Fractions" })).toBeNull();
    expect(screen.getByText("Fractions")).toHaveAttribute("aria-current", "page");
  });
});

describe("Pagination", () => {
  function Paged({ pageCount = 3 }: { pageCount?: number }) {
    const [page, setPage] = useState(1);
    return <Pagination page={page} pageCount={pageCount} onChange={setPage} />;
  }

  it("R: reaching the last page with Next keeps keyboard focus on the button, which then does nothing", async () => {
    const { user } = renderWithProviders(<Paged />);
    const next = screen.getByRole("button", { name: /Next/ });
    next.focus();
    await user.keyboard("{Enter}");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute("aria-disabled", "true");
    await user.keyboard("{Enter}");
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
  });

  it("does nothing at the start, and hides itself for a single page", async () => {
    const { user, unmount } = renderWithProviders(<Paged />);
    const previous = screen.getByRole("button", { name: /Previous/ });
    expect(previous).toHaveAttribute("aria-disabled", "true");
    await user.click(previous);
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    unmount();
    renderWithProviders(<Paged pageCount={1} />);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });
});
