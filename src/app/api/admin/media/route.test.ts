import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ uploadMedia: vi.fn() }));
vi.mock("@/features/media/upload", () => ({ uploadMedia: mocks.uploadMedia }));

import { MAX_UPLOAD_BYTES } from "@/features/media/image-processing";

import { POST } from "./route";

function request(headers: Record<string, string>) {
  return new Request("http://localhost/api/admin/media", {
    method: "POST",
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/admin/media", () => {
  it.each([
    [{}, 411],
    [{ "content-length": String(MAX_UPLOAD_BYTES + 1024 * 1024) }, 413],
  ])("refuses %j unread, with %i", async (headers, status) => {
    const response = await POST(request(headers));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      status: "invalid",
      problems: { file: { problem: "invalid" } },
    });
    expect(mocks.uploadMedia).not.toHaveBeenCalled();
  });

  it.each([
    [{ status: "saved", id: "m-1" }, 201],
    [{ status: "invalid", problems: {} }, 400],
    [{ status: "full" }, 409],
    [{ status: "signed_out" }, 401],
    [{ status: "unavailable" }, 503],
  ])("answers %j with %i, never cached", async (outcome, status) => {
    mocks.uploadMedia.mockResolvedValue(outcome);

    const response = await POST(request({ "content-length": "1000" }));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual(outcome);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
});
