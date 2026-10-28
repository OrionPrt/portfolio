import { describe, expect, it } from "vitest";

import { translationState, translationStateAgainst } from "./completeness";

const REQUIRED = ["headline", "pitch"] as const;

describe("translationState", () => {
  it.each([
    [undefined, "missing"],
    [{ headline: "", pitch: "  ", lookingFor: null }, "missing"],
    [{ headline: "Ingénieur", pitch: "" }, "partial"],
    [{ headline: "", pitch: "", lookingFor: "Une mission" }, "partial"],
    [
      { headline: "Ingénieur", pitch: "Je construis…", lookingFor: null },
      "complete",
    ],
  ] as const)("reads %j as %s", (values, state) => {
    expect(translationState(values, REQUIRED)).toBe(state);
  });
});

describe("translationStateAgainst", () => {
  const FIELDS = { required: ["degree"], optional: ["description"] } as const;

  it.each([
    // An optional field counts once the default language fills it in.
    [
      { degree: "M", description: "D" },
      { degree: "M", description: "" },
      "partial",
    ],
    [
      { degree: "M", description: "" },
      { degree: "M", description: "" },
      "complete",
    ],
    [{ degree: "M", description: "D" }, undefined, "missing"],
  ] as const)("reads %j against %j as %s", (reference, values, state) => {
    expect(translationStateAgainst(values, reference, FIELDS)).toBe(state);
  });

  it("wants nothing where every field is optional and the default language is silent", () => {
    expect(
      translationStateAgainst(
        undefined,
        { description: "" },
        {
          required: [],
          optional: ["description"],
        },
      ),
    ).toBe("complete");
  });
});
