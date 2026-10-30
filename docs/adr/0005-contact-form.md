# ADR-0005 — Contact form

- **Status:** Accepted
- **Date:** 2026-10-25
- **Phase:** P4

## Context

The contact page is the site's first public input surface. It must:

- reach the owner reliably, so a failed email never loses a message;
- resist bots and floods on a Hobby budget, with no cookie banner and no third party that profiles visitors;
- keep the strict CSP of [ADR-0002](0002-csp.md) intact;
- stay usable without JavaScript, even if only to point to another channel.

## Decisions

### A server action, checked from the cheapest step to the costliest

The form posts to a server action (`src/features/contact/actions.ts`) through React's `useActionState`. Next.js rejects calls from another origin, and the body is capped at 64 KB (`serverActions.bodySizeLimit`; raised to 512 KB in P6 for the admin's Markdown, see [ADR-0007](0007-admin.md)). `handleContactSubmission` (`submit.ts`) runs the checks in this order, each with its own outcome:

| Step                         | On failure                                        |
| ---------------------------- | ------------------------------------------------- |
| Configuration complete       | "unavailable", logged as `contact.not_configured` |
| Honeypot field empty         | Answered as **sent**, and the message is dropped  |
| Fields valid (Zod, server)   | Per-field error codes                             |
| Turnstile token genuine      | "captcha"                                         |
| Rate limit                   | "rate_limited"                                    |
| Stored in `contact_messages` | "unavailable"                                     |

The rate limit comes after Turnstile, so only verified submissions count against a sender. The notification is scheduled with `after()`, once the response is sent: the visitor never waits for the email, and a failed email loses nothing, since the message is already stored.

On a refusal, the action sends back the text typed in each field. React empties a form once its action settles, and these values refill it through `defaultValue`. If the request itself fails (a dropped connection, a server error), the form shows it as unavailable and keeps the text, rather than giving way to the error page.

The honeypot is named `contact_ref`, not `website` or `url`, which password managers fill: a real message would be dropped. Its container is `inert`, so no focus, pointer or assistive technology reaches it.

### Validation: native in the browser, Zod on the server

Field limits live in a Zod-free module (`fields.ts`) shared with the form, which applies them as `required`, `type="email"`, `minLength` and `maxLength`. The Zod schema (`schema.ts`) is server-only. Zod 4 probes `new Function` when a schema is built, and under the CSP that probe raised a violation report on every visit: Zod stays out of browser bundles. The E2E suite catches a regression, since it records CSP violations on the contact page.

Single-line fields (name, email, subject) reject every control character, so nothing can forge an email header further down, as well as line separators and bidirectional overrides, which spoof how a name or subject reads. The message keeps line breaks and tabs, but no other control character (Postgres refuses NUL). Forms send line breaks as CRLF while the browser's `maxLength` counts one character: the server turns them into LF before measuring. Database `CHECK` constraints repeat the length limits.

### Cloudflare Turnstile, rendered explicitly

Turnstile is free, does not track visitors across sites and needs no cookie banner. hCaptcha and reCAPTCHA were set aside for privacy and weight.

- **Loading.** The widget's script is added by our code with the request's nonce. `'strict-dynamic'` already trusts a script added by a signed one, and the nonce also covers browsers without it. The policy only gains `frame-src https://challenges.cloudflare.com`.
- **Rendering.** The widget is rendered with the action `contact`, the page's language and the site's theme. It switches to its compact size in a column narrower than 300 px, so the page still reflows at 320 px.
- **Gating.** The form is held back until the widget has issued a token, and again after each submission, since a token is accepted only once. The button stays focusable (`aria-disabled`), described by "anti-bot check in progress", and the form cancels its own submission until then. Without JavaScript the button is disabled, and a `<noscript>` message points to email and LinkedIn, which the page lists.
- **Verification.** `siteverify` is called with an 8-second timeout. Anything short of a clear success is a refusal: an unreachable API, an unexpected answer, or a token without the `contact` action. Only Cloudflare's test secret may answer without an action, and it is refused on Vercel (below). The visitor's IP is not sent.

### Rate limit: 5 messages an hour per sender, 30 overall, shared through Upstash

Sliding windows in Upstash Redis (Vercel Marketplace integration, free tier) hold across serverless instances:

- **Per sender**, 5 messages an hour. A sender is an IPv4 address, or the /64 of an IPv6 address: one subscriber usually holds a whole /64 and could rotate within it. The key is an HMAC-SHA-256 of that network, keyed with `IP_HASH_SALT`.
- **Overall**, 30 messages an hour, whoever sends them. It caps a flood spread over many addresses with solved challenges, and the mail it would send (Resend's free tier). Reaching it logs `contact.overall_limit_reached`.

If Upstash fails or takes longer than 2 seconds, the message goes through and `contact.rate_limit_unavailable` is logged. The library answers a timeout as a success, so its `reason` is checked too. Turnstile has already stopped the bots, and losing a real message is worse than letting a few more through. Outside Vercel, the limits are kept in memory, per instance.

The CSP reporting endpoint keeps its in-memory limit ([ADR-0002](0002-csp.md)): its abuse only adds log noise, and the free Upstash quota is kept for the form.

### Production fails closed, development runs on test keys

`contactConfig()` (`config.ts`) reads the environment:

- **On Vercel** (production and previews), the Turnstile keys, `IP_HASH_SALT` and Upstash are required, and Cloudflare's test secret counts as missing: it passes any token. If one is missing, the page replaces the form with a message pointing to email and LinkedIn, and a submission is refused with `contact.not_configured` in the logs. A deployment can never accept messages without its anti-abuse layer.
- **Elsewhere** (development, CI), Cloudflare's documented test keys, a fixed development salt and the in-memory limit apply. The E2E suite runs this way, against a local Postgres that its contact tests check for, and with email turned off. The site is only deployed on Vercel: a self-hosted production would need these defaults removed, as client addresses would also come from a spoofable `X-Forwarded-For`.

### Notification: plain text, to the owner only

Resend sends one plain-text email to `CONTACT_TO_EMAIL`, with `reply_to` set to the sender. The subject is prefixed with `[Portfolio]`. Visitors get no acknowledgement email: sending mail to an address typed in a public form would turn the site into a spam relay. Until the domain is verified (P12), Resend only sends from `onboarding@resend.dev`, to the account owner's address. Failures log the HTTP status only, never the message.

The sender's address is not verified: a reply goes to whatever was typed. The notification is plain text, so it holds no live link or markup.

### Personal data

- **Stored:** name, email address, subject, message, locale, user agent (capped at 512 characters) and the keyed hash of the sender's network. The address itself is never stored or logged, and the hash cannot be reversed without the salt.
- **Logs:** a failed insert is logged with its SQL state and constraint only. Drizzle quotes the values in its error, and Postgres repeats a refused row in its detail, so the error itself is never logged (`runQuery`, option `hasPersonalData`).
- **Retention:** 12 months, announced under the form. The daily cron deletes older messages ([ADR-0009](0009-journey-and-retention.md)).
- **Status:** each message carries a status (`unread`, `read`, `archived`) for the admin (P6).

## Alternatives considered

- **A route handler with a client-side `fetch`.** It would need its own CSRF check and would not work without JavaScript. Server actions bring the origin check and progressive enhancement.
- **Zod in the browser** for instant feedback. Native constraints cover the same rules without the bundle weight or the CSP report.
- **Rate limit in memory only.** It would reset on every cold start and differ between instances, which a determined sender can exploit.
- **Storing the raw IP address.** It is personal data, and a hash is enough to count messages.
- **Checking the token's hostname.** Previews change hostname with every deployment, and the action check plus the secret already tie a token to this form.
- **A rate limit before Turnstile.** A garbage token costs one `siteverify` call, which Cloudflare refuses at once. The limits stay after Turnstile, so a visitor's failed challenges never count against them.

## Consequences

- The form depends on four services: Neon, Turnstile, Upstash and Resend. Only Neon and Turnstile are needed to accept a message: Upstash fails open, and Resend failures leave the message stored.
- The setup is a deployment step ([deployment guide](../deploy.md)). Until it is done, production shows the "not available" message.
- Verification is automated:
  - unit tests: field rules, every outcome of the pipeline in order, the honeypot, Turnstile verdicts, both rate limits with Upstash and in memory, sender networks, mail failures, logs free of personal data, configuration on and off Vercel, the form's behaviour (gating, live regions, errors, focus, refill, failed requests) and the widget's life cycle;
  - E2E tests with Cloudflare's test keys: a message is stored, a post without a token is refused and stores nothing, a filled honeypot stores nothing, values survive a refusal, the page points to email when Turnstile cannot load and without JavaScript, and no CSP violation is raised.
