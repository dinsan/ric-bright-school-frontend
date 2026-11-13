import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api-client";
import { fields } from "@/lib/forms/zod";
import { renderWithProviders } from "../support/render";

const schema = z.object({ name: fields.text("your name", { max: 20 }), email: fields.email() });

function SignUp({ onSubmit }: { onSubmit: (values: z.output<typeof schema>) => unknown }) {
  const form = useZodForm(schema, { defaultValues: { name: "", email: "" } });
  return (
    <Form form={form} onSubmit={onSubmit} aria-label="Sign up">
      <FormErrorSummary title="You're not signed up yet" />
      <FormField name="name" label="Name" required>
        <Input {...form.register("name")} />
      </FormField>
      <FormField name="email" label="Email" required>
        <Input type="email" {...form.register("email")} />
      </FormField>
      <SubmitButton>Create account</SubmitButton>
    </Form>
  );
}

describe("forms", () => {
  it("show no errors before the first submit, then one per field with focus on the first", async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(<SignUp onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "x");
    await user.clear(screen.getByRole("textbox", { name: /Name/ }));
    await user.tab();
    expect(screen.queryByText("Enter your name.")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText("Enter your name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your email address.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Name/ })).toHaveFocus();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("update errors live after a submit, and send trimmed values", async () => {
    const onSubmit = vi.fn();
    const { user } = renderWithProviders(<SignUp onSubmit={onSubmit} />);
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "  Ada  ");
    await waitFor(() => expect(screen.queryByText("Enter your name.")).toBeNull());
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Ada", email: "ada@example.com" }));
  });

  it("show a server error for a field on that field, focused, and clear it when edited", async () => {
    const onSubmit = vi.fn().mockRejectedValue(
      new ApiError(409, { code: "email_taken", message: "Check the answers.", details: [{ field: "body.email", message: "This email is already used." }] }, "x"),
    );
    const { user } = renderWithProviders(<SignUp onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Ada");
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    const email = screen.getByRole("textbox", { name: /Email/ });
    expect(await screen.findByText("This email is already used.")).toBeInTheDocument();
    expect(email).toHaveFocus();
    expect(email).toHaveAttribute("aria-invalid", "true");
    expect(screen.queryByRole("alert")).toBeNull();
    await user.type(email, "x");
    await waitFor(() => expect(screen.queryByText("This email is already used.")).toBeNull());
  });

  it("show a server outage in the summary, focused, and clear it on the next successful submit", async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new ApiError(503, { code: "service_unavailable", message: "Down" }, "x")).mockResolvedValueOnce(undefined);
    const { user } = renderWithProviders(<SignUp onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Ada");
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("You're not signed up yet");
    expect(alert).toHaveTextContent("Something went wrong on our side. Try again in a moment.");
    expect(alert.parentElement).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("don't submit twice while sending", async () => {
    let finish: () => void = () => {};
    const onSubmit = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { user } = renderWithProviders(<SignUp onSubmit={onSubmit} />);
    await user.type(screen.getByRole("textbox", { name: /Name/ }), "Ada");
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "ada@example.com");
    const button = screen.getByRole("button", { name: "Create account" });
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute("aria-busy", "true"));
    await user.click(button);
    await user.type(screen.getByRole("textbox", { name: /Email/ }), "{Enter}");
    finish();
    await waitFor(() => expect(button).not.toHaveAttribute("aria-busy"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("R: post, so a submit before JavaScript loads never puts passwords in the URL", () => {
    renderWithProviders(<SignUp onSubmit={vi.fn()} />);
    expect(screen.getByRole("form", { name: "Sign up" })).toHaveAttribute("method", "post");
  });
});
