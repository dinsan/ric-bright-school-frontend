import localFont from "next/font/local";

/**
 * Lexend, self-hosted. Designed for reading proficiency, so it stays legible for young
 * readers. Variable weight axis 100–900 covers every weight the UI uses (medium to black).
 * The file ships with the repo, so builds never depend on fonts.googleapis.com being reachable.
 * Source: @fontsource-variable/lexend 5.3.0 (Latin subset). Licence: SIL OFL 1.1, see fonts/OFL.txt.
 */
export const lexend = localFont({
  src: "./fonts/lexend-latin-variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-lexend",
});
