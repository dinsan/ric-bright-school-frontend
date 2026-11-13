import { describe, expect, it } from "vitest";
import { bandForGrade, GRADES, GRADE_BANDS } from "@/features/catalog/constants";
import { buildCatalogQuery, parseCatalogParams } from "@/features/catalog/url-state";
import { PICTURE_KEYS as CONTRACT_PICTURES } from "@/features/auth/contract";
import { PICTURE_KEYS, PICTURES, pictureInfo } from "@/features/auth/pictures";
import { gradeBandForGrade } from "@/lib/preferences";
import { formatDate, pluralize } from "@/lib/format";

const params = (query: string) => new URLSearchParams(query);

describe("catalog URL state", () => {
  it("reads valid filters from the URL", () => {
    expect(parseCatalogParams(params("grade=4&subject=science&q=plants&page=2"))).toEqual({ grade: 4, subject: "science", q: "plants", page: 2 });
  });

  it("ignores invalid values instead of failing", () => {
    expect(parseCatalogParams(params("grade=13&page=0"))).toEqual({ grade: undefined, subject: undefined, q: undefined, page: 1 });
    expect(parseCatalogParams(params("grade=abc&page=-3"))).toMatchObject({ grade: undefined, page: 1 });
    expect(parseCatalogParams(params("grade=4.5&page=2.5"))).toMatchObject({ grade: undefined, page: 1 });
    expect(parseCatalogParams(params("subject=&q="))).toMatchObject({ subject: undefined, q: undefined });
  });

  it("writes a short, shareable query (no defaults) that reads back the same", () => {
    expect(buildCatalogQuery({ page: 1 })).toBe("");
    expect(buildCatalogQuery({ grade: 3, page: 1 })).toBe("?grade=3");
    const state = { grade: 7, subject: "history", q: "egypt & rome", page: 3 };
    const query = buildCatalogQuery(state);
    expect(query).toBe("?grade=7&subject=history&q=egypt+%26+rome&page=3");
    expect(parseCatalogParams(params(query.slice(1)))).toEqual(state);
  });
});

describe("grades and bands", () => {
  it("has twelve grades in three bands with no gaps or overlaps", () => {
    expect(GRADES).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    for (const grade of GRADES) expect(GRADE_BANDS.filter((band) => grade >= band.from && grade <= band.to)).toHaveLength(1);
  });

  it("agrees between the catalog and the display preferences", () => {
    for (const grade of GRADES) expect(bandForGrade(grade).id).toBe(gradeBandForGrade(grade));
    expect(gradeBandForGrade(5)).toBe("elementary");
    expect(gradeBandForGrade(6)).toBe("middle");
    expect(gradeBandForGrade(9)).toBe("high");
  });
});

describe("picture passwords", () => {
  it("has an image, a colour and a word for every picture key the server accepts", () => {
    expect(PICTURE_KEYS).toEqual([...CONTRACT_PICTURES]);
    for (const key of PICTURE_KEYS) {
      const info = PICTURES[key as keyof typeof PICTURES];
      expect(info.label).toBeTruthy();
      expect(info.tone).toMatch(/^bg-\S+ text-\S+$/);
    }
    expect(new Set(Object.values(PICTURES).map((info) => info.label)).size).toBe(PICTURE_KEYS.length);
  });

  it("falls back for an unknown key", () => {
    expect(pictureInfo("unicorn").label).toBe("unicorn");
  });
});

describe("formatting", () => {
  it("pluralises", () => {
    expect(pluralize(1, "course")).toBe("1 course");
    expect(pluralize(0, "course")).toBe("0 courses");
    expect(pluralize(2, "child", "children")).toBe("2 children");
  });

  it("formats dates in UTC, the same on server and browser", () => {
    expect(formatDate("2025-01-15T23:30:00Z")).toBe("January 15, 2025");
  });
});
