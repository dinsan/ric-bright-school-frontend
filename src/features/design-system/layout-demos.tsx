import { ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { FocusShell } from "@/components/layout/focus-shell";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { appNavigation, type AppRole } from "@/config/navigation";

const USERS: Record<AppRole, string> = {
  student: "Maya Okafor",
  teacher: "Daniel Reyes",
  parent: "Priya Shah",
  admin: "Sam Lee",
};

/** Sample content, only to show the app layout with something in it. */
export function AppLayoutDemo({ role }: { role: AppRole }) {
  const name = USERS[role];
  return (
    <AppShell role={role} user={{ name }} activeHref={appNavigation[role].items[0]?.href}>
      <div className="mx-auto grid max-w-5xl gap-8">
        <div className="grid gap-2">
          <p className="text-small font-bold text-fg-muted">Layout demo · {appNavigation[role].label}</p>
          <h1 className="text-title">Hi, {name.split(" ")[0]}</h1>
        </div>
        {role === "student" && <StudentContent />}
        {role === "teacher" && <TeacherContent />}
        {role === "parent" && <ParentContent />}
        {role === "admin" && <AdminContent />}
      </div>
    </AppShell>
  );
}

function StudentContent() {
  return (
    <>
      <Card className="lg:max-w-xl">
        <CardHeader>
          <Badge tone="elementary" className="w-fit">
            Grade 4
          </Badge>
          <CardTitle as="h2">Continue: Fractions and decimals</CardTitle>
          <CardDescription>Lesson 5 of 12 · about 10 minutes</CardDescription>
        </CardHeader>
        <CardContent>
          <Progress value={4} max={12} label="Course progress" valueText="4 of 12 lessons" showLabel tone="success" />
        </CardContent>
        <CardFooter>
          <ButtonLink href="/design/layouts/focus">
            <BookOpen aria-hidden />
            Continue lesson
          </ButtonLink>
        </CardFooter>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Alert tone="warning" title="Due tomorrow">
          Science: label the parts of a plant.
        </Alert>
        <EmptyState headingLevel={2} illustration="celebrate" title="3-day streak" description="Do one lesson today to make it 4." />
      </div>
    </>
  );
}

function TeacherContent() {
  const classes = [
    ["Maths 4B", 27, 8],
    ["Maths 5A", 25, 3],
    ["Science 4", 30, 0],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {classes.map(([title, students, toGrade]) => (
        <Card key={title}>
          <CardHeader>
            <CardTitle as="h2">{title}</CardTitle>
            <CardDescription>{students} students</CardDescription>
          </CardHeader>
          <CardFooter>
            {toGrade > 0 ? <Badge tone="warning">{toGrade} to grade</Badge> : <Badge tone="success">All graded</Badge>}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function ParentContent() {
  const children = [
    ["Ayo Shah", "Grade 2", 80],
    ["Leela Shah", "Grade 7", 45],
  ] as const;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {children.map(([child, grade, progress]) => (
        <Card key={child}>
          <div className="flex items-center gap-3">
            <Avatar name={child} size="lg" />
            <div>
              <CardTitle as="h2">{child}</CardTitle>
              <CardDescription>{grade}</CardDescription>
            </div>
          </div>
          <Progress value={progress} label={`${child}'s progress this week`} showLabel />
        </Card>
      ))}
    </div>
  );
}

function AdminContent() {
  const stats = [
    ["Active students", "12,480"],
    ["Teachers", "640"],
    ["Reports to review", "7"],
  ] as const;
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map(([label, value]) => (
        <Card key={label} variant="flat">
          <CardDescription>{label}</CardDescription>
          <p className="text-title tabular-nums">{value}</p>
        </Card>
      ))}
    </div>
  );
}

export function FocusLayoutDemo() {
  return (
    <FocusShell
      context="Fractions and decimals · Lesson 5"
      title="Adding fractions with the same denominator"
      exitHref="/design#layouts"
      progress={{ current: 3, total: 8 }}
      footer={
        <>
          <Button>
            <ArrowLeft aria-hidden />
            Back
          </Button>
          <Button variant="primary">
            Check answer
            <ArrowRight aria-hidden />
          </Button>
        </>
      }
    >
      <div className="grid gap-8">
        <div className="grid gap-3">
          <p className="text-small font-bold text-fg-muted">Question 3</p>
          <h1 className="text-title">What is 2/8 + 3/8?</h1>
          <p className="text-lead text-fg-muted">When the bottom numbers match, add the top numbers and keep the bottom one.</p>
        </div>
        <RadioGroup legend="Choose one answer">
          <Radio name="answer" value="a" label="5/8" />
          <Radio name="answer" value="b" label="5/16" />
          <Radio name="answer" value="c" label="6/8" />
        </RadioGroup>
      </div>
    </FocusShell>
  );
}
