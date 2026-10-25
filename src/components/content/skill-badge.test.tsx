import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import messages from "../../../messages/en.json";
import { SkillBadge } from "./skill-badge";

describe("SkillBadge", () => {
  it("links to the skill on the skills page of the current language", () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SkillBadge skill={{ slug: "rust", name: "Rust" }} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByRole("link", { name: "Rust" })).toHaveAttribute(
      "href",
      "/en/skills#skill-rust-en",
    );
  });
});
