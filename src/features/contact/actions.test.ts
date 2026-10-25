import { describe, expect, it, vi } from "vitest";

import type { ContactDependencies, ContactSubmission } from "./submit";

const mocks = vi.hoisted(() => ({
  headers: vi.fn<() => Promise<Headers>>(),
  submit:
    vi.fn<
      (
        submission: ContactSubmission,
        deps: ContactDependencies,
      ) => Promise<{ status: "sent" }>
    >(),
  deps: {} as ContactDependencies,
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("./dependencies", () => ({ contactDependencies: () => mocks.deps }));
vi.mock("./submit", () => ({ handleContactSubmission: mocks.submit }));

import { INITIAL_CONTACT_STATE } from "./form-state";
import { submitContact } from "./actions";

function formData(entries: Record<string, string>): FormData {
  const data = new FormData();
  for (const [name, value] of Object.entries(entries)) {
    data.append(name, value);
  }
  return data;
}

describe("submitContact", () => {
  it("hands the form, the client's address and agent, and the locale to the handler", async () => {
    mocks.headers.mockResolvedValue(
      new Headers({
        "x-forwarded-for": "203.0.113.7, 10.0.0.1",
        "user-agent": "Mozilla/5.0",
      }),
    );
    mocks.submit.mockResolvedValue({ status: "sent" });

    const state = await submitContact(
      INITIAL_CONTACT_STATE,
      formData({ name: "Ada", locale: "en" }),
    );

    expect(state).toEqual({ status: "sent" });
    expect(mocks.submit).toHaveBeenCalledWith(
      {
        fields: { name: "Ada", locale: "en" },
        ip: "203.0.113.7",
        userAgent: "Mozilla/5.0",
        locale: "en",
      },
      mocks.deps,
    );
  });

  it("passes an empty locale when the form has none", async () => {
    mocks.headers.mockResolvedValue(new Headers());
    mocks.submit.mockResolvedValue({ status: "sent" });

    await submitContact(INITIAL_CONTACT_STATE, formData({ name: "Ada" }));

    expect(mocks.submit).toHaveBeenLastCalledWith(
      expect.objectContaining({ ip: "unknown", userAgent: null, locale: "" }),
      mocks.deps,
    );
  });
});
