import { MAX_UPLOAD_BYTES } from "@/features/media/image-processing";
import { selectMediaStorage } from "@/features/media/storage";
import { uploadMedia, type UploadOutcome } from "@/features/media/upload";
import { parseServerEnv } from "@/lib/env";

/** The file, its two texts and the multipart wrapping. */
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const STATUS: Readonly<Record<UploadOutcome["status"], number>> = {
  saved: 201,
  invalid: 400,
  full: 409,
  signed_out: 401,
  unavailable: 503,
};

function answer(outcome: UploadOutcome, status = STATUS[outcome.status]) {
  return Response.json(outcome, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

const TOO_LARGE: UploadOutcome = {
  status: "invalid",
  problems: { file: { problem: "invalid" } },
};

/**
 * An image for the library, from its page (ADR-0007). A route rather than a
 * server action: the actions' body limit stays small for every other form.
 * A body without a length, or too long, is refused before it is read.
 */
export async function POST(request: Request): Promise<Response> {
  const length = request.headers.get("content-length");
  if (length === null || !/^\d+$/.test(length)) {
    return answer(TOO_LARGE, 411);
  }
  if (Number(length) > MAX_REQUEST_BYTES) {
    return answer(TOO_LARGE, 413);
  }
  const storage = selectMediaStorage(parseServerEnv(process.env));
  return answer(await uploadMedia(request, storage));
}
