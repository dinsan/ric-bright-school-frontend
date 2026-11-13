import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { COOKIE } from "@/server/auth/cookies";
import { STORAGE_KEYS } from "@/lib/storage-keys";
import { LegalPage, type LegalSection } from "@/features/legal/components/legal-page";
import { cookies, formatDuration, localStorageItems } from "@/features/legal/device-storage";
import { cookiesSections } from "@/features/legal/content/cookies";
import { privacySections } from "@/features/legal/content/privacy";
import { safetySections } from "@/features/legal/content/safety";
import { termsSections } from "@/features/legal/content/terms";
import type { LegalDocumentId } from "@/config/legal";

describe("cookie policy", () => {
  it("describes every cookie and every local storage key the code uses", () => {
    expect(cookies.map((item) => item.name).sort()).toEqual(Object.values(COOKIE).sort());
    expect(localStorageItems.map((item) => item.name).sort()).toEqual(Object.values(STORAGE_KEYS).sort());
    for (const item of [...cookies, ...localStorageItems]) {
      expect(item.purpose.length).toBeGreaterThan(20);
      expect(item.duration).toBeTruthy();
    }
  });

  it("writes durations in words", () => {
    expect(formatDuration(30 * 24 * 60 * 60)).toBe("30 days");
    expect(formatDuration(8 * 60 * 60)).toBe("8 hours");
    expect(formatDuration(60 * 60)).toBe("1 hour");
    expect(formatDuration(600)).toBe("10 minutes");
  });
});

const documents: Array<[LegalDocumentId, LegalSection[]]> = [
  ["privacy", privacySections],
  ["terms", termsSections],
  ["cookies", cookiesSections],
  ["safety", safetySections],
];

describe.each(documents)("%s page", (document, sections) => {
  const html = renderToStaticMarkup(<LegalPage document={document} lead="Lead." sections={sections} />);

  it("has one h1, unique section ids, and a table of contents whose links all land", () => {
    expect(html.match(/<h1/g)).toHaveLength(1);
    const ids = sections.map((section) => section.id);
    expect(new Set(ids).size).toBe(ids.length);
    const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);
    expect(anchors).toEqual(ids);
    for (const id of ids) expect(html).toContain(`id="${id}"`);
  });

  it("shows the last-updated date and, until reviewed, the draft notice", () => {
    expect(html).toMatch(/Last updated <time dateTime="\d{4}-\d{2}-\d{2}">/);
    expect(html).toContain("This is a draft");
  });

  it("has no empty or placeholder values", () => {
    expect(html).not.toMatch(/undefined|null|NaN|\[object Object\]/);
  });
});
