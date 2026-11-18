import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // src/generated: the Prisma Client, generated code. services/: separate projects (the Python formula engine).
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**", "services/**"]),
]);
