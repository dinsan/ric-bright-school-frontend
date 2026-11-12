"use client";

import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { messages } from "@/lib/forms/messages";
import { authApi } from "../api";
import { useSignedIn } from "../use-signed-in";

const schema = z.object({
  username: z.string().trim().min(1, messages.required("your username")),
  password: z.string().min(1, messages.required("your password")),
});

/** Students with a username and password (set up by a parent or teacher). */
export function StudentSignInForm({ next }: { next?: string | null }) {
  const signedIn = useSignedIn(next);
  const form = useZodForm(schema, { defaultValues: { username: "", password: "" } });
  return (
    <Form
      form={form}
      onSubmit={async (values) => {
        const result = await authApi.signInWithUsername({ ...values, username: values.username.toLowerCase() });
        if ("signed_in" in result) await signedIn(result.user);
      }}
    >
      <FormErrorSummary title="You're not signed in yet" />
      <FormField name="username" label="Username" required>
        <Input autoComplete="username" autoCapitalize="none" spellCheck={false} {...form.register("username")} />
      </FormField>
      <FormField name="password" label="Password" required>
        <PasswordInput autoComplete="current-password" {...form.register("password")} />
      </FormField>
      <div>
        <SubmitButton>Sign in</SubmitButton>
      </div>
    </Form>
  );
}
