import { describe, expect, it } from "vitest";

import en from "../../../../messages/en.json";
import fr from "../../../../messages/fr.json";
import { PREVIEW_LABELS } from "./markdown-preview";

describe("the preview's callout words", () => {
  it("are the site's own, in each language", () => {
    expect(PREVIEW_LABELS).toEqual({ fr: fr.Markdown, en: en.Markdown });
  });
});
