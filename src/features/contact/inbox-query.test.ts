import { describe, expect, it } from "vitest";

import {
  INBOX_MAX_PAGE,
  inboxHref,
  inboxPageCount,
  parseInboxQuery,
} from "./inbox-query";

describe("parseInboxQuery", () => {
  it.each([
    [{}, { view: "received", page: 1 }],
    [
      { view: "archived", page: "3" },
      { view: "archived", page: 3 },
    ],
    [
      { view: "spam", page: "0" },
      { view: "received", page: 1 },
    ],
    [{ page: "-2" }, { view: "received", page: 1 }],
    [{ page: "2.5" }, { view: "received", page: 1 }],
    [{ page: "1e3" }, { view: "received", page: 1 }],
    [{ page: ["2", "3"] }, { view: "received", page: 1 }],
    [{ page: "99999999" }, { view: "received", page: 500 }],
  ])("reads %j as %j, never trusting it", (params, expected) => {
    expect(parseInboxQuery(params)).toEqual(expected);
  });
});

describe("inboxHref", () => {
  it.each([
    [{ view: "received", page: 1 }, "/admin/messages"],
    [{ view: "received", page: 2 }, "/admin/messages?page=2"],
    [{ view: "archived", page: 1 }, "/admin/messages?view=archived"],
    [{ view: "archived", page: 3 }, "/admin/messages?view=archived&page=3"],
  ] as const)("links %j to %s", (query, href) => {
    expect(inboxHref(query)).toBe(href);
  });
});

describe("inboxPageCount", () => {
  it.each([
    [0, 1],
    [20, 1],
    [21, 2],
    [1_000_000, INBOX_MAX_PAGE],
  ])("shows %i messages on %i pages", (total, pages) => {
    expect(inboxPageCount(total)).toBe(pages);
  });
});
