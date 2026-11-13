import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { siteConfig } from "@/config/site";
import { preferencesScript } from "@/lib/preferences";
import { lexend } from "./fonts";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  // Relative URLs in metadata (canonical, Open Graph) resolve against the public address (SITE_URL).
  metadataBase: new URL(siteConfig.url),
  title: { default: `${siteConfig.name}: learn every grade`, template: `%s · ${siteConfig.name}` },
  description: siteConfig.longDescription,
  applicationName: siteConfig.name,
  openGraph: { type: "website", siteName: siteConfig.name, locale: "en_GB" },
  twitter: { card: "summary_large_image" },
  // Previews, staging and localhost builds stay out of search engines (see next.config.ts).
  ...(siteConfig.indexable ? {} : { robots: { index: false, follow: false } }),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1229" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The preferences script sets data-theme / data-band before React hydrates, so the
    // attributes differ from the server HTML on purpose.
    <html lang="en" className={lexend.variable} suppressHydrationWarning>
      <head>
        {/* Runs before first paint: applies the remembered theme and grade band (no flash). */}
        <script dangerouslySetInnerHTML={{ __html: preferencesScript }} />
      </head>
      <body className="bg-canvas text-fg">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
