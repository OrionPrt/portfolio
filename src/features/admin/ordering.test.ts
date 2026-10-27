import { describe, expect, it } from "vitest";

import { moveItem } from "./ordering";

describe("moveItem", () => {
  const IDS = ["a", "b", "c"];

  it.each([
    ["b", "up", ["b", "a", "c"]],
    ["b", "down", ["a", "c", "b"]],
    ["a", "down", ["b", "a", "c"]],
  ] as const)("moves %s %s", (id, direction, expected) => {
    expect(moveItem(IDS, id, direction)).toEqual(expected);
    expect(IDS).toEqual(["a", "b", "c"]);
  });

  it.each([
    ["a", "up"],
    ["c", "down"],
    ["z", "up"],
  ] as const)("cannot move %s %s", (id, direction) => {
    expect(moveItem(IDS, id, direction)).toBeUndefined();
  });
});
