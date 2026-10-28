"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";

import type {
  ContentAction,
  ContentFormState,
} from "@/features/admin/content-form-state";
import { ADMIN_PATHS } from "@/features/auth/admin-paths";
import { MAX_UPLOAD_BYTES } from "@/features/media/limits";
import type { UploadOutcome } from "@/features/media/upload";

import { ADMIN_COPY } from "../copy";
import { ContentForm } from "./content-form";
import { FileField, MediaAltFields } from "./media-fields";

const COPY = ADMIN_COPY.media;

/** The upload route (a route, not an action: see src/app/api/admin/media). */
const UPLOAD_ROUTE = "/api/admin/media";

/** Past this, a stalled upload reads as a failure rather than wait for ever. */
const UPLOAD_TIMEOUT_MS = 60_000;

const FILE_REFUSED: ContentFormState = {
  status: "invalid",
  problems: { file: { problem: "invalid" } },
};

async function send(formData: FormData): Promise<UploadOutcome | undefined> {
  try {
    const response = await fetch(UPLOAD_ROUTE, {
      method: "POST",
      body: formData,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
    return (await response.json()) as UploadOutcome;
  } catch {
    return undefined;
  }
}

/** The route's answer as the form shows it; anything unexpected reads as a failure. */
function stateOf(outcome: UploadOutcome | undefined): ContentFormState {
  switch (outcome?.status) {
    case "saved":
      return { status: "saved" };
    case "invalid":
      return { status: "invalid", problems: outcome.problems };
    case "full":
      return { status: "full" };
    default:
      return { status: "unavailable" };
  }
}

/** Whether the next attempt may send the same file: unless it was the problem. */
function keepsFile(state: ContentFormState): boolean {
  return (
    state.status !== "saved" &&
    !(state.status === "invalid" && "file" in state.problems)
  );
}

/** A new image for the library: the file, and what it shows in both languages. */
export function MediaUploadForm() {
  const router = useRouter();
  // The file sent, chosen again for the user after a refusal not about it.
  const retained = useRef<File | undefined>(undefined);
  const upload: ContentAction = async (_previous, formData) => {
    const file = formData.get("file");
    // Too large for the route: said at once, nothing sent.
    const state =
      file instanceof File && file.size > MAX_UPLOAD_BYTES
        ? FILE_REFUSED
        : await sendAndFollow(formData);
    retained.current =
      file instanceof File && keepsFile(state) ? file : undefined;
    return state;
  };
  const sendAndFollow = async (formData: FormData) => {
    const outcome = await send(formData);
    if (outcome?.status === "saved") {
      router.refresh();
    }
    if (outcome?.status === "signed_out") {
      router.push(ADMIN_PATHS.login);
    }
    return stateOf(outcome);
  };
  return (
    <ContentForm
      action={upload}
      labels={{ save: COPY.send, pending: COPY.adding, saved: COPY.added }}
    >
      <FileField name="file" retained={retained} />
      <MediaAltFields />
    </ContentForm>
  );
}
