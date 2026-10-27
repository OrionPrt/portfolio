import { describe, expect, it } from "vitest";

import { translationState } from "./completeness";

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
