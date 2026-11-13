"use client";

import { BookOpen, Plus, Settings2, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Progress } from "@/components/ui/progress";
import { Radio, RadioGroup } from "@/components/ui/radio-group";
import { Select } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { Example, Section } from "./section";

export function ComponentsSection() {
  const [progress, setProgress] = useState(40);
  const [page, setPage] = useState(2);
  const [showAnswers, setShowAnswers] = useState(true);
  const [celebrate, setCelebrate] = useState(0);

  return (
    <Section
      id="components"
      title="Components"
      description="Built on native elements where they are good enough (inputs, selects, checkboxes) and on Radix primitives for dialogs, menus, tabs, tooltips and toasts. Sizes follow the grade band."
    >
      <div className="grid gap-10">
        <Example title="Button">
          <Button variant="primary">Primary</Button>
          <Button>Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">
            <Trash2 aria-hidden />
            Delete
          </Button>
          <Button variant="primary" loading>
            Saving
          </Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg" variant="primary">
            Large
          </Button>
          <Tooltip content="Add a course">
            <Button size="icon" aria-label="Add a course">
              <Plus aria-hidden />
            </Button>
          </Tooltip>
        </Example>

        <Example title="Text fields">
          <div className="grid w-full gap-stack md:grid-cols-2">
            <FormField label="Full name" hint="As your teacher knows you." required>
              <Input autoComplete="name" placeholder="Ada Lovelace" />
            </FormField>
            <FormField label="Email address" error="Enter an email address like name@example.com." required>
              <Input type="email" defaultValue="ada@" />
            </FormField>
            <FormField label="Grade" required>
              <Select placeholder="Choose a grade">
                {Array.from({ length: 12 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    Grade {index + 1}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Class code" hint="Locked once you join." optional>
              <Input defaultValue="MATH-4B" disabled />
            </FormField>
            <FormField label="Note for your teacher" optional className="md:col-span-2">
              <Textarea placeholder="Anything your teacher should know" />
            </FormField>
          </div>
        </Example>

        <Example title="Choices">
          <div className="grid w-full gap-8 md:grid-cols-3">
            <div className="grid content-start gap-4">
              <Checkbox label="Email me when work is due" description="At most once a day." defaultChecked />
              <Checkbox label="Share my progress with my parent" />
              <Checkbox label="I agree to the class rules" error="Tick the box to agree to the class rules." />
            </div>
            <RadioGroup legend="How did the lesson feel?" hint="There is no wrong answer.">
              <Radio name="feel" value="easy" label="Easy" defaultChecked />
              <Radio name="feel" value="ok" label="Just right" />
              <Radio name="feel" value="hard" label="Hard" description="Your teacher will suggest extra practice." />
            </RadioGroup>
            <div className="grid content-start gap-4">
              <Switch
                label="Show answers after each question"
                checked={showAnswers}
                onChange={(event) => setShowAnswers(event.target.checked)}
              />
              <Switch label="Sound effects" description="Off by default." />
              <Switch label="Locked setting" disabled defaultChecked />
            </div>
          </div>
        </Example>

        <Example title="Badge">
          <Badge>Draft</Badge>
          <Badge tone="info">New</Badge>
          <Badge tone="success">Completed</Badge>
          <Badge tone="warning">Due tomorrow</Badge>
          <Badge tone="danger">Overdue</Badge>
          <Badge tone="accent">
            <Star aria-hidden />
            Top score
          </Badge>
          <Badge tone="elementary">Grades 1–5</Badge>
          <Badge tone="middle">Grades 6–8</Badge>
          <Badge tone="high">Grades 9–12</Badge>
        </Example>

        <Example title="Card and avatar">
          <Card className="w-full max-w-sm">
            <CardHeader>
              <Badge tone="success" className="w-fit">
                In progress
              </Badge>
              <CardTitle>Fractions and decimals</CardTitle>
              <CardDescription>Grade 4 · Mathematics</CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={62} label="Course progress" showLabel />
            </CardContent>
            <CardFooter>
              <Button variant="primary" size="sm">
                <BookOpen aria-hidden />
                Continue
              </Button>
            </CardFooter>
          </Card>
          <Card variant="flat" className="w-full max-w-sm">
            <CardHeader>
              <CardTitle>Your class</CardTitle>
              <CardDescription>Flat cards sit inside other surfaces.</CardDescription>
            </CardHeader>
            <div className="flex items-center -space-x-2">
              <Avatar name="Ada Lovelace" />
              <Avatar name="Grace Hopper" />
              <Avatar name="Alan Turing" />
              <Avatar name="Katherine Johnson" />
            </div>
            <div className="flex items-end gap-3">
              <Avatar name="Maya" size="sm" />
              <Avatar name="Maya Angelou" size="md" />
              <Avatar name="Maya Angelou" size="lg" />
            </div>
          </Card>
        </Example>

        <Example title="Tabs">
          <Tabs defaultValue="lessons" className="w-full max-w-xl">
            <TabsList aria-label="Course sections">
              <TabsTrigger value="lessons">Lessons</TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
              <TabsTrigger value="notes">My notes</TabsTrigger>
            </TabsList>
            <TabsContent value="lessons">Twelve short lessons, about ten minutes each.</TabsContent>
            <TabsContent value="quizzes">Four quizzes. You can retry each one.</TabsContent>
            <TabsContent value="notes">You have not written any notes yet.</TabsContent>
          </Tabs>
        </Example>

        <Example title="Dialog, sheet, menu, toast">
          <Dialog>
            <DialogTrigger asChild>
              <Button>Open dialog</Button>
            </DialogTrigger>
            <DialogContent title="Leave the quiz?" description="Your answers so far are saved. You can finish later.">
              <DialogFooter>
                <DialogClose asChild>
                  <Button>Keep going</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button variant="primary">Leave quiz</Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Sheet>
            <SheetTrigger asChild>
              <Button>Open sheet</Button>
            </SheetTrigger>
            <SheetContent side="right" title="Filters" description="Narrow down the course list.">
              <FormField label="Subject">
                <Select defaultValue="">
                  <option value="">All subjects</option>
                  <option>Mathematics</option>
                  <option>Science</option>
                </Select>
              </FormField>
              <Checkbox label="Only courses with quizzes" />
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Settings2 aria-hidden />
                Options
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Lesson</DropdownMenuLabel>
              <DropdownMenuItem>Duplicate</DropdownMenuItem>
              <DropdownMenuItem>Move to unit…</DropdownMenuItem>
              <DropdownMenuCheckboxItem checked={showAnswers} onCheckedChange={setShowAnswers}>
                Show answers
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem tone="danger">
                <Trash2 aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button onClick={() => toast({ title: "Lesson saved", description: "Your changes are live for students.", tone: "success" })}>
            Success toast
          </Button>
          <Button onClick={() => toast({ title: "Could not save", description: "Check your connection and try again.", tone: "danger" })}>
            Error toast
          </Button>
        </Example>

        <Example title="Alert">
          <div className="grid w-full gap-3 md:grid-cols-2">
            <Alert title="New this week">Three new science courses for Grades 6 to 8.</Alert>
            <Alert tone="success" title="Quiz submitted">
              Your teacher will see your answers tomorrow.
            </Alert>
            <Alert tone="warning" title="Due tomorrow" action={<Button size="sm">Open assignment</Button>}>
              Fractions worksheet, question 4 to 10.
            </Alert>
            <Alert tone="danger" title="We could not save your answer">
              Check your internet connection. Your answer is kept on this device until it is saved.
            </Alert>
          </div>
        </Example>

        <Example title="Progress and spinner">
          <div className="grid w-full max-w-md gap-4">
            <Progress value={progress} label="Lesson progress" showLabel />
            <Progress value={3} max={8} label="Quiz" valueText="3 of 8 questions" showLabel tone="success" />
            <Progress value={100} label="Reading streak" showLabel tone="accent" />
            <div className="flex flex-wrap gap-3">
              <Button size="sm" onClick={() => setProgress((value) => Math.max(0, value - 20))}>
                −20%
              </Button>
              <Button size="sm" onClick={() => setProgress((value) => Math.min(100, value + 20))}>
                +20%
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <Spinner label="Loading lessons" />
            <Spinner className="size-8 text-primary" />
            <button
              type="button"
              onClick={() => setCelebrate((count) => count + 1)}
              className="rounded-control p-1"
              aria-label="Play the celebration animation"
            >
              <Star key={celebrate} aria-hidden className="size-10 animate-celebrate fill-accent text-fg" />
            </button>
          </div>
        </Example>

        <Example title="Breadcrumb and pagination">
          <div className="grid w-full gap-6">
            <Breadcrumb
              items={[
                { label: "Courses", href: "/courses" },
                { label: "Grade 4", href: "/courses?grade=4" },
                { label: "Fractions and decimals" },
              ]}
            />
            <Pagination page={page} pageCount={5} onChange={setPage} />
          </div>
        </Example>

        <Example title="Empty states (illustration size follows the grade band)">
          <div className="grid w-full gap-4 md:grid-cols-2">
            <EmptyState
              headingLevel={3}
              illustration="search"
              title="No courses match"
              description="Try another grade or subject."
              action={<Button>Clear filters</Button>}
            />
            <EmptyState headingLevel={3} illustration="empty" title="No assignments yet" description="Your teacher has not set any work." />
            <EmptyState headingLevel={3} illustration="error" title="Courses did not load" description="Check your connection and try again." />
            <EmptyState headingLevel={3} illustration="celebrate" title="Course complete" description="You finished every lesson." />
          </div>
        </Example>

        <Example title="Skeleton">
          <div className="grid w-full max-w-sm gap-3" role="status" aria-label="Loading example">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-control w-32" />
          </div>
        </Example>
      </div>
    </Section>
  );
}
