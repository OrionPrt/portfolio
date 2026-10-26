import "server-only";

import { headers } from "next/headers";

import { MAX_USER_AGENT_LENGTH } from "@/db/schema";
import { clientIp, senderNetwork } from "@/lib/client-ip";
import { hashIp } from "@/lib/ip-hash";

import { isSameOriginRequest } from "./origin";

export interface RequestContext {
  /** The client's IPv4 address or IPv6 /64: kept in memory, never stored. */
  readonly network: string;
  /** Its keyed hash: what sessions and the audit log store. */
  readonly networkHash: string;
  readonly userAgent: string | null;
  readonly isSameOrigin: boolean;
}

export async function requestContext(salt: string): Promise<RequestContext> {
  const requestHeaders = await headers();
  const network = senderNetwork(clientIp(requestHeaders));
  return {
    network,
    networkHash: hashIp(network, salt),
    userAgent:
      requestHeaders.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null,
    isSameOrigin: isSameOriginRequest(requestHeaders),
  };
}
