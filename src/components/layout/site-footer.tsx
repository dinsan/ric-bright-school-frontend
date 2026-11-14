import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Logo } from "./logo";

/**
 * The footer groups, plus the help center and status page when their URLs are configured
 * (FE-PUB-10; outside services, so plain <a> links).
 */
export function footerGroups() {
  const support = [
    ...(siteConfig.helpCenter ? [{ href: siteConfig.helpCenter, label: "Help center", external: true }] : []),
    ...(siteConfig.statusPage ? [{ href: siteConfig.statusPage, label: "Service status", external: true }] : []),
  ];
  return siteConfig.footer.map((group) =>
    group.heading === "Trust" ? { ...group, links: [...group.links, ...support] } : { ...group, links: [...group.links] },
  );
}

/** Public footer: what Lumina is, the main links and every trust page (privacy, safety, terms…). */
export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-8 px-gutter py-10 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-3">
          <Logo />
          <p className="max-w-sm text-small text-fg-muted">{siteConfig.description} No ads, no tracking, no chat with strangers.</p>
        </div>
        {footerGroups().map((group) => (
          <nav key={group.heading} aria-labelledby={`footer-${group.heading}`}>
            <h2 id={`footer-${group.heading}`} className="text-small font-bold">
              {group.heading}
            </h2>
            <ul className="mt-3 grid gap-2 text-small">
              {group.links.map((link) => (
                <li key={link.href}>
                  {"external" in link && link.external ? (
                    <a href={link.href} rel="noreferrer" className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                      {link.label}
                    </a>
                  ) : (
                    <Link href={link.href} className="text-fg-muted underline-offset-4 hover:text-fg hover:underline">
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t-2 border-line-subtle">
        <p className="mx-auto max-w-6xl px-gutter py-4 text-small text-fg-muted">
          &copy; {process.env.BUILD_YEAR} {siteConfig.name}
        </p>
      </div>
    </footer>
  );
}
