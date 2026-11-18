"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Alert } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { CONTROL_ACTIONS, DAILY_MINUTE_CHOICES, describeControls, formatMinutes, type ParentalControlsSettings } from "@/features/learn/controls";
import { familyApi } from "../api";
import type { ParentalControlsView } from "../contract";
import { formatDateTime } from "../format";

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const schema = z
  .object({
    daily_minutes: z.string(),
    bedtime_on: z.boolean(),
    bedtime_start: z.string(),
    bedtime_end: z.string(),
    when_reached: z.enum(CONTROL_ACTIONS, "Choose what happens when the time is up."),
  })
  .superRefine((values, context) => {
    if (!values.bedtime_on) return;
    if (!TIME.test(values.bedtime_start)) context.addIssue({ code: "custom", path: ["bedtime_start"], message: "Enter the time bedtime starts, like 20:00." });
    if (!TIME.test(values.bedtime_end)) context.addIssue({ code: "custom", path: ["bedtime_end"], message: "Enter the time bedtime ends, like 07:00." });
    if (TIME.test(values.bedtime_start) && values.bedtime_start === values.bedtime_end) {
      context.addIssue({ code: "custom", path: ["bedtime_end"], message: "Bedtime needs different start and end times." });
    }
  });

type Values = z.input<typeof schema>;

function toSettings(values: Values): ParentalControlsSettings {
  return {
    daily_minutes: values.daily_minutes ? Number(values.daily_minutes) : null,
    bedtime: values.bedtime_on && TIME.test(values.bedtime_start) && TIME.test(values.bedtime_end) && values.bedtime_start !== values.bedtime_end ? { start: values.bedtime_start, end: values.bedtime_end } : null,
    when_reached: values.when_reached,
  };
}

/**
 * Parental controls for one child (FE-PAR-03): a daily learning-time limit, a bedtime, and what happens
 * when one is reached (a reminder, or lessons and quizzes pause). The summary under the form says in
 * words what the child will get, before saving.
 */
export function ControlsForm({ childId, name, initial, timeZone }: { childId: string; name: string; initial: ParentalControlsView; timeZone: string | null }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const first = name.split(" ")[0]!;
  const form = useZodForm(schema, {
    defaultValues: {
      daily_minutes: initial.daily_minutes ? String(initial.daily_minutes) : "",
      bedtime_on: initial.bedtime !== null,
      bedtime_start: initial.bedtime?.start ?? "20:00",
      bedtime_end: initial.bedtime?.end ?? "07:00",
      when_reached: initial.when_reached,
    },
  });
  const values = form.watch();
  const bedtimeOn = values.bedtime_on;

  return (
    <Form
      form={form}
      onSubmit={async (submitted) => {
        const result = await familyApi.updateControls(childId, toSettings(submitted));
        setSaved(result);
        toast({ title: "Controls saved", description: `${first}'s app follows them from now on.`, tone: "success" });
        router.refresh();
      }}
      className="max-w-2xl"
    >
      <FormErrorSummary title="The controls aren't saved yet" />

      <fieldset className="grid gap-3 rounded-card border-2 border-line bg-surface p-card">
        <legend className="px-1 text-lead font-extrabold">Daily learning time</legend>
        <FormField name="daily_minutes" label="Time in lessons each day" hint="Counted while a lesson is on screen. It starts again each day.">
          <Select {...form.register("daily_minutes")}>
            <option value="">No limit</option>
            {DAILY_MINUTE_CHOICES.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatMinutes(minutes)}
              </option>
            ))}
          </Select>
        </FormField>
      </fieldset>

      <fieldset className="grid gap-3 rounded-card border-2 border-line bg-surface p-card">
        <legend className="px-1 text-lead font-extrabold">Bedtime</legend>
        <Checkbox label={`Set a bedtime for ${first}`} description="Uses the time on the device they learn on." {...form.register("bedtime_on")} />
        {bedtimeOn && (
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField name="bedtime_start" label="From" required>
              <Input type="time" className="w-40" {...form.register("bedtime_start")} />
            </FormField>
            <FormField name="bedtime_end" label="Until" required>
              <Input type="time" className="w-40" {...form.register("bedtime_end")} />
            </FormField>
          </div>
        )}
      </fieldset>

      <fieldset className="grid gap-3 rounded-card border-2 border-line bg-surface p-card">
        <legend className="px-1 text-lead font-extrabold">When the time is up</legend>
        <RadioGroup name="when_reached" legend={`What ${first} sees`}>
          <Radio value="remind" label="A reminder to take a break" description={`A message appears. ${first} can carry on.`} {...form.register("when_reached")} />
          <Radio
            value="pause"
            label="Lessons and quizzes pause"
            description={`Lessons, quizzes and review show a break screen until the next day, or until bedtime ends. Everything done so far is saved. The rest of Lumina stays open.`}
            {...form.register("when_reached")}
          />
        </RadioGroup>
      </fieldset>

      <Alert tone="info" title={`What ${first} gets`} aria-live="polite">
        <ul className="grid gap-0.5">
          {describeControls(toSettings(values)).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </Alert>

      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton>Save controls</SubmitButton>
        <p className="text-small text-fg-muted">
          {saved.updated_at ? `Last changed by ${saved.updated_by ?? "a parent"}, ${formatDateTime(saved.updated_at, timeZone)}.` : "No controls set yet."}
        </p>
      </div>
    </Form>
  );
}
