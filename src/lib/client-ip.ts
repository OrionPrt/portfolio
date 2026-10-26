import { isIP } from "node:net";

/** The value when it is an IP address, else undefined: a header is only a hint. */
function address(value: string | null | undefined): string | undefined {
  const candidate = value?.trim();
  return candidate !== undefined && isIP(candidate) !== 0
    ? candidate
    : undefined;
}

/**
 * The client's address as seen by the platform. On Vercel, the edge
 * overwrites X-Forwarded-For (its first entry is the client). Elsewhere any
 * client could write it and rotate its lockout keys at will: every request
 * then counts as one "unknown" client. Anything that is not an IP address
 * counts as "unknown" too, so a forged header cannot grow a key.
 */
export function clientIp(
  headers: Headers,
  isBehindVercel: boolean = process.env.VERCEL === "1",
): string {
  if (!isBehindVercel) {
    return "unknown";
  }
  return (
    address(headers.get("x-forwarded-for")?.split(",")[0]) ??
    address(headers.get("x-real-ip")) ??
    "unknown"
  );
}

const IPV4_MAPPED = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i;

/** Hextets an IPv6 part stands for: an embedded IPv4 address counts as two. */
function widthOf(parts: readonly string[]): number {
  return parts.reduce((width, part) => width + (part.includes(".") ? 2 : 1), 0);
}

/** The /64 an IPv6 address belongs to, written in a canonical form. */
function ipv6Network(address: string): string {
  const [head = "", tail = ""] = address.split("::");
  const headParts = head === "" ? [] : head.split(":");
  const tailParts = tail === "" ? [] : tail.split(":");
  const zeros = Array<string>(
    Math.max(0, 8 - widthOf(headParts) - widthOf(tailParts)),
  ).fill("0");
  const prefix = [...headParts, ...zeros, ...tailParts]
    .slice(0, 4)
    .map((hextet) => Number.parseInt(hextet, 16).toString(16));
  return `${prefix.join(":")}::/64`;
}

/**
 * What counts as one sender: an IPv4 address, or the /64 of an IPv6 address,
 * since one subscriber usually holds a whole /64 and could rotate within it.
 * An IPv4 client reached over IPv6 is still that IPv4 address.
 */
export function senderNetwork(ip: string): string {
  const address = ip.split("%")[0] ?? ip;
  if (isIP(address) !== 6) {
    return address;
  }
  return IPV4_MAPPED.exec(address)?.[1] ?? ipv6Network(address);
}
