import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ updateTag: vi.fn() }));

vi.mock("next/cache", () => ({ updateTag: mocks.updateTag }));

import { revalidateContent } from "./revalidate";

describe("revalidateContent", () => {
  it("expires every tag the change touches, for the next request to read fresh data", () => {
    revalidateContent({ entity: "project", slugs: ["new", "old"] });

    expect(mocks.updateTag.mock.calls).toEqual([
      ["projects"],
      ["project:new"],
      ["project:old"],
    ]);
  });
});
