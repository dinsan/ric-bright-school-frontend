import { MAX_GRADE, MIN_GRADE } from "@/features/catalog/constants";

/**
 * Turning what someone typed into a search, the same way on the server (to query) and in the browser
 * (to highlight matches). Pure: no database, no DOM.
 */

export interface ParsedQuery {
  /** The words to match, lower-case, letters and digits only (safe to put in a tsquery). */
  terms: string[];
  /** The words as one string, for similarity matching (typos). */
  text: string;
  /** A grade mentioned in the query: "grade 4", "gr 4", "g4", "year 4", "4th grade". */
  grade: number | null;
  /** A subject filter chosen on the /search page (slug); never parsed out of the text. */
  subject?: string | null;
}

const MAX_TERMS = 8;
const MAX_TERM_LENGTH = 40;
const GRADE_PATTERNS = [/\b(?:grade|gr|year|yr)\s*(\d{1,2})\b/u, /\bg(\d{1,2})\b/u, /\b(\d{1,2})(?:st|nd|rd|th)\s+grade\b/u];

export function parseSearchQuery(raw: string): ParsedQuery {
  let text = raw.normalize("NFKC").toLowerCase().slice(0, 200);
  let grade: number | null = null;
  for (const pattern of GRADE_PATTERNS) {
    const match = text.match(pattern);
    const value = match ? Number(match[1]) : NaN;
    if (match && value >= MIN_GRADE && value <= MAX_GRADE) {
      grade = value;
      text = text.replace(match[0], " ");
      break;
    }
  }
  const terms = (text.match(/[\p{L}\p{N}]+/gu) ?? []).slice(0, MAX_TERMS).map((term) => term.slice(0, MAX_TERM_LENGTH));
  return { terms, text: terms.join(" "), grade };
}

/**
 * A query worth sending: at least two characters of words, or a grade. Keeps single keystrokes from
 * matching half the catalog.
 */
export function isSearchable(query: ParsedQuery): boolean {
  return query.grade !== null || query.text.replace(/\s/g, "").length >= 2;
}

/**
 * School words spelled differently in different places (FE-PUB-12): searching one finds the others.
 * Whole words only; prefix matching already covers "math" → "mathematics". Kept deliberately small:
 * a wrong synonym quietly pollutes results.
 */
const SYNONYM_GROUPS: readonly string[][] = [
  ["math", "maths", "mathematics"],
  ["color", "colour"],
  ["gray", "grey"],
  ["center", "centre"],
  ["meter", "metre"],
  ["liter", "litre"],
];

/** The other spellings of `term` (lower-case), or []. */
export function synonymsFor(term: string): string[] {
  for (const group of SYNONYM_GROUPS) {
    if (group.includes(term)) return group.filter((word) => word !== term);
  }
  return [];
}

/** Trigram similarity of two words (0 to 1), like PostgreSQL's pg_trgm: shared 3-grams over all 3-grams. */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (word: string) => {
    const padded = `  ${word.toLowerCase()} `;
    const set = new Set<string>();
    for (let index = 0; index <= padded.length - 3; index++) set.add(padded.slice(index, index + 3));
    return set;
  };
  const setA = grams(a);
  const setB = grams(b);
  const shared = [...setA].filter((gram) => setB.has(gram)).length;
  const union = setA.size + setB.size - shared;
  return union === 0 ? 0 : shared / union;
}

/**
 * "Did you mean …?" (FE-PUB-12): when only close matches were found, rebuild the query with each term
 * replaced by the most similar word from the titles actually found. Null when nothing would change.
 */
export function didYouMean(parsed: ParsedQuery, titles: string[]): string | null {
  const words = [...new Set(titles.flatMap((title) => title.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []))];
  if (words.length === 0 || parsed.terms.length === 0) return null;
  let changed = false;
  const corrected = parsed.terms.map((term) => {
    let best: { word: string; score: number } | null = null;
    for (const word of words) {
      const score = trigramSimilarity(term, word);
      // 0.3: low enough for a dropped letter before a plural ("fracton" / "fractions"), and safe
      // because the candidate words come only from titles the close-match search already found.
      if (score >= 0.3 && (best === null || score > best.score)) best = { word, score };
    }
    if (best && best.word !== term) {
      changed = true;
      return best.word;
    }
    return term;
  });
  return changed ? corrected.join(" ") : null;
}

export interface TextPart {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into parts, marking the stretches that start with one of the search terms (the start of a
 * word), for highlighting. Plain strings only: the caller renders them, so nothing is parsed as HTML.
 */
export function highlightParts(text: string, terms: string[]): TextPart[] {
  const usable = [...new Set(terms.filter((term) => term.length >= 2))].sort((a, b) => b.length - a.length);
  if (usable.length === 0) return [{ text, match: false }];
  const escaped = usable.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(${escaped.join("|")})`, "giu");
  const parts: TextPart[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const start = match.index;
    if (start > last) parts.push({ text: text.slice(last, start), match: false });
    parts.push({ text: match[0], match: true });
    last = start + match[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), match: false });
  return parts;
}
