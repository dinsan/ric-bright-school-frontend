import type { ReactNode } from "react";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Logo } from "./logo";
import { SkipLink } from "./skip-link";

/** Sign-in, sign-up and account e-mail pages: one calm card, no navigation to get lost in. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-graph-paper">
      <SkipLink />
      <header className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-gutter">
        <Logo />
        <ThemeSwitcher />
      </header>
      <main id="main" tabIndex={-1} className="flex flex-1 justify-center px-gutter pt-6 pb-16 outline-none sm:pt-10">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
