import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme/theme-switcher";
import { siteConfig } from "@/config/site";
import { SearchButton } from "@/features/search/components/search-button";
import { HeaderAccount } from "./header-account";
import { Logo } from "./logo";

export function SiteHeader() {
  return (
    <header className="border-b-2 border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-gutter">
        <Logo compact />
        <div className="flex items-center gap-2 sm:gap-4">
          <nav aria-label="Main">
            <ul className="flex items-center gap-6 text-small font-bold">
              {siteConfig.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="underline-offset-4 hover:underline">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <SearchButton />
          <ThemeSwitcher />
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}
