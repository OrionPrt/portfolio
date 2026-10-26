import { afterEach, describe, expect, it, vi } from "vitest";

import { mailConfigOf, sendMail } from "./mail";

const MAIL = {
  apiKey: "re_secret",
  to: "owner@example.com",
  from: "Portfolio <onboarding@resend.dev>",
};

function answering(status: number) {
  return vi.fn<typeof fetch>(() =>
    Promise.resolve(new Response("{}", { status })),
  );
}

describe("sendMail", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends plain text to the owner through Resend", async () => {
    const fetchImpl = answering(200);

    const result = await sendMail({
      mail: MAIL,
      message: {
        subject: "[Portfolio] Test",
        text: "Bonjour",
        replyTo: "a@b.c",
      },
      event: "test",
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer re_secret",
    );
    expect(JSON.parse(init?.body as string)).toEqual({
      from: MAIL.from,
      to: [MAIL.to],
      reply_to: "a@b.c",
      subject: "[Portfolio] Test",
      text: "Bonjour",
    });
  });

  it("leaves Reply-To out when there is none", async () => {
    const fetchImpl = answering(200);

    await sendMail({
      mail: MAIL,
      message: { subject: "Alerte", text: "Texte" },
      event: "test",
      fetchImpl,
    });

    expect(
      JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string),
    ).not.toHaveProperty("reply_to");
  });

  it.each([
    ["refused", () => answering(422), "test.mail_refused"],
    [
      "unreachable",
      () => vi.fn<typeof fetch>(() => Promise.reject(new Error("offline"))),
      "test.mail_unavailable",
    ],
  ])(
    "fails, logged under its event, when Resend is %s",
    async (_label, fetchImpl, event) => {
      const consoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);

      const result = await sendMail({
        mail: MAIL,
        message: { subject: "Secret subject", text: "Secret text" },
        event: "test",
        fetchImpl: fetchImpl(),
      });

      expect(result).toMatchObject({
        ok: false,
        error: { code: "MAIL_FAILED" },
      });
      const logged = String(consoleError.mock.calls[0]?.[0]);
      expect(logged).toContain(event);
      expect(logged).not.toContain("Secret");
    },
  );
});

describe("mailConfigOf", () => {
  it("needs a Resend key and a recipient", () => {
    expect(mailConfigOf({ RESEND_API_KEY: "re_1" })).toBeUndefined();
    expect(
      mailConfigOf({ RESEND_API_KEY: "re_1", CONTACT_TO_EMAIL: "o@e.com" }),
    ).toEqual({
      apiKey: "re_1",
      to: "o@e.com",
      from: "Portfolio <onboarding@resend.dev>",
    });
  });
});
