import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError } from "@/lib/api-client";
import { messages } from "@/lib/forms/messages";
import { fieldPaths, mapServerErrors, normaliseFieldPath } from "@/lib/forms/server-errors";
import { fields, friendlyErrorMap } from "@/lib/forms/zod";

const apiError = (status: number, details: Array<{ field?: string; message?: string }> = [], message = "Nope.") =>
  new ApiError(status, { code: "x", message, details, request_id: "r1" }, "fallback");

describe("server errors in forms", () => {
  it("strips the location prefix from field paths", () => {
    expect(normaliseFieldPath("body.email")).toBe("email");
    expect(normaliseFieldPath("query.grade_level")).toBe("grade_level");
    expect(normaliseFieldPath("body[student][name]")).toBe("student.name");
    expect(normaliseFieldPath("email")).toBe("email");
    expect(normaliseFieldPath("body")).toBe("body");
  });

  it("puts known fields next to their inputs and the rest in the form summary", () => {
    const mapped = mapServerErrors(
      apiError(422, [
        { field: "body.email", message: "Enter an email address like name@example.com." },
        { field: "body.email", message: "A second message for the same field is dropped." },
        { field: "body.unknown", message: "Something about a field the form doesn't have." },
      ]),
      ["email", "password"],
    );
    expect(mapped.fieldErrors).toEqual([{ name: "email", message: "Enter an email address like name@example.com." }]);
    expect(mapped.formError).toBe("Something about a field the form doesn't have.");
  });

  it("uses the error's own message when there are no details", () => {
    expect(mapServerErrors(apiError(401, [], "That email and password don't match."), ["email"])).toEqual({
      fieldErrors: [],
      formError: "That email and password don't match.",
    });
  });

  it("explains rate limits, server problems and unreachable servers in plain words", () => {
    expect(mapServerErrors(apiError(429), []).formError).toBe(messages.tooManyRequests);
    expect(mapServerErrors(apiError(503), []).formError).toBe(messages.serverProblem);
    expect(mapServerErrors(new TypeError("Failed to fetch"), []).formError).toBe(messages.unreachable);
    expect(mapServerErrors(new Error("boom"), []).formError).toBe(messages.serverProblem);
  });

  it("lists every field path of a values object", () => {
    expect(fieldPaths({ a: 1, b: { c: 2, d: { e: 3 } } })).toEqual(["a", "b", "b.c", "b.d", "b.d.e"]);
    expect(fieldPaths({ when: new Date() })).toEqual(["when"]);
  });
});

describe("validation messages", () => {
  const parse = <T extends z.ZodType>(schema: T, value: unknown) => {
    const result = schema.safeParse(value, { error: friendlyErrorMap });
    return result.success ? null : result.error.issues[0]!.message;
  };

  it("say what to do, naming the thing", () => {
    expect(parse(fields.text("your name"), "   ")).toBe("Enter your name.");
    expect(parse(fields.text("a password", { min: 8 }), "short")).toBe("Use at least 8 characters.");
    expect(parse(fields.text("a title", { max: 5 }), "far too long")).toBe("Use 5 characters or fewer.");
    expect(parse(fields.email(), "")).toBe("Enter your email address.");
    expect(parse(fields.email(), "not-an-email")).toBe(messages.email);
    expect(parse(fields.choice(["a", "b"] as const, "a colour"), "c")).toBe("Choose a colour.");
    expect(parse(fields.accept("agree to the rules"), false)).toBe("Tick the box to agree to the rules.");
  });

  it("check whole numbers and their range", () => {
    const age = fields.wholeNumber("your age", { min: 5, max: 18 });
    expect(parse(age, 4)).toBe("Enter a number that is 5 or more.");
    expect(parse(age, 19)).toBe("Enter a number that is 18 or less.");
    expect(parse(age, 7.5)).toBe(messages.wholeNumber);
    expect(parse(age, 10)).toBeNull();
  });

  it("trim text and turn empty optional text into undefined", () => {
    expect(fields.text("a name").parse("  Ada  ")).toBe("Ada");
    expect(fields.optionalText().parse("   ")).toBeUndefined();
  });

  it("never show zod's technical defaults", () => {
    const schema = z.object({ count: z.number(), tags: z.array(z.string()).min(2), name: z.string() });
    const result = schema.safeParse({ count: "x", tags: ["one"], name: 3 }, { error: friendlyErrorMap });
    const texts = result.success ? [] : result.error.issues.map((issue) => issue.message);
    expect(texts).toEqual([messages.number, messages.chooseAtLeast(2), messages.required()]);
    for (const text of texts) expect(text).not.toMatch(/expected|received|invalid input/i);
  });
});
