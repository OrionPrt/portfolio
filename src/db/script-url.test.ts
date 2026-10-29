import { describe, expect, it } from "vitest";

import { describeTarget, scriptDatabase } from "./script-url";

const OWNER = "postgresql://neondb_owner:owner-pw@ep-x.neon.tech/neondb";
const APP = "postgresql://portfolio_app:app-pw@ep-x.neon.tech/neondb";

describe("scriptDatabase", () => {
  it("gives the owner's URL to the scripts that need it", () => {
    expect(
      scriptDatabase({ DATABASE_URL: APP, DATABASE_OWNER_URL: OWNER }, "owner"),
    ).toEqual({ url: OWNER, variable: "DATABASE_OWNER_URL" });
  });

  it("falls back on the site's URL when the owner's is not set", () => {
    expect(scriptDatabase({ DATABASE_URL: APP }, "owner")).toEqual({
      url: APP,
      variable: "DATABASE_URL",
    });
  });

  it("runs the admin commands as the site does, even with the owner's URL at hand", () => {
    expect(
      scriptDatabase({ DATABASE_URL: APP, DATABASE_OWNER_URL: OWNER }, "app"),
    ).toEqual({ url: APP, variable: "DATABASE_URL" });
    expect(scriptDatabase({ DATABASE_OWNER_URL: OWNER }, "app")).toBe(
      undefined,
    );
  });
});

describe("describeTarget", () => {
  it("names the variable, the user and the host, never the password", () => {
    const described = describeTarget({
      url: OWNER,
      variable: "DATABASE_OWNER_URL",
    });

    expect(described).toBe("DATABASE_OWNER_URL, neondb_owner@ep-x.neon.tech");
    expect(described).not.toContain("owner-pw");
  });
});
