"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { z } from "zod";
import { Form, FormErrorSummary, SubmitButton, useZodForm } from "@/components/forms/form";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { messages } from "@/lib/forms/messages";
import { authApi } from "../api";
import type { ClassRoster, PictureKey } from "../contract";
import { PICTURE_KEYS, pictureInfo } from "../pictures";
import { useSignedIn } from "../use-signed-in";

/** On a shared classroom device the class code is remembered, so children start at "Who are you?". */
const DEVICE_CLASS_KEY = "lumina:class-code";
const PICTURE_COUNT = 3;

type Student = ClassRoster["students"][number];

const deviceListeners = new Set<() => void>();

function readDeviceClass() {
  try {
    return localStorage.getItem(DEVICE_CLASS_KEY);
  } catch {
    return null;
  }
}

function writeDeviceClass(code: string | null) {
  try {
    if (code) localStorage.setItem(DEVICE_CLASS_KEY, code);
    else localStorage.removeItem(DEVICE_CLASS_KEY);
  } catch {
    // Storage blocked: the class is simply not remembered.
  }
  deviceListeners.forEach((listener) => listener());
}

function subscribeDeviceClass(listener: () => void) {
  deviceListeners.add(listener);
  return () => deviceListeners.delete(listener);
}

/**
 * Classroom sign-in for young learners: class code -> pick your name -> tap your 3 pictures.
 * Always shown in the Grades 1–5 presentation (big targets, big text).
 */
export function ClassSignIn({ next }: { next?: string | null }) {
  // The class remembered on this device (read after hydration; null on the server).
  const remembered = useSyncExternalStore(subscribeDeviceClass, readDeviceClass, () => null);
  const rememberedRoster = useQuery({
    queryKey: ["class-roster", remembered],
    queryFn: () => authApi.classRoster(remembered!),
    enabled: Boolean(remembered),
    retry: false,
  });
  const [chosen, setChosen] = useState<{ code: string; roster: ClassRoster } | null>(null);
  const [student, setStudent] = useState<Student | null>(null);

  const current = chosen ?? (remembered && rememberedRoster.data ? { code: remembered, roster: rememberedRoster.data } : null);
  const loadingRemembered = Boolean(remembered) && rememberedRoster.isPending && !chosen;

  const changeClass = () => {
    writeDeviceClass(null);
    setStudent(null);
    setChosen(null);
  };

  return (
    <div data-band="elementary" className="grid gap-6">
      {loadingRemembered ? (
        <div className="flex justify-center py-10">
          <Spinner label="Loading your class" className="size-8" />
        </div>
      ) : !current ? (
        <ClassCodeStep
          onFound={(code, roster, remember) => {
            if (remember) writeDeviceClass(code);
            setChosen({ code, roster });
          }}
        />
      ) : !student ? (
        <NameStep roster={current.roster} onPick={setStudent} onChangeClass={changeClass} />
      ) : (
        <PictureStep classCode={current.code} roster={current.roster} student={student} next={next} onBack={() => setStudent(null)} />
      )}
    </div>
  );
}

const codeSchema = z.object({
  code: z.string().trim().min(1, messages.required("your class code")),
  remember: z.boolean(),
});

function ClassCodeStep({ onFound }: { onFound: (code: string, roster: ClassRoster, remember: boolean) => void }) {
  const form = useZodForm(codeSchema, { defaultValues: { code: "", remember: false } });
  return (
    <Form
      form={form}
      onSubmit={async ({ code, remember }) => {
        const normalised = code.replace(/\s+/g, "").toUpperCase();
        try {
          onFound(normalised, await authApi.classRoster(normalised), remember);
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) {
            form.setError("code", { message: "We can't find that class code. Check it with your teacher." }, { shouldFocus: true });
            return;
          }
          throw error;
        }
      }}
    >
      <FormErrorSummary />
      <FormField name="code" label="Class code" hint="Your teacher will tell you." required>
        <Input
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="text-center font-bold tracking-[0.2em] uppercase"
          {...form.register("code")}
        />
      </FormField>
      <Checkbox
        label="This is a classroom device"
        description="Remember the class here, so children only pick their name and pictures."
        {...form.register("remember")}
      />
      <div>
        <SubmitButton size="lg">Next</SubmitButton>
      </div>
    </Form>
  );
}

function NameStep({ roster, onPick, onChangeClass }: { roster: ClassRoster; onPick: (student: Student) => void; onChangeClass: () => void }) {
  return (
    <div className="grid gap-5">
      <div className="grid gap-1 text-center">
        <p className="text-small font-bold text-fg-muted">{roster.class_name}</p>
        <h2 className="text-title">Who are you?</h2>
      </div>
      {roster.students.length === 0 ? (
        <Alert tone="info" title="Nobody is in this class yet">
          Ask your teacher to add you.
        </Alert>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {roster.students.map((student) => (
            <li key={student.id}>
              <button
                type="button"
                onClick={() => onPick(student)}
                className="flex min-h-control-lg w-full items-center gap-3 rounded-card border-2 border-line bg-surface p-3 text-left text-body font-bold shadow-sticker transition-transform duration-fast ease-playful hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none"
              >
                <Avatar name={student.display_name} src={student.avatar_url} decorative />
                <span className="min-w-0 wrap-break-word">{student.display_name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button variant="ghost" onClick={onChangeClass} className="justify-self-center">
        Change the class code
      </Button>
    </div>
  );
}

function PictureStep({
  classCode,
  roster,
  student,
  next,
  onBack,
}: {
  classCode: string;
  roster: ClassRoster;
  student: Student;
  next?: string | null;
  onBack: () => void;
}) {
  const signedIn = useSignedIn(next);
  const [picked, setPicked] = useState<PictureKey[]>([]);
  const [problem, setProblem] = useState<{ locked: boolean; message: string } | null>(null);
  const pictures = roster.pictures?.length ? roster.pictures : PICTURE_KEYS;
  const firstName = student.display_name.split(" ")[0];

  const signIn = useMutation({
    mutationFn: (keys: PictureKey[]) =>
      authApi.signInWithPictures({ class_code: classCode, student_id: student.id, pictures: keys as [PictureKey, PictureKey, PictureKey] }),
    onSuccess: async (result) => {
      if ("signed_in" in result) await signedIn(result.user);
    },
    onError: (error) => {
      setPicked([]);
      if (error instanceof ApiError && (error.status === 423 || error.status === 429)) {
        setProblem({ locked: true, message: "That was a lot of tries. Ask your teacher to help you sign in." });
      } else if (error instanceof ApiError && error.status < 500) {
        setProblem({ locked: false, message: "Those pictures don't match. Try again." });
      } else {
        setProblem({ locked: false, message: "Something went wrong. Try again in a moment." });
      }
    },
  });

  const pick = (key: PictureKey) => {
    if (signIn.isPending || picked.length >= PICTURE_COUNT) return;
    setProblem(null);
    const nextPicked = [...picked, key];
    setPicked(nextPicked);
    if (nextPicked.length === PICTURE_COUNT) signIn.mutate(nextPicked);
  };

  const locked = problem?.locked ?? false;
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 text-center">
        <Avatar name={student.display_name} src={student.avatar_url} size="lg" decorative className="justify-self-center" />
        <h2 className="text-title">Hi, {firstName}!</h2>
        <p className="text-lead">Tap your {PICTURE_COUNT} pictures.</p>
      </div>

      {/* Progress without showing which pictures were chosen (someone may be watching). */}
      <div className="flex justify-center gap-3" aria-hidden>
        {Array.from({ length: PICTURE_COUNT }, (_, index) => (
          <span
            key={index}
            className={cn("size-6 rounded-full border-2 border-line transition-colors duration-fast", index < picked.length ? "bg-primary" : "bg-surface")}
          />
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {signIn.isPending ? "Checking your pictures" : `${picked.length} of ${PICTURE_COUNT} pictures chosen`}
      </p>

      {problem && (
        <Alert tone={locked ? "warning" : "danger"} role="alert" title={problem.message} />
      )}

      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {pictures.map((key) => {
          const { label, icon: Icon, tone } = pictureInfo(key);
          return (
            <li key={key}>
              <button
                type="button"
                onClick={() => pick(key)}
                disabled={locked || signIn.isPending}
                className={cn(
                  "flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-card border-2 border-line p-2 text-small font-bold shadow-sticker",
                  "transition-transform duration-fast ease-playful hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none disabled:opacity-50",
                  tone,
                )}
              >
                <Icon aria-hidden className="size-[45%]" strokeWidth={2.25} />
                {label}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap justify-center gap-3">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft aria-hidden />
          Not {firstName}?
        </Button>
        {picked.length > 0 && !signIn.isPending && (
          <Button variant="ghost" onClick={() => setPicked([])}>
            <RotateCcw aria-hidden />
            Start again
          </Button>
        )}
        {signIn.isPending && <Spinner label="Checking your pictures" />}
      </div>
    </div>
  );
}
