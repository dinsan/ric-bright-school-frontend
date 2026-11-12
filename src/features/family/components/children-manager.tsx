"use client";

import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, Link2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Controller } from "react-hook-form";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardFooter, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import type { Child, PictureKey } from "@/features/auth/contract";
import { GRADES } from "@/features/catalog/constants";
import { PASSWORD_MIN } from "@/features/auth/components/sign-up-form";
import { fields } from "@/lib/forms/zod";
import { messages } from "@/lib/forms/messages";
import { familyApi } from "../api";
import { childrenKey, useChildren } from "../hooks";
import { PicturePicker } from "./picture-picker";

const signInLabels = { password: "Username and password", pictures: "Class code and pictures" } as const;

/** Parents: the children on the account, with their sign-in, plus add and link. */
export function ChildrenManager({ manage = true }: { manage?: boolean }) {
  const children = useChildren();
  const [dialog, setDialog] = useState<{ kind: "add" } | { kind: "link" } | { kind: "sign-in"; child: Child } | null>(null);
  const close = () => setDialog(null);

  const actions = manage && (
    <div className="flex flex-wrap gap-3">
      <Button variant="primary" onClick={() => setDialog({ kind: "add" })}>
        <UserPlus aria-hidden />
        Add a child
      </Button>
      <Button onClick={() => setDialog({ kind: "link" })}>
        <Link2 aria-hidden />
        Link a student account
      </Button>
    </div>
  );

  return (
    <div className="grid gap-6">
      {actions}
      {children.isPending ? (
        <div className="grid gap-4 md:grid-cols-2" role="status" aria-label="Loading your children">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : children.isError ? (
        <EmptyState
          illustration="error"
          role="alert"
          title="Your children didn't load"
          description="Check your connection and try again."
          action={<Button onClick={() => children.refetch()}>Try again</Button>}
        />
      ) : children.data.length === 0 ? (
        <EmptyState
          illustration="empty"
          title="No children yet"
          description="Add a child to make their account, or link the account your child already has at school."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {children.data.map((child) => (
            <li key={child.id}>
              <Card className="h-full">
                <div className="flex items-center gap-3">
                  <Avatar name={child.display_name} size="lg" decorative />
                  <div className="grid min-w-0">
                    <CardTitle as="h2">{child.display_name}</CardTitle>
                    <span className="text-small text-fg-muted">{child.grade_level ? `Grade ${child.grade_level}` : "Grade not set"}</span>
                  </div>
                </div>
                <div className="grid gap-1 text-small">
                  <span className="font-bold">Signs in with</span>
                  {child.sign_in_method ? (
                    <span>
                      {signInLabels[child.sign_in_method]}
                      {child.username && <span className="text-fg-muted"> · username {child.username}</span>}
                    </span>
                  ) : (
                    <Badge tone="warning" className="w-fit">
                      Not set up yet
                    </Badge>
                  )}
                </div>
                {manage && (
                  <CardFooter>
                    <Button size="sm" onClick={() => setDialog({ kind: "sign-in", child })}>
                      <KeyRound aria-hidden />
                      {child.sign_in_method ? "Change sign-in" : "Set up sign-in"}
                    </Button>
                  </CardFooter>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && close()}>
        {dialog?.kind === "add" && (
          <AddChild
            onAdded={(child) => setDialog({ kind: "sign-in", child })}
          />
        )}
        {dialog?.kind === "link" && <LinkChild onDone={close} />}
        {dialog?.kind === "sign-in" && <SignInSetup child={dialog.child} onDone={close} />}
      </Dialog>
    </div>
  );
}

const addSchema = z.object({
  display_name: fields.text("your child's name", { max: 80 }),
  grade_level: z.string().min(1, messages.choose("a grade")).transform(Number),
  parental_consent: fields.accept("confirm you are their parent or guardian"),
});

function AddChild({ onAdded }: { onAdded: (child: Child) => void }) {
  const queryClient = useQueryClient();
  const form = useZodForm(addSchema, { defaultValues: { display_name: "", grade_level: "", parental_consent: false } });
  return (
    <DialogContent title="Add a child" description="We make an account for your child. Next, you choose how they sign in.">
      <Form
        form={form}
        onSubmit={async (values) => {
          const child = await familyApi.addChild({ ...values, parental_consent: true });
          await queryClient.invalidateQueries({ queryKey: childrenKey });
          toast({ title: `${child.display_name} was added`, tone: "success" });
          onAdded(child);
        }}
      >
        <FormErrorSummary title="The account isn't made yet" />
        <FormField name="display_name" label="Child's name" hint="First name is enough." required>
          <Input autoComplete="off" {...form.register("display_name")} />
        </FormField>
        <FormField name="grade_level" label="Grade" hint="Sets the right courses and a reading level that fits." required>
          <Select placeholder="Choose a grade" {...form.register("grade_level")}>
            {GRADES.map((grade) => (
              <option key={grade} value={grade}>
                Grade {grade}
              </option>
            ))}
          </Select>
        </FormField>
        <Checkbox
          label="I am this child's parent or legal guardian"
          description="I agree to Lumina's terms and privacy policy for my child, and to Lumina storing their learning progress."
          {...form.register("parental_consent")}
        />
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <SubmitButton>Add child</SubmitButton>
        </DialogFooter>
      </Form>
    </DialogContent>
  );
}

const linkSchema = z.object({ code: z.string().trim().min(1, messages.required("the code")) });

function LinkChild({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const form = useZodForm(linkSchema, { defaultValues: { code: "" } });
  return (
    <DialogContent
      title="Link a student account"
      description="Your child makes a code in Lumina (Account, then Connect a parent). Type it here."
    >
      <Form
        form={form}
        onSubmit={async ({ code }) => {
          const child = await familyApi.linkChild(code.replace(/\s+/g, "").toUpperCase());
          await queryClient.invalidateQueries({ queryKey: childrenKey });
          toast({ title: `${child.display_name} is linked`, tone: "success" });
          onDone();
        }}
      >
        <FormErrorSummary title="The account isn't linked yet" />
        <FormField name="code" label="Code" required>
          <Input autoComplete="off" autoCapitalize="characters" className="font-mono tracking-[0.2em] uppercase" {...form.register("code")} />
        </FormField>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <SubmitButton>Link account</SubmitButton>
        </DialogFooter>
      </Form>
    </DialogContent>
  );
}

const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;

const signInSchema = z
  .object({
    method: fields.choice(["password", "pictures"] as const, "how your child signs in"),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, { error: messages.required("a username"), abort: true })
      .regex(USERNAME, "Use 3 to 30 letters or numbers (dots, dashes and underscores are fine too)."),
    password: z.string(),
    pictures: z.array(z.string()),
  })
  .superRefine((values, context) => {
    if (values.method === "password" && values.password.length < PASSWORD_MIN) {
      context.addIssue({ code: "custom", path: ["password"], message: messages.tooShort(PASSWORD_MIN) });
    }
    if (values.method === "pictures" && values.pictures.length !== 3) {
      context.addIssue({ code: "custom", path: ["pictures"], message: "Pick 3 different pictures." });
    }
  });

function SignInSetup({ child, onDone }: { child: Child; onDone: () => void }) {
  const queryClient = useQueryClient();
  const defaultMethod = child.sign_in_method ?? ((child.grade_level ?? 6) <= 3 ? "pictures" : "password");
  const form = useZodForm(signInSchema, {
    defaultValues: { method: defaultMethod, username: child.username ?? "", password: "", pictures: [] },
  });
  const method = form.watch("method");
  return (
    <DialogContent size="lg" title={`How ${child.display_name.split(" ")[0]} signs in`}>
      <Form
        form={form}
        onSubmit={async (values) => {
          await familyApi.setUpSignIn(
            child.id,
            values.method === "pictures"
              ? { method: "pictures", username: values.username, pictures: values.pictures as [PictureKey, PictureKey, PictureKey] }
              : { method: "password", username: values.username, password: values.password },
          );
          await queryClient.invalidateQueries({ queryKey: childrenKey });
          toast({ title: "Sign-in saved", description: `Show ${child.display_name.split(" ")[0]} how to sign in.`, tone: "success" });
          onDone();
        }}
      >
        <FormErrorSummary title="Sign-in isn't saved yet" />
        <RadioGroup name="method" legend="Sign in with" orientation="horizontal">
          <Radio value="pictures" label="Pictures" description="Best for Grades 1 to 3, on a classroom device with a class code." {...form.register("method")} />
          <Radio value="password" label="Password" description="For children who can type a password." {...form.register("method")} />
        </RadioGroup>
        <FormField name="username" label="Username" hint="Your child types or picks this. Letters and numbers, for example maya7." required>
          <Input autoComplete="off" autoCapitalize="none" spellCheck={false} {...form.register("username")} />
        </FormField>
        {method === "password" ? (
          <FormField name="password" label={child.sign_in_method === "password" ? "New password" : "Password"} hint={`At least ${PASSWORD_MIN} characters.`} required>
            <PasswordInput autoComplete="new-password" {...form.register("password")} />
          </FormField>
        ) : (
          <>
            <Controller
              control={form.control}
              name="pictures"
              render={({ field, fieldState }) => <PicturePicker value={field.value} onChange={field.onChange} error={fieldState.error?.message} />}
            />
            <Alert tone="info" title="Pictures need a class code">
              Your child picks their name and pictures after their teacher&apos;s class code is entered on the device.
            </Alert>
          </>
        )}
        <DialogFooter>
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <SubmitButton>Save sign-in</SubmitButton>
        </DialogFooter>
      </Form>
    </DialogContent>
  );
}
