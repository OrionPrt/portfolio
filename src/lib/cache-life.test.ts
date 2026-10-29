import { describe, expect, it } from "vitest";

import { failedReadLife } from "./cache-life";

describe("failedReadLife", () => {
  it("keeps an outage's failure for a second, as Next's seconds profile", () => {
    expect(
      failedReadLife({ DATABASE_URL: "postgresql://app@db.example.com/app" }),
    ).toEqual({ stale: 30, revalidate: 1, expire: 60 });
  });

  it.each([undefined, ""])(
    "keeps nothing without a database (DATABASE_URL %j)",
    (url) => {
      expect(failedReadLife({ DATABASE_URL: url })).toEqual({
        stale: 0,
        revalidate: 0,
        expire: 0,
      });
    },
  );
});
