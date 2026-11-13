"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ApiError } from "@/lib/api-client";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { authApi, type SignInResult } from "../api";
import { useSignedIn } from "../use-signed-in";
import { AuthLink } from "./auth-card";
import { SocialSignIn } from "./social-sign-in";

const credentialsSchema = z.object({
  email: fields.email(),
  password: z.string().min(1, messages.required("your password")),
});

/**
 * Email + password sign-in for parents, teachers and admins, with the MFA step when needed.
 * `initialStep="mfa"`: Google / Microsoft / Apple already confirmed who it is; only the code is missing.
 */
export function SignInForm({ next, initialStep = "credentials" }: { next?: string | null; initialStep?: "credentials" | "mfa" }) {
  const [step, setStep] = useState<"credentials" | "mfa">(initialStep);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const signedIn = useSignedIn(next);
  const form = useZodForm(credentialsSchema, { defaultValues: { email: "", password: "" } });

  const handle = async (result: SignInResult) => {
    if ("mfa_required" in result) setStep("mfa");
    else await signedIn(result.user);
  };

  if (step === "mfa") return <MfaStep onDone={(result) => handle(result)} onRestart={() => setStep("credentials")} />;

  return (
    <div className="grid gap-6">
      {unverifiedEmail && <ResendVerification email={unverifiedEmail} />}
      <Form
        form={form}
        onSubmit={async (values) => {
          setUnverifiedEmail(null);
          try {
            await handle(await authApi.signIn(values));
          } catch (error) {
            // Unconfirmed email: the resend card explains it and offers the fix, so no second message.
            if (error instanceof ApiError && error.code === "email_not_verified") return setUnverifiedEmail(values.email);
            throw error;
          }
        }}
      >
        <FormErrorSummary title="You're not signed in yet" />
        <FormField name="email" label="Email address" required>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </FormField>
        <FormField name="password" label="Password" required>
          <PasswordInput autoComplete="current-password" {...form.register("password")} />
        </FormField>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <SubmitButton>Sign in</SubmitButton>
          <AuthLink href="/forgot-password">Forgot your password?</AuthLink>
        </div>
      </Form>
      <SocialSignIn next={next} />
    </div>
  );
}

const codeSchema = z.object({ code: z.string().trim().min(1, messages.required("the code")) });

/** Second step: a code from the authenticator app, or a recovery code. */
function MfaStep({ onDone, onRestart }: { onDone: (result: SignInResult) => Promise<void>; onRestart: () => void }) {
  const [recovery, setRecovery] = useState(false);
  const form = useZodForm(codeSchema, { defaultValues: { code: "" } });
  return (
    <Form form={form} onSubmit={async ({ code }) => onDone(await authApi.completeMfa(code.replace(/\s+/g, "")))}>
      <FormErrorSummary title="That code didn't work" />
      <p className="text-fg-muted">
        {recovery
          ? "Enter one of the recovery codes you saved when you turned on two-step verification. Each code works once."
          : "Open your authenticator app and enter the 6-digit code for Lumina."}
      </p>
      <FormField name="code" label={recovery ? "Recovery code" : "6-digit code"} required>
        <Input
          autoComplete="one-time-code"
          inputMode={recovery ? "text" : "numeric"}
          autoFocus
          {...form.register("code")}
        />
      </FormField>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton>Continue</SubmitButton>
        <Button variant="ghost" onClick={() => setRecovery((value) => !value)}>
          {recovery ? "Use the app instead" : "Use a recovery code"}
        </Button>
      </div>
      <p className="text-small text-fg-muted">
        Lost your phone and codes?{" "}
        <button type="button" onClick={onRestart} className="font-bold text-link underline underline-offset-4">
          Start again
        </button>{" "}
        or ask your school&apos;s Lumina admin to reset two-step verification.
      </p>
    </Form>
  );
}

/** Shown when sign-in fails because the email is not confirmed yet. */
export function ResendVerification({ email }: { email: string }) {
  const resend = useMutation({ mutationFn: () => authApi.resendVerification(email) });
  return (
    <Alert
      tone={resend.isSuccess ? "success" : "warning"}
      title={resend.isSuccess ? "We sent a new link" : "Confirm your email first"}
      action={
        !resend.isSuccess && (
          <Button size="sm" loading={resend.isPending} onClick={() => resend.mutate()}>
            Send the link again
          </Button>
        )
      }
    >
      {resend.isSuccess
        ? `Check the inbox for ${email} and open the link. It can take a few minutes.`
        : `We sent a link to ${email} when you signed up. Open it to confirm your address.`}
    </Alert>
  );
}
