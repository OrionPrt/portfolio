"use client";

import { POST_LANGUAGE_FIELD } from "@/features/content/post-fields";

import { ADMIN_COPY } from "../copy";
import { useField } from "./content-form";

/**
 * Shown above the languages when the post was sent in none of them. No field
 * takes focus for it, so it is an alert: mounted with its text at each outcome
 * (the form remounts its fields), it is announced each time.
 */
export function PostLanguageProblem() {
  const { problem } = useField(POST_LANGUAGE_FIELD, "");
  return (
    <p role="alert" className="text-danger text-sm font-medium empty:sr-only">
      {problem === undefined ? null : ADMIN_COPY.posts.languageMissing}
    </p>
  );
}
