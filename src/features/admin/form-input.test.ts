import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  blankToNull,
  fieldProblemsOf,
  textFields,
  textList,
  translationsFrom,
} from "./form-input";

function form(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

describe("textFields", () => {
  it("keeps the text values, never a file", () => {
    const data = form({ name: "Ada" });
    data.append("upload", new Blob(["x"]), "x.txt");

    expect(textFields(data)).toEqual({ name: "Ada" });
  });
});

describe("textList", () => {
  it("keeps every text sent under a name, in order, never a file", () => {
    const data = form({ name: "Ada" });
    data.append("skills", "rust");
    data.append("skills", new Blob(["x"]), "x.txt");
    data.append("skills", "react");

    expect(textList(data, "skills")).toEqual(["rust", "react"]);
    expect(textList(data, "absent")).toEqual([]);
  });
});

describe("translationsFrom", () => {
  const KEYS = ["headline", "lookingFor"] as const;

  it("groups each locale's fields, an optional empty one as null", () => {
    expect(
      translationsFrom(
        {
          "fr.headline": "Ingénieur",
          "fr.lookingFor": "",
          "en.headline": "Engineer",
        },
        KEYS,
        { optional: ["lookingFor"] },
      ),
    ).toEqual({
      fr: { headline: "Ingénieur", lookingFor: null },
      en: { headline: "Engineer", lookingFor: null },
    });
  });

  it("keeps the default locale even when blank, so its fields report themselves", () => {
    expect(
      translationsFrom({ "fr.headline": "", "fr.lookingFor": "" }, KEYS, {
        optional: ["lookingFor"],
      }),
    ).toEqual({ fr: { headline: "", lookingFor: null } });
  });

  it("leaves out another locale left blank: it falls back to the default", () => {
    expect(
      translationsFrom(
        { "fr.headline": "Ingénieur", "en.headline": " ", "en.lookingFor": "" },
        KEYS,
        { optional: ["lookingFor"] },
      ),
    ).toEqual({ fr: { headline: "Ingénieur", lookingFor: null } });
  });
});

describe("fieldProblemsOf", () => {
  const SCHEMA = z.object({
    name: z.string().trim().min(1).max(5),
    slug: z.string().regex(/^[a-z]+$/),
    translations: z
      .partialRecord(
        z.enum(["fr", "en"]),
        z.object({ headline: z.string().min(1) }).optional(),
      )
      .refine((value) => value.fr !== undefined, { path: ["fr"] }),
  });

  it("names each problem by its field, in words the form can show", () => {
    const parsed = SCHEMA.safeParse({
      name: "toolong",
      slug: "Not A Slug",
      translations: { en: { headline: "" } },
    });

    expect(parsed.success).toBe(false);
    expect(parsed.error && fieldProblemsOf(parsed.error)).toEqual({
      name: { problem: "too_long", max: 5 },
      slug: { problem: "invalid" },
      "en.headline": { problem: "required" },
      fr: { problem: "required" },
    });
  });
});

describe("blankToNull", () => {
  it.each([
    [undefined, null],
    ["  ", null],
    ["Lyon", "Lyon"],
  ])("reads %j as %j", (value, expected) => {
    expect(blankToNull(value)).toBe(expected);
  });
});
