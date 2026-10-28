// Free of server code: the upload form checks the size before sending.

/** The largest file the library takes (ADR-0007): under Vercel's 4.5 MB request limit. */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
