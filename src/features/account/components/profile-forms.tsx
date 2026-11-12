"use client";

import { useMutation } from "@tanstack/react-query";
import { Copy, Link2 } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { GradeBandSettings, ThemeSettings } from "@/components/theme/display-settings";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import type { Me } from "@/features/auth/contract";
import { useSubjects } from "@/features/catalog/hooks";
import { GRADES } from "@/features/catalog/constants";
import { formatDate } from "@/lib/format";
import { fields } from "@/lib/forms/zod";
import { accountApi } from "../api";
import { useApplyMe } from "../hooks";
import { AccountSection } from "./section";

/** Languages the interface can be shown in once translations exist (FE-I18N). */
const LANGUAGES = [
  ["en", "English"],
  ["es", "Español"],
  ["fr", "Français"],
  ["pt", "Português"],
] as const;

// The time zone list comes from the runtime's Intl data, which can differ between the server and the
// browser. Render only the current value on the server, and the full list after hydration.
let zoneList: string[] | null = null;
function browserTimeZones(): string[] {
  if (!zoneList) {
    try {
      zoneList = Intl.supportedValuesOf("timeZone");
    } catch {
      zoneList = ["UTC"];
    }
  }
  return zoneList;
}
const noSubscription = () => () => {};

const profileSchema = z.object({
  display_name: fields.text("your name", { max: 80 }),
  language: z.string(),
  timezone: z.string(),
});

export function ProfileSection({ user }: { user: Me }) {
  const applyMe = useApplyMe();
  const currentZone = user.timezone ?? "UTC";
  const serverZones = useMemo(() => [currentZone], [currentZone]);
  const allZones = useSyncExternalStore(noSubscription, browserTimeZones, () => serverZones);
  const zones = allZones.includes(currentZone) ? allZones : [currentZone, ...allZones];
  const form = useZodForm(profileSchema, {
    defaultValues: { display_name: user.display_name, language: user.language ?? "en", timezone: currentZone },
  });
  return (
    <AccountSection id="profile" title="Profile" description="How you appear to your teachers, classmates and family.">
      <Form
        form={form}
        onSubmit={async (values) => {
          const me = await accountApi.update(values);
          applyMe(me);
          form.reset(values);
          toast({ title: "Profile saved", tone: "success" });
        }}
      >
        <FormErrorSummary title="Your profile isn't saved yet" />
        <FormField name="display_name" label="Name" required>
          <Input autoComplete="name" {...form.register("display_name")} />
        </FormField>
        <div className="grid gap-stack sm:grid-cols-2">
          <FormField name="language" label="Language">
            <Select {...form.register("language")}>
              {LANGUAGES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField name="timezone" label="Time zone" hint="Used for due dates and reminders.">
            <Select {...form.register("timezone")}>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone.replaceAll("_", " ")}
                </option>
              ))}
            </Select>
          </FormField>
        </div>
        <div>
          <SubmitButton>Save profile</SubmitButton>
        </div>
      </Form>
    </AccountSection>
  );
}

const teacherSchema = z.object({
  school_name: fields.optionalText({ max: 120 }),
  subjects: z.array(z.string()),
  // Checkbox groups hold their values as strings; the API wants numbers.
  grade_levels: z.array(z.string()).transform((values) => values.map(Number)),
  bio: fields.optionalText({ max: 600 }),
});

export function TeacherProfileSection({ user }: { user: Me }) {
  const applyMe = useApplyMe();
  const subjects = useSubjects();
  const profile = user.teacher_profile;
  const form = useZodForm(teacherSchema, {
    defaultValues: {
      school_name: profile?.school_name ?? "",
      subjects: profile?.subjects ?? [],
      grade_levels: (profile?.grade_levels ?? []).map(String),
      bio: profile?.bio ?? "",
    },
  });
  return (
    <AccountSection
      id="teacher-profile"
      title="Teacher profile"
      description="Helps us check that you are a teacher, and helps schools and parents recognise you."
    >
      {profile?.verified ? (
        <Badge tone="success" className="w-fit">
          Verified teacher
        </Badge>
      ) : (
        <Alert tone="info" title="We are checking your teacher account">
          A Lumina admin verifies new teachers, usually within two school days. A complete profile makes it quicker.
        </Alert>
      )}
      <Form
        form={form}
        onSubmit={async (values) => {
          const me = await accountApi.updateTeacherProfile({
            school_name: values.school_name ?? null,
            subjects: values.subjects,
            grade_levels: values.grade_levels,
            bio: values.bio ?? null,
          });
          applyMe(me);
          toast({ title: "Teacher profile saved", tone: "success" });
        }}
      >
        <FormErrorSummary title="Your teacher profile isn't saved yet" />
        <FormField name="school_name" label="School" optional>
          <Input autoComplete="organization" {...form.register("school_name")} />
        </FormField>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-small font-bold">Subjects you teach</legend>
          {subjects.isError ? (
            <p className="text-small text-fg-muted">The subject list did not load. You can add subjects later.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {(subjects.data ?? []).map((subject) => (
                <Checkbox key={subject.id} value={subject.slug} label={subject.name} {...form.register("subjects")} />
              ))}
            </div>
          )}
        </fieldset>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-small font-bold">Grades you teach</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {GRADES.map((grade) => (
              <Checkbox key={grade} value={String(grade)} label={`Grade ${grade}`} {...form.register("grade_levels")} />
            ))}
          </div>
        </fieldset>
        <FormField name="bio" label="About you" hint="A sentence or two for parents." optional>
          <Textarea rows={3} {...form.register("bio")} />
        </FormField>
        <div>
          <SubmitButton>Save teacher profile</SubmitButton>
        </div>
      </Form>
    </AccountSection>
  );
}

export function DisplaySection({ user }: { user: Me }) {
  return (
    <AccountSection id="display" title="Display" description="Saved on this device.">
      <div className="grid gap-8 md:grid-cols-2">
        <ThemeSettings />
        {user.role === "student" && <GradeBandSettings />}
      </div>
    </AccountSection>
  );
}

/** Students create a one-time code for a parent to connect to their account. */
export function ParentLinkSection() {
  const create = useMutation({ mutationFn: accountApi.createLinkCode });
  const [copied, setCopied] = useState(false);
  const code = create.data;
  return (
    <AccountSection
      id="connect-parent"
      title="Connect a parent"
      description="Give this code to your parent or guardian. They type it in Lumina to see how you are doing."
    >
      {code ? (
        <div className="grid gap-3" role="status">
          <p className="text-small text-fg-muted">Your code</p>
          <p className="w-fit rounded-control border-2 border-line bg-surface-sunken px-4 py-2 font-mono text-title tracking-[0.2em]">{code.code}</p>
          <p className="text-small text-fg-muted">It works once, until {formatDate(code.expires_at)}.</p>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={async () => {
                await navigator.clipboard?.writeText(code.code).catch(() => null);
                setCopied(true);
              }}
            >
              <Copy aria-hidden />
              {copied ? "Copied" : "Copy code"}
            </Button>
            <Button variant="ghost" loading={create.isPending} onClick={() => create.mutate()}>
              Make a new code
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {create.isError && <Alert tone="danger" role="alert" title="We couldn't make a code. Try again." />}
          <div>
            <Button variant="primary" loading={create.isPending} onClick={() => create.mutate()}>
              <Link2 aria-hidden />
              Make a code
            </Button>
          </div>
        </div>
      )}
    </AccountSection>
  );
}
