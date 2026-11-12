/** Only allow same-site relative redirects ("/learn"), never "//evil.example", "/\evil" or absolute URLs. */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}
