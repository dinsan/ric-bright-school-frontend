import { LayoutDashboard, Focus } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { SkipLink } from "@/components/layout/skip-link";
import { GradeBandSettings, ThemeSettings } from "@/components/theme/display-settings";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { appNavigation, type AppRole } from "@/config/navigation";
import { ComponentsSection } from "./components-section";
import { FormDemo } from "./form-demo";
import { Section } from "./section";
import { ColorsSection, ScalesSection, TypographySection } from "./tokens-section";

const CONTENTS = [
  ["preview", "Preview settings"],
  ["colour", "Colour"],
  ["type", "Typography"],
  ["scales", "Spacing, radius, shadow, layers, motion"],
  ["components", "Components"],
  ["forms", "Forms"],
  ["layouts", "Layouts"],
] as const;

/** Living reference for the design system (development only). Documentation: docs/design.md. */
export function DesignSystemPage() {
  return (
    <div className="min-h-dvh bg-graph-paper">
      <SkipLink />
      <header className="border-b-2 border-line bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-gutter">
          <Logo />
          <ThemeSwitcher />
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto grid max-w-6xl gap-16 px-gutter py-10 outline-none lg:py-14">
        <div className="grid gap-4">
          <h1 className="text-display">Design system</h1>
          <p className="max-w-3xl text-lead text-fg-muted">
            Tokens, components and layouts for Lumina. Switch the theme and the reading level below: everything on this
            page follows them. Guidance lives in <code className="font-mono">docs/design.md</code>.
          </p>
          <nav aria-label="On this page">
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-small font-bold">
              {CONTENTS.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-link underline underline-offset-4">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <Section
          id="preview"
          title="Preview settings"
          description="The same controls people get in Display settings. The reading level is the single grade-band switch: later it comes from the student profile."
        >
          <Card className="grid gap-8 md:grid-cols-2">
            <ThemeSettings />
            <GradeBandSettings />
          </Card>
        </Section>

        <ColorsSection />
        <TypographySection />
        <ScalesSection />
        <ComponentsSection />
        <FormDemo />

        <Section id="layouts" title="Layouts" description="Three shells. Public pages use the marketing layout (this site's header and footer).">
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(Object.keys(appNavigation) as AppRole[]).map((role) => (
              <li key={role}>
                <Card asChild interactive className="h-full">
                  <Link href={`/design/layouts/app/${role}`}>
                    <LayoutDashboard aria-hidden className="size-8" />
                    <CardTitle>App layout: {appNavigation[role].label.toLowerCase()}</CardTitle>
                    <CardDescription>Sidebar on large screens, drawer on phones, {appNavigation[role].items.length} sections.</CardDescription>
                  </Link>
                </Card>
              </li>
            ))}
            <li>
              <Card asChild interactive className="h-full">
                <Link href="/design/layouts/focus">
                  <Focus aria-hidden className="size-8" />
                  <CardTitle>Focus layout</CardTitle>
                  <CardDescription>Lessons and quizzes: no navigation, one way out, progress on top.</CardDescription>
                </Link>
              </Card>
            </li>
          </ul>
        </Section>
      </main>
    </div>
  );
}
