import { describe, expect, it } from "vitest";
import { BADGES, newlyEarnedBadges } from "@/features/learn/badges";
import { parseBlocks, videosWithoutCaptions } from "@/features/learn/blocks";
import { describeFile } from "@/features/learn/components/lesson-blocks";
import { formatTime, resumePosition, SPEEDS } from "@/features/learn/components/video-player";

const video = { id: "v", type: "video", title: "Halves", mp4: "/media/v.mp4", duration_seconds: 24, captions: [{ src: "/media/v.vtt", lang: "en", label: "English" }] };

describe("lesson content blocks", () => {
  it("keeps valid blocks in order, with defaults filled in", () => {
    const { blocks, dropped } = parseBlocks([
      { id: "intro", type: "text", heading: "Halves", paragraphs: ["Two equal parts."] },
      video,
      { id: "check", type: "check", prompt: "Which?", options: [{ id: "a", text: "1/2" }, { id: "b", text: "1/3" }], answer: "a" },
      { id: "embed", type: "embed", url: "https://phet.colorado.edu/sims/html/fractions-intro/latest/fractions-intro_en.html", title: "PhET fractions" },
    ]);
    expect(dropped).toBe(0);
    expect(blocks.map((block) => block.type)).toEqual(["text", "video", "check", "embed"]);
    expect(blocks[3]).toMatchObject({ aspect: 16 / 9 });
  });

  it("drops anything unsafe or broken rather than rendering it (FE-SEC-02)", () => {
    const { blocks, dropped } = parseBlocks([
      { id: "x1", type: "image", src: "javascript:alert(1)", alt: "", width: 10, height: 10 },
      { id: "x2", type: "image", src: "http://plain-http.example/a.png", alt: "", width: 10, height: 10 },
      { id: "x3", type: "image", src: "//protocol-relative.example/a.png", alt: "", width: 10, height: 10 },
      { id: "x4", type: "embed", url: "https://evil.example/player", title: "Not on the allow-list" },
      { id: "x5", type: "embed", url: "http://www.geogebra.org/m/abc", title: "Not https" },
      { id: "x6", type: "check", prompt: "?", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], answer: "z" },
      { id: "x7", type: "video", title: "No source", duration_seconds: 10 },
      { id: "x8", type: "html", html: "<script>alert(1)</script>" },
      { id: "Bad Id", type: "text", paragraphs: ["x"] },
      { id: "ok", type: "text", paragraphs: ["kept"] },
      { id: "ok", type: "text", paragraphs: ["duplicate id"] },
    ]);
    expect(blocks.map((block) => block.id)).toEqual(["ok"]);
    expect(dropped).toBe(10);
  });

  it("reads missing or non-list content as no blocks", () => {
    expect(parseBlocks(null)).toEqual({ blocks: [], dropped: 0 });
    expect(parseBlocks({ not: "a list" })).toEqual({ blocks: [], dropped: 0 });
  });

  it("finds videos without captions, for the authoring warning (FE-A11Y-07)", () => {
    const { blocks } = parseBlocks([video, { ...video, id: "v2", captions: [] }]);
    expect(videosWithoutCaptions(blocks).map((block) => block.id)).toEqual(["v2"]);
  });

  it("describes files people download", () => {
    expect(describeFile("application/pdf", 1521)).toBe("PDF, 1 KB");
    expect(describeFile("image/png", 300)).toBe("Image, 300 bytes");
    expect(describeFile("application/zip", 5 * 1024 * 1024)).toBe("ZIP, 5.0 MB");
  });
});

describe("badges", () => {
  const none = { lessons_completed: 0, courses_completed: 0, streak_days: 0, minutes_total: 0, notes_written: 0 };

  it("has unique ids and a way to earn every badge", () => {
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(BADGES.length);
    const everything = { lessons_completed: 1000, courses_completed: 100, streak_days: 365, minutes_total: 100_000, notes_written: 100 };
    expect(newlyEarnedBadges(everything, [])).toHaveLength(BADGES.length);
    expect(newlyEarnedBadges(none, [])).toEqual([]);
  });

  it("awards only what is newly earned, in shelf order", () => {
    const stats = { ...none, lessons_completed: 10, streak_days: 3 };
    expect(newlyEarnedBadges(stats, ["first-lesson"]).map((badge) => badge.id)).toEqual(["ten-lessons", "streak-3"]);
  });
});

describe("video player helpers", () => {
  it("formats times like a player does", () => {
    expect([0, 7.9, 75, 3725, Number.NaN].map(formatTime)).toEqual(["0:00", "0:07", "1:15", "1:02:05", "0:00"]);
  });

  it("resumes where the video was left, but starts over near either end", () => {
    expect(resumePosition(42, 120)).toBe(42);
    expect(resumePosition(undefined, 120)).toBe(0);
    expect(resumePosition(2, 120)).toBe(0);
    expect(resumePosition(118.5, 120)).toBe(0);
    expect(resumePosition(42, Number.NaN)).toBe(42);
  });

  it("offers speeds from 0.5× to 2×", () => {
    expect(SPEEDS[0]).toBe(0.5);
    expect(SPEEDS.at(-1)).toBe(2);
  });
});
