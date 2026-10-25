/**
 * The request body as text, or undefined when it exceeds `maxBytes`: checked
 * against Content-Length first, then counted while streaming, since the header
 * can be absent or lie.
 */
export async function readBodyWithLimit(
  request: Request,
  maxBytes: number,
): Promise<string | undefined> {
  const announced = Number(request.headers.get("content-length") ?? "0");
  if (announced > maxBytes) {
    return undefined;
  }
  if (request.body === null) {
    return "";
  }
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}
