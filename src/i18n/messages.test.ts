import { describe, expect, it } from "vitest";

import en from "../../messages/en.json";
import fr from "../../messages/fr.json";

type Messages = Readonly<Record<string, unknown>>;

/** Flattens nested messages into `[dotted.key, text]` pairs. */
function entriesOf(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix === "" ? key : `${prefix}.${key}`;
    return typeof value === "string"
      ? [[path, value]]
      : entriesOf(value as Messages, path);
  });
}

function placeholdersOf(text: string): string[] {
  return [...text.matchAll(/\{(\w+)/g)].map(([, name = ""]) => name).sort();
}

const catalogs = {
  fr: new Map(entriesOf(fr)),
  en: new Map(entriesOf(en)),
} as const;

describe("message catalogs", () => {
  it("define exactly the same keys in French and English", () => {
    expect([...catalogs.en.keys()].sort()).toEqual(
      [...catalogs.fr.keys()].sort(),
    );
  });

  it.each(Object.entries(catalogs))(
    "have no empty message in %s",
    (_locale, catalog) => {
      const empty = [...catalog]
        .filter(([, text]) => text.trim() === "")
        .map(([key]) => key);

      expect(empty).toEqual([]);
    },
  );

  it("use the same ICU placeholders in both languages", () => {
    const mismatches = [...catalogs.fr]
      .filter(([key, text]) => {
        const english = catalogs.en.get(key) ?? "";
        return placeholdersOf(text).join() !== placeholdersOf(english).join();
      })
      .map(([key]) => key);

    expect(mismatches).toEqual([]);
  });
});
