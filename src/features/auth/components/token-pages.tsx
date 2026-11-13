"use client";

import { useQuery } from "@tanstack/react-query";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Spinner } from "@/components/ui/spinner";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { authApi } from "../api";
import { PASSWORD_MAX, PASSWORD_MIN, roleHome } from "../contract";
import { useSignedIn } from "../use-signed-in";

/** One-time links must be used once: no retries, no refetching. */
const oneShot = { retry: false, staleTime: Infinity, gcTime: Infinity, refetchOnMount: false, refetchOnReconnect: false } as const;

function MissingToken() {
  return (
    <Alert tone="danger" title="This link is incomplete">
      Open the link from your email again. If it still doesn&apos;t work, ask for a new one.
    </Alert>
  );
}

/** /verify-email?token=...: confirms a new account's address. */
export function VerifyEmail({ token }: { token: string | null }) {
  const result = useQuery({ queryKey: ["verify-email", token], queryFn: () => authApi.verifyEmail(token!), enabled: Boolean(token), ...oneShot });
  if (!token) return <MissingToken />;
  if (result.isPending) return <Spinner label="Confirming your email" />;
  if (result.isError) {
    return (
      <div className="grid gap-4">
        <Alert tone="danger" role="alert" title="This link has expired or was already used">
          If you already confirmed your address, sign in. Otherwise, send yourself a new link.
        </Alert>
        <ResendForm />
      </div>
    );
  }
  const user = result.data && "user" in result.data ? result.data.user : null;
  return (
    <div className="grid gap-4" role="status">
      <CircleCheck aria-hidden className="size-10 text-success" />
      <p className="text-lead">Your email address is confirmed.</p>
      <div>
        <ButtonLink href={user ? roleHome[user.role] : "/sign-in"}>{user ? "Continue" : "Sign in"}</ButtonLink>
      </div>
    </div>
  );
}

const emailSchema = z.object({ email: fields.email() });

function ResendForm() {
  const [sent, setSent] = useState(false);
  const form = useZodForm(emailSchema, { defaultValues: { email: "" } });
  if (sent) return <Alert tone="success" title="If that address needs confirming, we sent a new link" />;
  return (
    <Form form={form} onSubmit={async ({ email }) => { await authApi.resendVerification(email); setSent(true); }}>
      <FormErrorSummary />
      <FormField name="email" label="Email address" required>
        <Input type="email" autoComplete="email" {...form.register("email")} />
      </FormField>
      <div>
        <SubmitButton variant="secondary">Send a new link</SubmitButton>
      </div>
    </Form>
  );
}

/** /forgot-password: always the same answer, so it never reveals whether an address has an account. */
export function ForgotPassword() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useZodForm(emailSchema, { defaultValues: { email: "" } });
  if (sentTo) {
    return (
      <div className="grid gap-3" role="status">
        <p className="text-lead">Check your email.</p>
        <p className="text-fg-muted">
          If there is a Lumina account for <strong className="wrap-break-word">{sentTo}</strong>, we sent a link to choose a new password. The link works
          once and expires soon.
        </p>
      </div>
    );
  }
  return (
    <Form form={form} onSubmit={async ({ email }) => { await authApi.forgotPassword(email); setSentTo(email); }}>
      <FormErrorSummary />
      <FormField name="email" label="Email address" required>
        <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
      </FormField>
      <div>
        <SubmitButton>Send the link</SubmitButton>
      </div>
    </Form>
  );
}

const resetSchema = z
  .object({
    password: fields.text("a new password", { min: PASSWORD_MIN, max: PASSWORD_MAX }),
    confirm: z.string().min(1, messages.required("the new password again")),
  })
  .refine((values) => values.password === values.confirm, { path: ["confirm"], message: "The two passwords are different. Type the same one twice." });

/** /reset-password?token=...: choose a new password. */
export function ResetPassword({ token }: { token: string | null }) {
  const signedIn = useSignedIn();
  const [done, setDone] = useState(false);
  const form = useZodForm(resetSchema, { defaultValues: { password: "", confirm: "" } });
  if (!token) return <MissingToken />;
  if (done) {
    return (
      <div className="grid gap-4" role="status">
        <CircleCheck aria-hidden className="size-10 text-success" />
        <p className="text-lead">Your password is changed. Other devices have been signed out.</p>
        <div>
          <ButtonLink href="/sign-in">Sign in</ButtonLink>
        </div>
      </div>
    );
  }
  return (
    <Form
      form={form}
      onSubmit={async ({ password }) => {
        const result = await authApi.resetPassword({ token, password });
        if (result && "user" in result && result.user) await signedIn(result.user);
        else setDone(true);
      }}
    >
      <FormErrorSummary title="Your password isn't changed yet" />
      <FormField name="password" label="New password" hint={`At least ${PASSWORD_MIN} characters.`} required>
        <PasswordInput autoComplete="new-password" {...form.register("password")} />
      </FormField>
      <FormField name="confirm" label="New password again" required>
        <PasswordInput autoComplete="new-password" {...form.register("confirm")} />
      </FormField>
      <div>
        <SubmitButton>Change password</SubmitButton>
      </div>
    </Form>
  );
}

/** /confirm-email?token=...: confirms a change of email address. */
export function ConfirmEmailChange({ token }: { token: string | null }) {
  const result = useQuery({ queryKey: ["confirm-email", token], queryFn: () => authApi.confirmEmailChange(token!), enabled: Boolean(token), ...oneShot });
  if (!token) return <MissingToken />;
  if (result.isPending) return <Spinner label="Confirming your new email address" />;
  if (result.isError) {
    return (
      <Alert tone="danger" role="alert" title="This link has expired or was already used">
        Ask for the change again from your account settings.
      </Alert>
    );
  }
  return (
    <div className="grid gap-4" role="status">
      <CircleCheck aria-hidden className="size-10 text-success" />
      <p className="text-lead">Your new email address is confirmed. Use it to sign in from now on.</p>
      <div>
        <ButtonLink href="/account/security">Back to your account</ButtonLink>
      </div>
    </div>
  );
}

