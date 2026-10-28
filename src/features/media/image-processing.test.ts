import zlib from "node:zlib";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { err } from "@/lib/result";

import {
  MAX_UPLOAD_BYTES,
  processImage,
  sniffImageFormat,
} from "./image-processing";

function picture(
  width: number,
  height: number,
  format: "png" | "jpeg" | "webp" | "gif" = "png",
): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 200, g: 80, b: 40 },
    },
  })
    .toFormat(format)
    .toBuffer();
}

/** A PNG announcing this size, with next to no pixels: a decompression bomb's header. */
function pngHeader(width: number, height: number): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  // 8-bit greyscale, deflate, no filter method or interlace beyond the defaults.
  header.writeUInt8(8, 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    // A few bytes of pixels, far from the size announced.
    chunk("IDAT", zlib.deflateSync(Buffer.alloc(64))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("sniffImageFormat", () => {
  it("knows JPEG, PNG and WebP by their first bytes, not by any name", async () => {
    expect(sniffImageFormat(await picture(4, 4, "jpeg"))).toBe("jpeg");
    expect(sniffImageFormat(await picture(4, 4, "png"))).toBe("png");
    expect(sniffImageFormat(await picture(4, 4, "webp"))).toBe("webp");
  });

  it.each([
    ["a GIF", picture(4, 4, "gif")],
    [
      "an SVG",
      Promise.resolve(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')),
    ],
    ["text", Promise.resolve(Buffer.from("hello"))],
    ["nothing", Promise.resolve(Buffer.alloc(0))],
  ])("refuses %s", async (_, bytes) => {
    expect(sniffImageFormat(await bytes)).toBeUndefined();
  });
});

describe("processImage", () => {
  it("stores up to three WebP widths, never wider than the source", async () => {
    const processed = await processImage(await picture(2400, 1200));
    if (!processed.ok) {
      throw new Error(processed.error);
    }

    expect(
      processed.data.variants.map(({ width, height }) => [width, height]),
    ).toEqual([
      [480, 240],
      [960, 480],
      [1600, 800],
    ]);
    const formats = await Promise.all(
      processed.data.variants.map(
        async ({ data }) => (await sharp(data).metadata()).format,
      ),
    );
    expect(formats).toEqual(["webp", "webp", "webp"]);
    expect(processed.data.sha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("keeps a small image at its own width", async () => {
    const processed = await processImage(await picture(700, 350, "jpeg"));

    expect(
      processed.ok && processed.data.variants.map(({ width }) => width),
    ).toEqual([480, 700]);
  });

  it("drops the metadata, after turning the image upright", async () => {
    const tagged = await sharp(await picture(400, 200, "jpeg"))
      .withMetadata({ orientation: 6, exif: { IFD0: { Artist: "Orion" } } })
      .jpeg()
      .toBuffer();

    const processed = await processImage(tagged);
    if (!processed.ok) {
      throw new Error(processed.error);
    }
    const [variant] = processed.data.variants;
    const metadata = await sharp(variant?.data).metadata();

    expect(metadata.exif).toBeUndefined();
    expect(metadata.orientation).toBeUndefined();
    // Orientation 6 is a quarter turn: the stored image stands upright.
    expect([metadata.width, metadata.height]).toEqual([200, 400]);
  });

  it.each([
    ["a file of another kind", Buffer.from("GIF89a……"), "unsupported"],
    [
      "a broken image",
      Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x01]),
      "unreadable",
    ],
    ["a file over the limit", Buffer.alloc(MAX_UPLOAD_BYTES + 1), "too_large"],
  ] as const)("refuses %s", async (_, bytes, problem) => {
    expect(await processImage(bytes)).toEqual(err(problem));
  });

  it("refuses an image too large once decoded, from its header alone", async () => {
    // A PNG whose header announces 20,000 × 20,000 pixels.
    const bomb = pngHeader(20_000, 20_000);

    expect(await processImage(bomb)).toEqual(err("too_large"));
  });
});
