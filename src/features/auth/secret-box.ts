import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { err, ok, type Result } from "@/lib/result";

const VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
/** 96 bits, the nonce size GCM is designed for; random per seal. */
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const BASE64URL = /^[A-Za-z0-9_-]+$/;

export type SecretBoxError = "malformed" | "unsupported_version" | "rejected";

/**
 * Seals a secret with AES-256-GCM: "v1.<nonce>.<ciphertext>.<tag>". The
 * associated data (the account id) binds it to one row: copied onto another
 * account, it no longer opens. The version allows a later key or algorithm.
 */
export function sealSecret(
  secret: Uint8Array,
  key: Uint8Array,
  associatedData: string,
): string {
  const nonce = randomBytes(NONCE_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, nonce, {
    authTagLength: TAG_BYTES,
  });
  cipher.setAAD(Buffer.from(associatedData));
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [VERSION, nonce, ciphertext, cipher.getAuthTag()]
    .map((part) =>
      typeof part === "string" ? part : part.toString("base64url"),
    )
    .join(".");
}

/** Opens a sealed secret; any change to it, its key or its account fails. */
export function openSecret(
  sealed: string,
  key: Uint8Array,
  associatedData: string,
): Result<Uint8Array, SecretBoxError> {
  const [version, ...parts] = sealed.split(".");
  if (version !== VERSION) {
    return err(version?.startsWith("v") ? "unsupported_version" : "malformed");
  }
  const [nonce, ciphertext, tag] = parts.map((part) =>
    BASE64URL.test(part) ? Buffer.from(part, "base64url") : undefined,
  );
  if (
    parts.length !== 3 ||
    nonce?.length !== NONCE_BYTES ||
    ciphertext === undefined ||
    tag?.length !== TAG_BYTES
  ) {
    return err("malformed");
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, nonce, {
      authTagLength: TAG_BYTES,
    });
    decipher.setAAD(Buffer.from(associatedData));
    decipher.setAuthTag(tag);
    return ok(
      new Uint8Array(
        Buffer.concat([decipher.update(ciphertext), decipher.final()]),
      ),
    );
  } catch {
    // GCM refuses a changed nonce, ciphertext, tag, key or account alike.
    return err("rejected");
  }
}

/** The 256-bit sealing key, from its base64 form (`openssl rand -base64 32`). */
export function parseSealingKey(
  encoded: string,
): Result<Uint8Array, "invalid"> {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) {
    return err("invalid");
  }
  const key = Buffer.from(encoded, "base64");
  return key.length === KEY_BYTES ? ok(new Uint8Array(key)) : err("invalid");
}
