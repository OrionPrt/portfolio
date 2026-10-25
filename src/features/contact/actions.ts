"use server";

import { headers } from "next/headers";

import { clientIp } from "@/lib/client-ip";

import { contactDependencies } from "./dependencies";
import type { ContactFormState } from "./form-state";
import { handleContactSubmission } from "./submit";

/**
 * The contact form's action (useActionState). Next.js rejects calls from
 * another origin (CSRF) and caps the body; everything else is checked in
 * handleContactSubmission.
 */
export async function submitContact(
  _previous: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const requestHeaders = await headers();
  const locale = formData.get("locale");
  return handleContactSubmission(
    {
      fields: Object.fromEntries(formData),
      ip: clientIp(requestHeaders),
      userAgent: requestHeaders.get("user-agent"),
      locale: typeof locale === "string" ? locale : "",
    },
    contactDependencies(),
  );
}
