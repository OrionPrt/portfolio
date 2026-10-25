import { afterEach, describe, expect, it, vi } from "vitest";

import { sendContactNotification } from "./notify";

const MAIL = {
  apiKey: "re_secret",
  to: "prieto.orion@gmail.com",
  from: "Portfolio <onboarding@resend.dev>",
};

const MESSAGE = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Une mission",
  message: "Bonjour,\nj'ai un projet.",
  locale: "fr" as const,
};

describe("sendContactNotification", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a plain-text email to the owner only, replying to the sender", async () => {
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response('{"id":"1"}', { status: 200 })),
    );

    const result = await sendContactNotification({
      message: MESSAGE,
      mail: MAIL,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe("https://api.resend.com/emails");
    expect(new Headers(init?.headers).get("authorization")).toBe(
      "Bearer re_secret",
    );
    const body = JSON.parse(init?.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({
      from: "Portfolio <onboarding@resend.dev>",
      to: ["prieto.orion@gmail.com"],
      reply_to: "ada@example.com",
      subject: "[Portfolio] Une mission",
    });
    expect(body).not.toHaveProperty("html");
    expect(body.text).toContain("Ada Lovelace <ada@example.com>");
    expect(body.text).toContain("Bonjour,\nj'ai un projet.");
  });

  it("reports a refusal, logging the status but never the message", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const fetchImpl = vi.fn<typeof fetch>(() =>
      Promise.resolve(new Response("{}", { status: 422 })),
    );

    const result = await sendContactNotification({
      message: MESSAGE,
      mail: MAIL,
      fetchImpl,
    });

    expect(result).toMatchObject({ ok: false, error: { code: "MAIL_FAILED" } });
    const logged = String(consoleError.mock.calls[0]?.[0]);
    expect(logged).toContain("422");
    expect(logged).not.toContain("ada@example.com");
    expect(logged).not.toContain("j'ai un projet");
  });
});
