import { describe, expect, it } from "vitest";

import { lockoutMail } from "./lockout-mail";

describe("lockoutMail", () => {
  it("tells the owner when and how long, and how to unlock", () => {
    const mail = lockoutMail({
      at: new Date("2026-10-25T12:00:00Z"),
      until: new Date("2026-10-25T12:01:00Z"),
    });

    expect(mail.subject).toBe("[Portfolio] Compte admin verrouillé");
    // Winter time from that very day: UTC+1.
    expect(mail.text).toContain("25/10/2026 13:00");
    expect(mail.text).toContain("13:01");
    expect(mail.text).toContain("pnpm admin:unlock");
    expect(mail).not.toHaveProperty("replyTo");
  });
});
