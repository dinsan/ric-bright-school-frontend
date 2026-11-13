"use client";

import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api-client";
import { fields } from "@/lib/forms/zod";
import { Section } from "./section";

const SUBJECTS = ["mathematics", "science", "english"] as const;

const joinClassSchema = z.object({
  name: fields.text("your name", { min: 2, max: 60 }),
  email: fields.email(),
  classCode: fields.text("the class code your teacher gave you", { max: 12 }),
  subject: fields.choice(SUBJECTS, "a subject"),
  pace: fields.choice(["steady", "fast"] as const, "how fast you want to go"),
  note: fields.optionalText({ max: 200 }),
  rules: fields.accept("agree to the class rules"),
});

/** Pretend API call: throws the same errors the API sends, to show the mapping. */
async function joinClass(values: z.output<typeof joinClassSchema>) {
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (values.email === "taken@example.com") {
    throw new ApiError(
      422,
      {
        code: "validation_error",
        message: "Some answers need checking.",
        details: [{ field: "body.email", message: "This email is already in the class. Sign in instead." }],
      },
      "Request failed",
    );
  }
  if (values.classCode.toUpperCase() === "FULL") {
    throw new ApiError(409, { code: "class_full", message: "This class is full. Ask your teacher for another code." }, "Request failed");
  }
  if (values.classCode.toUpperCase() === "OFFLINE") throw new TypeError("Failed to fetch");
}

export function FormDemo() {
  const form = useZodForm(joinClassSchema, {
    defaultValues: { name: "", email: "", classCode: "", subject: undefined, pace: undefined, note: "", rules: false },
  });

  return (
    <Section
      id="forms"
      title="Forms"
      description={
        <>
          react-hook-form with zod. Errors appear when you submit, in plain words, then update as you fix them; focus moves to the first
          problem. Try the email <code className="font-mono">taken@example.com</code> (field error from the server), the
          class code <code className="font-mono">FULL</code> (form error) or <code className="font-mono">OFFLINE</code>{" "}
          (network error).
        </>
      }
    >
      <Card className="max-w-2xl">
        <Form
          form={form}
          onSubmit={async (values) => {
            await joinClass(values);
            toast({ title: "You joined the class", description: `Welcome, ${values.name}.`, tone: "success" });
            form.reset();
          }}
        >
          <FormErrorSummary />
          <FormField name="name" label="Your name" required>
            <Input autoComplete="name" {...form.register("name")} />
          </FormField>
          <FormField name="email" label="Email address" hint="We send a code here to confirm it is you." required>
            <Input type="email" autoComplete="email" {...form.register("email")} />
          </FormField>
          <div className="grid gap-stack sm:grid-cols-2">
            <FormField name="classCode" label="Class code" hint="Six letters, for example MATH4B." required>
              <Input autoCapitalize="characters" autoComplete="off" {...form.register("classCode")} />
            </FormField>
            <FormField name="subject" label="Subject" required>
              <Select placeholder="Choose a subject" {...form.register("subject")}>
                <option value="mathematics">Mathematics</option>
                <option value="science">Science</option>
                <option value="english">English</option>
              </Select>
            </FormField>
          </div>
          <RadioGroup name="pace" legend="How fast do you want to go?" orientation="horizontal">
            <Radio value="steady" label="Steady" {...form.register("pace")} />
            <Radio value="fast" label="Fast" {...form.register("pace")} />
          </RadioGroup>
          <FormField name="note" label="Anything your teacher should know?" optional>
            <Textarea rows={3} {...form.register("note")} />
          </FormField>
          <Checkbox label="I agree to the class rules" {...form.register("rules")} />
          <div>
            <SubmitButton>Join class</SubmitButton>
          </div>
        </Form>
      </Card>
    </Section>
  );
}
