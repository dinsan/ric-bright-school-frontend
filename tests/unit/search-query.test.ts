import { describe, expect, it } from "vitest";
import { didYouMean, highlightParts, isSearchable, parseSearchQuery, synonymsFor, trigramSimilarity } from "@/features/search/query";

describe("parseSearchQuery", () => {
  it("keeps lower-case words of letters and digits, dropping punctuation", () => {
    expect(parseSearchQuery("  Fractions, DECIMALS & percentages!  ")).toEqual({ terms: ["fractions", "decimals", "percentages"], text: "fractions decimals percentages", grade: null });
    expect(parseSearchQuery("' or 1=1; drop table --").terms).toEqual(["or", "1", "1", "drop", "table"]);
    expect(parseSearchQuery("&|!():*<>").terms).toEqual([]);
  });

  it("understands the ways people write a grade, and uses it as a filter", () => {
    for (const query of ["grade 4", "Grade4", "gr 4", "g4", "year 4", "4th grade", "fractions grade 4"]) {
      expect(parseSearchQuery(query).grade, query).toBe(4);
    }
    expect(parseSearchQuery("fractions grade 4").terms).toEqual(["fractions"]);
    expect(parseSearchQuery("1st grade counting")).toMatchObject({ grade: 1, terms: ["counting"] });
    expect(parseSearchQuery("12th grade calculus").grade).toBe(12);
  });

  it("treats numbers that aren't a valid grade as words", () => {
    expect(parseSearchQuery("grade 13")).toMatchObject({ grade: null, terms: ["grade", "13"] });
    expect(parseSearchQuery("counting to 100")).toMatchObject({ grade: null, terms: ["counting", "to", "100"] });
  });

  it("keeps letters from every language, and caps the number and length of words", () => {
    expect(parseSearchQuery("Español für Kinder").terms).toEqual(["español", "für", "kinder"]);
    expect(parseSearchQuery("a b c d e f g h i j").terms).toHaveLength(8);
    expect(parseSearchQuery("x".repeat(60)).terms[0]).toHaveLength(40);
  });
});

describe("isSearchable", () => {
  it("needs two characters of words, or a grade", () => {
    expect(isSearchable(parseSearchQuery(""))).toBe(false);
    expect(isSearchable(parseSearchQuery("f"))).toBe(false);
    expect(isSearchable(parseSearchQuery("!!"))).toBe(false);
    expect(isSearchable(parseSearchQuery("fr"))).toBe(true);
    expect(isSearchable(parseSearchQuery("g4"))).toBe(true);
  });
});

describe("highlightParts", () => {
  const marked = (text: string, terms: string[]) =>
    highlightParts(text, terms)
      .filter((part) => part.match)
      .map((part) => part.text);

  it("marks words that start with a term, ignoring case", () => {
    expect(marked("Fractions Made Simple", ["frac"])).toEqual(["Frac"]);
    expect(marked("Adding and subtracting fractions", ["fraction", "add"])).toEqual(["Add", "fraction"]);
  });

  it("only marks the start of words (not 'add' inside 'ladder')", () => {
    expect(marked("Ladder of numbers", ["add"])).toEqual([]);
  });

  it("prefers the longest term, ignores one-letter terms, and keeps the whole text", () => {
    expect(marked("Multiplication facts", ["multi", "multiplication"])).toEqual(["Multiplication"]);
    expect(marked("A fraction", ["a"])).toEqual([]);
    const parts = highlightParts("Equivalent fractions", ["fract"]);
    expect(parts.map((part) => part.text).join("")).toBe("Equivalent fractions");
  });

  it("treats regular-expression characters in terms as plain text", () => {
    expect(() => highlightParts("C++ (advanced)", ["c++", "(adv"])).not.toThrow();
  });
});

describe("synonyms (FE-PUB-12)", () => {
  it("knows the other spellings of school words, both ways", () => {
    expect(synonymsFor("maths")).toEqual(expect.arrayContaining(["math", "mathematics"]));
    expect(synonymsFor("math")).toContain("maths");
    expect(synonymsFor("colour")).toEqual(["color"]);
    expect(synonymsFor("color")).toEqual(["colour"]);
  });

  it("returns nothing for ordinary words", () => {
    expect(synonymsFor("fractions")).toEqual([]);
    expect(synonymsFor("")).toEqual([]);
  });
});

describe("did you mean (FE-PUB-12)", () => {
  it("measures word similarity like pg_trgm", () => {
    expect(trigramSimilarity("python", "python")).toBe(1);
    expect(trigramSimilarity("fracton", "fraction")).toBeGreaterThan(0.4);
    expect(trigramSimilarity("python", "history")).toBeLessThan(0.2);
  });

  it("suggests the corrected words from the titles that were found", () => {
    const parsed = parseSearchQuery("fracton");
    expect(didYouMean(parsed, ["Fractions Made Simple"])).toBe("fractions");
  });

  it("suggests nothing when the words already match or nothing is close", () => {
    expect(didYouMean(parseSearchQuery("fractions"), ["Fractions Made Simple"])).toBeNull();
    expect(didYouMean(parseSearchQuery("zzz"), ["Fractions Made Simple"])).toBeNull();
    expect(didYouMean(parseSearchQuery("fracton"), [])).toBeNull();
  });
});
