import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Lexend for the share images (static instances: next/og can't read the variable woff2 the pages use).
 * Read once per server process. The literal paths let Next.js copy the files into the standalone output.
 */
const fonts = Promise.all([
  readFile(join(process.cwd(), "src/app/fonts/og/lexend-400.ttf")),
  readFile(join(process.cwd(), "src/app/fonts/og/lexend-800.ttf")),
]).then(([regular, bold]) => [
  { name: "Lexend", data: regular, weight: 400 as const, style: "normal" as const },
  { name: "Lexend", data: bold, weight: 800 as const, style: "normal" as const },
]);

export function ogFonts() {
  return fonts;
}
