import { siteConfig } from "@/config/site";

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-col gap-1 px-gutter py-6 text-small text-fg-muted sm:flex-row sm:justify-between">
        <p>{siteConfig.description}</p>
        <p>
          &copy; {process.env.BUILD_YEAR} {siteConfig.name}
        </p>
      </div>
    </footer>
  );
}
