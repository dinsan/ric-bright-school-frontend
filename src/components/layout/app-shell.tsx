"use client";

import { Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { appNavigation, visibleNavItems, type AppRole } from "@/config/navigation";
import { AppNav } from "./app-nav";
import { Logo } from "./logo";
import { SkipLink } from "./skip-link";
import { UserMenu, type AppUser } from "./user-menu";

export interface AppShellProps {
  role: AppRole;
  user: AppUser;
  children: ReactNode;
  /** Override the highlighted navigation item (defaults to the current URL). */
  activeHref?: string;
  /** Full-width message above everything, for example "You are viewing as ...". */
  banner?: ReactNode;
  /** Extra controls in the top bar, before the theme and account menus (for example a child switcher). */
  actions?: ReactNode;
}

/**
 * Signed-in area: sidebar navigation on large screens, a drawer on small ones, and a top bar
 * with the theme and account menus. The navigation comes from the role (config/navigation.ts).
 */
export function AppShell({ role, user, children, activeHref, banner, actions }: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const nav = appNavigation[role];
  const items = visibleNavItems(role);

  // The drawer is for small screens: close it if the window grows to the sidebar layout (lg).
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64rem)");
    const close = () => desktop.matches && setMenuOpen(false);
    desktop.addEventListener("change", close);
    return () => desktop.removeEventListener("change", close);
  }, []);
  const roleBadge = <Badge tone={nav.tone}>{nav.label}</Badge>;

  return (
    <div className="min-h-dvh bg-graph-paper lg:grid lg:grid-cols-[16rem_minmax(0,1fr)] lg:grid-rows-[auto_1fr]">
      <SkipLink />
      {banner && <div className="lg:col-span-2">{banner}</div>}

      <aside className="sticky top-0 hidden h-dvh flex-col gap-6 border-r-2 border-line bg-surface p-4 lg:flex">
        <div className="grid gap-3 px-1 pt-1">
          <Logo href={nav.items[0]?.href ?? "/"} />
          <div>{roleBadge}</div>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto">
          <AppNav items={items} activeHref={activeHref} />
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-sticky flex h-16 items-center gap-2 border-b-2 border-line bg-canvas/95 px-gutter backdrop-blur lg:px-8">
          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="-ml-2 lg:hidden">
                <Menu aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" title="Menu" hideTitle>
              <div className="grid gap-3 px-1">
                <Logo href={nav.items[0]?.href ?? "/"} />
                <div>{roleBadge}</div>
              </div>
              <nav aria-label="Main">
                <AppNav items={items} activeHref={activeHref} onNavigate={() => setMenuOpen(false)} />
              </nav>
            </SheetContent>
          </Sheet>
          <Logo href={nav.items[0]?.href ?? "/"} className="lg:hidden" compact />
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {actions}
            <ThemeSwitcher />
            <UserMenu user={user} role={role} />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-gutter py-8 outline-none lg:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
