import { describe, expect, it } from "vitest";

import { describeErrorChain, NO_DETAIL } from "./error-chain";

describe("describeErrorChain", () => {
  it("lists an error and its causes", () => {
    const error = new Error("Failed query", {
      cause: new Error("connection refused"),
    });

    expect(describeErrorChain(error)).toBe(
      "Failed query\n  caused by: connection refused",
    );
  });

  it("follows the error held by an event, and names a missing detail", () => {
    const event = { type: "error", message: "", error: new Error("") };

    expect(describeErrorChain(new Error("Failed", { cause: event }))).toBe(
      `Failed\n  caused by: ${NO_DETAIL}`,
    );
  });

  it("stops on a cause that points back to itself", () => {
    const error = new Error("loop");
    error.cause = error;

    expect(describeErrorChain(error)).toBe("loop");
  });

  it("scrubs a connection string out of the message", () => {
    const error = new Error(
      "cannot reach postgresql://app:hunter2@db.example.com/app",
    );

    expect(describeErrorChain(error)).not.toContain("hunter2");
  });

  it("describes a thrown value that is not an error", () => {
    expect(describeErrorChain("plain")).toBe("plain");
    expect(describeErrorChain(42)).toBe(NO_DETAIL);
  });
});
