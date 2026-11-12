"use client";

import { useMutation } from "@tanstack/react-query";
import { MailCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { fields } from "@/lib/forms/zod";
import { authApi } from "../api";
import { SocialSignIn } from "./social-sign-in";

export const PASSWORD_MIN = 8;

const schema = z.object({
  role: fields.choice(["parent", "teacher"] as const, "who you are"),
  display_name: fields.text("your name", { max: 80 }),
  email: fields.email(),
  password: fields.text("a password", { min: PASSWORD_MIN, max: 128 }),
  accept_terms: fields.accept("agree to the terms and privacy policy"),
});

/** Sign-up for parents and teachers. Students get their accounts from a parent or teacher. */
export function SignUpForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useZodForm(schema, {
    defaultValues: { role: undefined, display_name: "", email: "", password: "", accept_terms: false },
  });

  if (sentTo) return <CheckYourEmail email={sentTo} />;

  return (
    <div className="grid gap-6">
      <Form
        form={form}
        onSubmit={async (values) => {
          await authApi.register({ ...values, accept_terms: true });
          setSentTo(values.email);
        }}
      >
        <FormErrorSummary title="Your account isn't created yet" />
        <RadioGroup name="role" legend="I'm a…">
          <Radio value="parent" label="Parent or guardian" description="Follow your children's learning." {...form.register("role")} />
          <Radio value="teacher" label="Teacher" description="Run classes and set work." {...form.register("role")} />
        </RadioGroup>
        <FormField name="display_name" label="Your name" required>
          <Input autoComplete="name" {...form.register("display_name")} />
        </FormField>
        <FormField name="email" label="Email address" hint="We'll send a link to confirm it." required>
          <Input type="email" autoComplete="email" inputMode="email" {...form.register("email")} />
        </FormField>
        <FormField name="password" label="Password" hint={`At least ${PASSWORD_MIN} characters. A short sentence is easy to remember.`} required>
          <PasswordInput autoComplete="new-password" {...form.register("password")} />
        </FormField>
        <Checkbox label="I agree to Lumina's terms of use and privacy policy" {...form.register("accept_terms")} />
        <div>
          <SubmitButton>Create account</SubmitButton>
        </div>
      </Form>
      <SocialSignIn label="Sign up with" />
    </div>
  );
}

function CheckYourEmail({ email }: { email: string }) {
  const resend = useMutation({ mutationFn: () => authApi.resendVerification(email) });
  return (
    <div className="grid gap-4" role="status">
      <MailCheck aria-hidden className="size-10 text-primary" />
      <p className="text-lead">
        We sent a link to <strong className="wrap-break-word">{email}</strong>. Open it to confirm your address and finish signing up.
      </p>
      <p className="text-fg-muted">No email after a few minutes? Check your spam folder, or send it again.</p>
      {resend.isSuccess ? (
        <Alert tone="success" title="We sent a new link" />
      ) : (
        <div>
          <Button loading={resend.isPending} onClick={() => resend.mutate()}>
            Send the link again
          </Button>
        </div>
      )}
    </div>
  );
}
